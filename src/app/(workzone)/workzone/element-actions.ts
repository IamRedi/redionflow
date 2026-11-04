"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { importElementList, type ElementImportResult } from "@/lib/elements/import";
import { canCheck, doneQty, FIELD_STAGES, onFieldList, pieces, routeStages, sideOfStage, stagePieces, stageRemaining, stagesFor, type ElementList } from "@/lib/elements/stages";
import { describeWorkbook, ElementListError, parseElementList, type ParsedElementList } from "@/lib/elements/tekla-list";
import { logger } from "@/lib/observability/logger";
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
      if (error instanceof ElementListError) {
        logger.warn({ event: "elements.list_unreadable", size: bytes.byteLength, shape: describeWorkbook(bytes) }, "element list not read");
        return { ok: false, message: tr("elementListUnreadable", { file: file.name }) };
      }
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
  workerIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  pieces: z.number().int().min(1).max(100000),
});

const elementSelect = {
  id: true,
  list: true,
  baustelleId: true,
  quantity: true,
  factoryDoneAt: true,
  fieldDoneAt: true,
  work: { select: { id: true, stage: true, pieces: true } },
} as const;

type ElementRow = { list: string; quantity: number; factoryDoneAt: Date | null; fieldDoneAt: Date | null; work: Array<{ id: string; stage: string; pieces: number }> };

const asState = (element: ElementRow) => ({ ...element, list: element.list as ElementList });

/** Pieces the site already worked on (any field step), which the factory cannot take back. */
function piecesOnSite(element: ElementRow) {
  const state = asState(element);
  return Math.max(0, ...FIELD_STAGES.map((stage) => element.work.filter((work) => work.stage === stage).reduce((sum, work) => sum + (work.pieces > 0 ? work.pieces : pieces(state)), 0)));
}

/** The factory change would leave fewer pieces out than the site already has. */
function takesBackFromSite(after: ElementRow) {
  return doneQty(asState(after), "factory") < Math.min(piecesOnSite(after), pieces(asState(after)));
}

/**
 * Engineer: this step was done on N pieces of this element, by these workers.
 * A step can get several entries (2 pieces today, 2 tomorrow). Factory steps
 * need the factory engineer, site steps the field engineer; the office admin
 * may do both. Pieces are capped by what the step still has open.
 */
export async function addElementWorkAction(input: unknown): Promise<ActionResult & { checkedByName?: string; workId?: string; pieces?: number }> {
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
    const element = await tx.siteElement.findFirst({ where: { id: elementId, companyProfileId: companyId }, select: elementSelect });
    if (!element || !stagesFor(side, element.list as ElementList).includes(stage)) return null;
    const state = asState(element);
    // The field list starts where the factory ends.
    if (side === "field" && !onFieldList(state)) return "notReady" as const;
    const open = stageRemaining(state, stage);
    if (open === 0) return "full" as const;
    const count = Math.min(parsed.data.pieces, open);
    const workers = await tx.worker.findMany({
      where: { id: { in: workerIds }, companyProfileId: companyId, status: "active" },
      select: { id: true, firstName: true, lastName: true },
    });
    if (workers.length !== workerIds.length) return null;
    const names = workerIds.map((id) => workers.find((w) => w.id === id)).map((w) => `${w?.firstName ?? ""} ${w?.lastName ?? ""}`.trim()).join(", ");
    const created = await tx.siteElementWork.create({
      data: {
        companyProfileId: companyId,
        elementId,
        stage,
        pieces: count,
        workerIds,
        workerNames: names,
        checkedByName: actor.name,
        checkedByUserId: actor.userId,
        checkedByWorkerId: actor.workerId,
      },
      select: { id: true },
    });
    return { siteId: element.baustelleId, workId: created.id, count };
  });
  if (!result) return { ok: false, message: tr("invalidInput") };
  if (result === "notReady") return { ok: false, message: tr("elementNotFromFactory") };
  if (result === "full") return { ok: false, message: tr("elementStepFull") };
  revalidateSite(result.siteId);
  return { ok: true, message: "OK", checkedByName: actor.name, workId: result.workId, pieces: result.count };
}

