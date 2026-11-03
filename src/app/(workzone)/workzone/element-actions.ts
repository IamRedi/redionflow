"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { importElementList, type ElementImportResult } from "@/lib/elements/import";
import { availableQty, canCheck, doneQty, onFieldList, sideOfStage, stagesFor, type ElementList } from "@/lib/elements/stages";
import { ElementListError, parseElementList, type ParsedElementList } from "@/lib/elements/tekla-list";
import { geocodeAddress } from "@/lib/geo/geocode";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { currentCompanyActor } from "@/lib/site-files/actor";
import { allowedForKind, safeFileName, SITE_FILE_MAX_BYTES, sniffSiteFileMime } from "@/lib/site-files/validate";
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
    const element = await tx.siteElement.findFirst({
      where: { id: elementId, companyProfileId: companyId },
      select: { id: true, list: true, baustelleId: true, quantity: true, factoryDoneQty: true, fieldDoneQty: true, work: { select: { stage: true } } },
    });
    if (!element || !stagesFor(side, element.list as ElementList).includes(stage)) return null;
    const state = { ...element, list: element.list as ElementList };
    // The field list starts where the factory ends.
    if (side === "field" && !onFieldList(state)) return "notReady" as const;
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
  if (result === "notReady") return { ok: false, message: tr("elementNotFromFactory") };
  revalidateSite(result);
  return { ok: true, message: "OK", checkedByName: actor.name };
}

const doneSchema = z.object({
  elementId: z.string().min(1).max(64),
  side: z.enum(["factory", "field"]),
  /** Pieces finished in total on that side (0 reopens). */
  pieces: z.number().int().min(0).max(100000),
});

/**
 * Engineer finishes an element on their list and says how many pieces are
 * done ("2 of 4"): the steps it went through are checked, the others are not
 * needed. Finished pieces in the factory go to the field list, the rest stay.
 * The factory cannot take back pieces the site already finished.
 */
export async function setElementDoneAction(input: unknown): Promise<ActionResult & { doneByName?: string; pieces?: number }> {
  const tr = await getActionTranslator();
  const parsed = doneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };
  const { elementId, side } = parsed.data;
  if (!canCheck(actor.can, side)) return { ok: false, message: tr("elementCheckOnlyEngineer") };

  const result = await withTenantContext(companyId, async (tx) => {
    const element = await tx.siteElement.findFirst({
      where: { id: elementId, companyProfileId: companyId },
      select: { id: true, list: true, baustelleId: true, quantity: true, factoryDoneQty: true, fieldDoneQty: true, work: { select: { stage: true } } },
    });
    if (!element) return null;
    const state = { ...element, list: element.list as ElementList };
    if (side === "field" && !onFieldList(state)) return "notReady" as const;
    const count = Math.min(parsed.data.pieces, availableQty(state, side));
    if (side === "factory") {
      const onSite = doneQty(state, "field");
      const siteStarted = onSite > 0 || element.work.some((work) => sideOfStage(work.stage) === "field");
      // Pieces already worked on site cannot go back to the factory.
      if (count < Math.max(onSite, siteStarted ? 1 : 0)) return "onSite" as const;
    }
    const stamp = count > 0 ? { at: new Date(), by: actor.name } : { at: null, by: null };
    await tx.siteElement.update({
      where: { id: element.id },
      data:
        side === "factory"
          ? { factoryDoneQty: count, factoryDoneAt: stamp.at, factoryDoneBy: stamp.by }
          : { fieldDoneQty: count, fieldDoneAt: stamp.at, fieldDoneBy: stamp.by },
    });
    return { siteId: element.baustelleId, count };
  });
  if (!result) return { ok: false, message: tr("invalidInput") };
  if (result === "notReady") return { ok: false, message: tr("elementNotFromFactory") };
  if (result === "onSite") return { ok: false, message: tr("elementAlreadyOnSite") };
  revalidateSite(result.siteId);
  return { ok: true, message: "OK", doneByName: actor.name, pieces: result.count };
}

export type ProjectSiteState = { ok: boolean; message: string; siteId?: string };

/**
 * Office: a new project arrives as documents. The element lists inside name
 * the project ("Progetto Pllum Stafuka", number 0132); the site is created
 * with that name (or the one typed), its address placed on the map, the
 * elements filled in and every file kept in the site documents. A project
 * that already has a site is updated there instead of created twice.
 */
