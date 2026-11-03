"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { importElementList, type ElementImportResult } from "@/lib/elements/import";
import { canCheck, sideOfStage, stagesFor, type ElementList } from "@/lib/elements/stages";
import { ElementListError, parseElementList, type ParsedElementList } from "@/lib/elements/tekla-list";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { currentCompanyActor } from "@/lib/site-files/actor";
import { safeFileName, SITE_FILE_MAX_BYTES } from "@/lib/site-files/validate";
import type { ActionResult } from "@/lib/validation/action-result";

function revalidateSite(baustelleId: string) {
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards"]);
}

export type ElementImportState = { ok: boolean; message: string; results?: ElementImportResult[] };

/**
 * Office only: reads the drawing office exports (assembly list, part list),
 * writes the elements and keeps each file in the site documents.
 */
export async function importElementListsAction(formData: FormData): Promise<ElementImportState> {
  const tr = await getActionTranslator();
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.can.office) return { ok: false, message: tr("accessDenied") };
  const baustelleId = String(formData.get("baustelleId") ?? "");
  const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0).slice(0, 4);
  if (!baustelleId || files.length === 0) return { ok: false, message: tr("invalidInput") };

  const parsed: Array<{ list: ParsedElementList; bytes: Uint8Array<ArrayBuffer>; fileName: string }> = [];
  for (const file of files) {
    if (file.size > SITE_FILE_MAX_BYTES) return { ok: false, message: tr("elementListUnreadable", { file: file.name }) };
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      parsed.push({ list: parseElementList(bytes), bytes, fileName: safeFileName(file.name) });
    } catch (error) {
      if (error instanceof ElementListError) return { ok: false, message: tr("elementListUnreadable", { file: file.name }) };
      throw error;
    }
  }

  const results = await withTenantContext(
    companyId,
    async (tx) => {
      const site = await tx.baustelle.findFirst({ where: { id: baustelleId, companyProfileId: companyId }, select: { id: true, type: true } });
      if (!site || site.type === "STEEL_WORKSHOP") return null;
      const done: ElementImportResult[] = [];
      for (const item of parsed) {
        done.push(await importElementList(tx, { companyId, baustelleId, parsed: item.list, fileName: item.fileName }));
        await tx.siteFile.create({
          data: {
            companyProfileId: companyId,
            baustelleId,
            kind: "document",
            fileName: item.fileName,
            // Parsed above, so it is a spreadsheet; always downloaded, never shown inline.
            mime: item.fileName.toLowerCase().endsWith(".xlsx")
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/vnd.ms-excel",
            size: item.bytes.byteLength,
            data: item.bytes,
            reference: item.list.projectNumber,
            uploadedByName: actor.name,
          },
        });
      }
      return done;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  if (!results) return { ok: false, message: tr("siteNotFound") };
  revalidateSite(baustelleId);
  const added = results.reduce((sum, r) => sum + r.added, 0);
  const updated = results.reduce((sum, r) => sum + r.updated, 0);
  return { ok: true, message: tr("elementListImported", { added, updated }), results };
}

const workSchema = z.object({
  elementId: z.string().min(1).max(64),
  stage: z.string().min(1).max(32),
  workerIds: z.array(z.string().min(1).max(64)).max(20),
});

/**
 * Engineer: who did this stage of this element. An empty list clears the
 * check. Factory stages need the factory engineer, "mounted" the field
 * engineer; the office admin may do both.
 */
export async function setElementWorkAction(input: unknown): Promise<ActionResult & { checkedByName?: string }> {
  const tr = await getActionTranslator();
  const parsed = workSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };
  const { elementId, stage } = parsed.data;
  const side = sideOfStage(stage);
  if (!side) return { ok: false, message: tr("invalidInput") };
  if (!canCheck(actor.can, side)) return { ok: false, message: tr("elementCheckOnlyEngineer") };
  const workerIds = [...new Set(parsed.data.workerIds)];

  const result = await withTenantContext(companyId, async (tx) => {
    const element = await tx.siteElement.findFirst({ where: { id: elementId, companyProfileId: companyId }, select: { id: true, list: true, baustelleId: true } });
    if (!element || !stagesFor(side, element.list as ElementList).includes(stage)) return null;
    if (workerIds.length === 0) {
      await tx.siteElementWork.deleteMany({ where: { elementId, stage, companyProfileId: companyId } });
      return element.baustelleId;
    }
    const workers = await tx.worker.findMany({
      where: { id: { in: workerIds }, companyProfileId: companyId, status: "active" },
      select: { id: true, firstName: true, lastName: true },
    });
    if (workers.length !== workerIds.length) return null;
    const names = workerIds.map((id) => workers.find((w) => w.id === id)).map((w) => `${w?.firstName ?? ""} ${w?.lastName ?? ""}`.trim()).join(", ");
    const data = {
      workerIds,
      workerNames: names,
      checkedByName: actor.name,
      checkedByUserId: actor.userId,
      checkedByWorkerId: actor.workerId,
      checkedAt: new Date(),
    };
    await tx.siteElementWork.upsert({
      where: { elementId_stage: { elementId, stage } },
      create: { companyProfileId: companyId, elementId, stage, ...data },
      update: data,
    });
    return element.baustelleId;
  });
  if (!result) return { ok: false, message: tr("invalidInput") };
  revalidateSite(result);
  return { ok: true, message: "OK", checkedByName: actor.name };
}