/** Engineer takes back one entry of a step (a mistake). */
export async function removeElementWorkAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = z.object({ workId: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };

  const result = await withTenantContext(companyId, async (tx) => {
    const entry = await tx.siteElementWork.findFirst({ where: { id: parsed.data.workId, companyProfileId: companyId }, select: { id: true, stage: true, elementId: true } });
    if (!entry) return null;
    const side = sideOfStage(entry.stage);
    if (!side) return null;
    if (!canCheck(actor.can, side)) return "denied" as const;
    const element = await tx.siteElement.findFirst({ where: { id: entry.elementId, companyProfileId: companyId }, select: elementSelect });
    if (!element) return null;
    if (side === "factory" && piecesOnSite(element) > 0) {
      // The step stays on the route: fewer pieces through it means fewer out.
      const after = asState({ ...element, work: element.work.filter((work) => work.id !== entry.id) });
      const route = routeStages(asState(element), "factory");
      const out = route.length ? Math.min(...route.map((stage) => stagePieces(after, stage))) : 0;
      if (out < Math.min(piecesOnSite(element), pieces(after))) return "onSite" as const;
    }
    await tx.siteElementWork.delete({ where: { id: entry.id } });
    return element.baustelleId;
  });
  if (!result) return { ok: false, message: tr("invalidInput") };
  if (result === "denied") return { ok: false, message: tr("elementCheckOnlyEngineer") };
  if (result === "onSite") return { ok: false, message: tr("elementAlreadyOnSite") };
  revalidateSite(result);
  return { ok: true, message: "OK" };
}

const doneSchema = z.object({
  elementId: z.string().min(1).max(64),
  side: z.enum(["factory", "field"]),
  done: z.boolean(),
});

/**
 * Engineer finishes an element on their list: the steps it went through are
 * its route, the others are not needed. Pieces that passed the whole route go
 * on (factory: to the field list), the rest stay until their steps are done.
 * The factory cannot reopen pieces the site already worked on.
 */
export async function setElementDoneAction(input: unknown): Promise<ActionResult & { doneByName?: string }> {
  const tr = await getActionTranslator();
  const parsed = doneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };
  const { elementId, side, done } = parsed.data;
  if (!canCheck(actor.can, side)) return { ok: false, message: tr("elementCheckOnlyEngineer") };

  const result = await withTenantContext(companyId, async (tx) => {
    const element = await tx.siteElement.findFirst({ where: { id: elementId, companyProfileId: companyId }, select: elementSelect });
    if (!element) return null;
    const state = asState(element);
    if (side === "field" && !onFieldList(state)) return "notReady" as const;
    // Finishing needs at least one step done: that is the route.
    if (done && routeStages(state, side).length === 0) return "noSteps" as const;
    const stamp = done ? { at: new Date(), by: actor.name } : { at: null, by: null };
    if (side === "factory" && !done && takesBackFromSite({ ...element, factoryDoneAt: null })) return "onSite" as const;
    await tx.siteElement.update({
      where: { id: element.id },
      data: side === "factory" ? { factoryDoneAt: stamp.at, factoryDoneBy: stamp.by } : { fieldDoneAt: stamp.at, fieldDoneBy: stamp.by },
    });
    return element.baustelleId;
  });
  if (!result) return { ok: false, message: tr("invalidInput") };
  if (result === "notReady") return { ok: false, message: tr("elementNotFromFactory") };
  if (result === "noSteps") return { ok: false, message: tr("elementNeedsStep") };
  if (result === "onSite") return { ok: false, message: tr("elementAlreadyOnSite") };
  revalidateSite(result);
  return { ok: true, message: "OK", doneByName: actor.name };
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
      if (spreadsheetMime(fileName)) logger.warn({ event: "elements.list_unreadable", size: bytes.byteLength, shape: describeWorkbook(bytes) }, "spreadsheet kept as a document");
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