export async function createSiteFromProjectAction(formData: FormData): Promise<ProjectSiteState> {
  const tr = await getActionTranslator();
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.can.office) return { ok: false, message: tr("accessDenied") };
  const typedName = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const address = String(formData.get("address") ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0).slice(0, 10);
  if (files.length === 0) return { ok: false, message: tr("projectNeedsFiles") };

  const lists: Array<{ list: ParsedElementList; bytes: Uint8Array<ArrayBuffer>; fileName: string }> = [];
  const others: Array<{ bytes: Uint8Array<ArrayBuffer>; fileName: string; mime: string }> = [];
  for (const file of files) {
    if (file.size > SITE_FILE_MAX_BYTES) return { ok: false, message: tr("elementListUnreadable", { file: file.name }) };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = safeFileName(file.name);
    try {
      lists.push({ list: parseElementList(bytes), bytes, fileName });
      continue;
    } catch (error) {
      if (!(error instanceof ElementListError)) throw error;
    }
    const mime = spreadsheetMime(fileName) ?? sniffSiteFileMime(bytes, file.name);
    if (!mime || !allowedForKind(mime, "document") && !spreadsheetMime(fileName)) return { ok: false, message: tr("documentTypeAllowed") };
    others.push({ bytes, fileName, mime });
  }
  const projectName = lists.find((item) => item.list.projectName)?.list.projectName ?? null;
  const projectNumber = lists.find((item) => item.list.projectNumber)?.list.projectNumber ?? null;
  const name = typedName || projectName || "";
  if (!name) return { ok: false, message: tr("projectNeedsName") };

  const company = await withTenantContext(companyId, (tx) => tx.companyProfile.findFirst({ where: { id: companyId }, select: { country: true } }));
  const coordinates = address ? await geocodeAddress(address, company?.country ?? null) : null;

  const siteId = await withTenantContext(
    companyId,
    async (tx) => {
      const existing = await tx.baustelle.findFirst({ where: { companyProfileId: companyId, name: { equals: name, mode: "insensitive" } }, select: { id: true, type: true, address: true, description: true } });
      if (existing?.type === "STEEL_WORKSHOP") return null;
      const description = projectNumber ? tr("projectDescription", { number: projectNumber }) : null;
      const site = existing
        ? await tx.baustelle.update({
            where: { id: existing.id },
            data: {
              ...(address ? { address, ...(coordinates ? { coordinates } : {}) } : {}),
              ...(!existing.description && description ? { description } : {}),
            },
            select: { id: true },
          })
        : await tx.baustelle.create({
            data: {
              companyProfileId: companyId,
              name,
              type: "STEEL_ASSEMBLY",
              status: "active",
              address: address || null,
              description,
              documents: [],
              ...(coordinates ? { coordinates } : {}),
            },
            select: { id: true },
          });
      for (const item of lists) {
        await importElementList(tx, { companyId, baustelleId: site.id, parsed: item.list, fileName: item.fileName });
      }
      const known = new Set((await tx.siteFile.findMany({ where: { companyProfileId: companyId, baustelleId: site.id }, select: { fileName: true } })).map((file) => file.fileName));
      const keep = [
        ...lists.map((item) => ({ bytes: item.bytes, fileName: item.fileName, mime: spreadsheetMime(item.fileName) ?? "application/vnd.ms-excel", reference: item.list.projectNumber })),
        ...others.map((item) => ({ ...item, reference: projectNumber })),
      ];
      for (const file of keep) {
        if (known.has(file.fileName)) continue;
        await tx.siteFile.create({
          data: {
            companyProfileId: companyId,
            baustelleId: site.id,
            kind: "document",
            fileName: file.fileName,
            mime: file.mime,
            size: file.bytes.byteLength,
            data: file.bytes,
            reference: file.reference,
            uploadedByName: actor.name,
          },
        });
      }
      return site.id;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  if (!siteId) return { ok: false, message: tr("invalidInput") };
  revalidatePath("/workzone");
  revalidateSite(siteId);
  const elements = lists.filter((item) => item.list.list === "assembly").reduce((sum, item) => sum + item.list.elements.length, 0);
  const parts = lists.filter((item) => item.list.list === "part").reduce((sum, item) => sum + item.list.elements.length, 0);
  return { ok: true, message: tr("projectSiteReady", { name, elements, parts, files: lists.length + others.length }), siteId };
}

function spreadsheetMime(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  return null;
}
