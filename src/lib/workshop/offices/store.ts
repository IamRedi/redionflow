import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { effectiveSessionHours, isReportableSession } from "@/lib/workzone/session-rules";
import { monthRange } from "@/lib/workzone/date-utils";
import { workshopDay } from "../demo-model";
import { digest, requireWorkshopDemo, SharedWorkshopError } from "../shared-store";
import { prepareDemoFile } from "../shared-files";
import { demoOfficeActor } from "./access";
import { canReadDocument, emptyOfficeState, officeCapabilities, officeMonth, officeStateSchema, officeVisibleState, type officeEnvelope, type OfficeRole, type OfficeState } from "./model";
import type { z } from "zod";

export const OFFICE_WORKSPACE_KEY = "baumdienst-offices:v1";
const json = (value: OfficeState) => value as unknown as Prisma.InputJsonValue;
export async function readOfficeState(tx: Prisma.TransactionClient = prisma) {
  await requireWorkshopDemo(tx);
  const row = await tx.baumdienstDemoWorkspace.findUnique({ where: { key: OFFICE_WORKSPACE_KEY } });
  return { state: officeStateSchema.parse(row?.data ?? emptyOfficeState()), revision: row?.revision ?? 0 };
}
export async function officeStaff(companyId: string, month: string) {
  const { start, end } = monthRange(officeMonth.parse(month));
  if (await prisma.worker.count({ where: { companyProfileId: companyId } }) > 200 || await prisma.workSession.count({ where: { worker: { companyProfileId: companyId }, startTime: { gte: start, lt: end } } }) > 20000) throw new SharedWorkshopError("storage", 413);
  const workers = await prisma.worker.findMany({ where: { companyProfileId: companyId }, orderBy: [{ firstName: "asc" }, { id: "asc" }], select: { id: true, firstName: true, lastName: true, position: true, availability: true, vacationAllowanceDays: true, sessions: { where: { startTime: { gte: start, lt: end } }, select: { startTime: true, endTime: true, breakMinutes: true, totalHours: true } } } });
  const now = new Date();
  return workers.map(w => { const sessions = w.sessions.filter(isReportableSession); return { id: w.id, name: `${w.firstName} ${w.lastName}`, position: w.position ?? "", availability: w.availability, vacationAllowanceDays: w.vacationAllowanceDays, hours: Math.round(sessions.reduce((sum, s) => sum + effectiveSessionHours(s, now), 0) * 100) / 100, sessionCount: sessions.length, provisional: sessions.some(s => !s.endTime) }; });
}
export async function officeSnapshot(room?: OfficeRole, month = workshopDay(new Date().toISOString()).slice(0, 7)) {
  const actor = await demoOfficeActor(), { state, revision } = await readOfficeState();
  const capabilities = officeCapabilities(actor.role), own = !room || room === actor.role;
  const visible = officeVisibleState(state, actor.role);
  const ids = own ? visible.documents.map(d => d.id) : [];
  const files = ids.length ? await prisma.baumdienstDemoFile.findMany({ where: { workspaceKey: OFFICE_WORKSPACE_KEY, id: { in: ids } }, select: { id: true, name: true, mime: true, bytes: true } }) : [];
  const sites = await prisma.baustelle.findMany({ where: { companyProfileId: actor.companyId }, select: { id: true, name: true, address: true }, orderBy: { name: "asc" }, take: 201 });
  if (sites.length > 200) throw new SharedWorkshopError("storage", 413);
  return { actor: actor.role, own, capabilities, revision, month, asOf: new Date().toISOString(), sites, ...(own ? visible : { folders: [], documents: [], tasks: [], inquiries: [], quotes: [], turns: [], events: [] }), files: files.map(f => ({ ...f, url: `/api/demo/baumdienst/offices/files/${f.id}` })), workers: own && capabilities.staff ? await officeStaff(actor.companyId, month) : [], ai: { enabled: process.env.BAUMDIENST_OFFICE_AI_ENABLED === "true" && Boolean(process.env.BAUMDIENST_IMAGE_OPENAI_API_KEY), limit: 20, used: state.turns.filter(t => t.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length } };
}
/** Same tenant, revision/receipt and bounded-store discipline as Werkstatt and wood. */
export async function mutateOffice(input: { requestId: string; revision: number }, fingerprint: string, apply: (tx: Prisma.TransactionClient, state: OfficeState, role: OfficeRole, at: string) => Promise<void>) {
  const actor = await demoOfficeActor();
  return prisma.$transaction(async tx => {
    await requireWorkshopDemo(tx);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${OFFICE_WORKSPACE_KEY}))`;
    await tx.baumdienstDemoWorkspace.upsert({ where: { key: OFFICE_WORKSPACE_KEY }, update: {}, create: { key: OFFICE_WORKSPACE_KEY, data: json(emptyOfficeState()), revision: 0 } });
    const { state, revision } = await readOfficeState(tx);
    const receipt = await tx.baumdienstDemoMutation.findUnique({ where: { id: input.requestId } });
    const scoped = digest(JSON.stringify([actor.role, fingerprint]));
    if (receipt) { if (receipt.workspaceKey !== OFFICE_WORKSPACE_KEY || receipt.fingerprint !== scoped) throw new SharedWorkshopError("conflict", 409); return { ok: true, replay: true, revision, ref: state.events.find(e => e.id === input.requestId)?.ref }; }
    if (revision !== input.revision) throw new SharedWorkshopError("conflict", 409);
    if (await tx.baumdienstDemoMutation.count({ where: { workspaceKey: OFFICE_WORKSPACE_KEY, createdAt: { gte: new Date(Date.now() - 60000) } } }) >= 60) throw new SharedWorkshopError("busy", 429);
    await apply(tx, state, actor.role, new Date().toISOString());
    const checked = officeStateSchema.parse(state);
    if (Buffer.byteLength(JSON.stringify(checked)) > 4_000_000) throw new SharedWorkshopError("storage", 413);
    await tx.baumdienstDemoWorkspace.update({ where: { key: OFFICE_WORKSPACE_KEY }, data: { data: json(checked), revision: { increment: 1 } } });
    await tx.baumdienstDemoMutation.create({ data: { id: input.requestId, workspaceKey: OFFICE_WORKSPACE_KEY, fingerprint: scoped, revision: revision + 1 } });
    return { ok: true, replay: false, revision: revision + 1, ref: state.events.find(e => e.id === input.requestId)?.ref };
  }, { maxWait: 10000, timeout: 15000 });
}
export async function officeCommand(input: z.infer<typeof officeEnvelope>) {
  return mutateOffice(input, digest(JSON.stringify(input.command)), async (tx, state, role, at) => {
    const c = input.command, caps = officeCapabilities(role), id = input.requestId;
    let kind: OfficeState["events"][number]["kind"] = "task", ref: string = id;
    if (c.type === "folder") { if (state.folders.some(f => f.owner === role && !f.archived && f.name.normalize("NFKC").trim().toLowerCase() === c.name.normalize("NFKC").trim().toLowerCase())) throw new SharedWorkshopError("duplicate", 409); state.folders.push({ id, owner: role, name: c.name, archived: false }); kind = "folder"; }
    else if (c.type === "task") state.tasks.push({ id, owner: role, title: c.title, text: c.text, status: "todo", archived: false, at });
    else if (c.type === "task-status") { const task = state.tasks.find(t => t.id === c.id && t.owner === role && !t.archived); if (!task) throw new SharedWorkshopError("missing", 404); task.status = c.status; ref = task.id; }
    else if (c.type === "archive") {
      const list = c.kind === "folder" ? state.folders : c.kind === "document" ? state.documents : state.tasks;
      const item = list.find(f => f.id === c.id && f.owner === role); if (!item) throw new SharedWorkshopError("missing", 404);
      item.archived = c.archived; ref = item.id; kind = c.kind === "folder" ? "folder" : c.kind === "document" ? "file" : "task";
    } else if (c.type === "inquiry") {
      if (!caps.inquiries) throw new SharedWorkshopError("permission", 403);
      state.inquiries.push({ id, createdBy: role, client: c.client, contact: c.contact, address: c.address, description: c.description, at }); kind = "inquiry";
    } else if (c.type === "quote") {
      if (!caps.quote) throw new SharedWorkshopError("permission", 403);
      if (c.quote.inquiryId && !state.inquiries.some(i => i.id === c.quote.inquiryId)) throw new SharedWorkshopError("missing", 404);
      state.quotes.push({ ...c.quote, id, owner: role, at }); kind = "quote";
    } else if (c.type === "site") {
      if (!caps.site) throw new SharedWorkshopError("permission", 403);
      if (new Set(c.fileIds).size !== c.fileIds.length || c.fileIds.length && !c.shareWithSite) throw new SharedWorkshopError("required");
      const inquiry = c.inquiryId ? state.inquiries.find(i => i.id === c.inquiryId) : undefined;
      if (c.inquiryId && !inquiry) throw new SharedWorkshopError("missing", 404);
      if (inquiry?.siteId) throw new SharedWorkshopError("duplicate", 409);
      const company = await requireWorkshopDemo(tx);
      const sites = await tx.baustelle.findMany({ where: { companyProfileId: company.id }, select: { name: true } });
      if (sites.length >= 200) throw new SharedWorkshopError("storage", 413);
      const normalize = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
      if (sites.some(s => normalize(s.name) === normalize(c.name))) throw new SharedWorkshopError("duplicate", 409);
      const docs = c.fileIds.map(fileId => state.documents.find(d => d.id === fileId && !d.archived && canReadDocument(d, role)));
      if (docs.some(d => !d)) throw new SharedWorkshopError("permission", 403);
      const site = await tx.baustelle.create({ data: { id: `bdf-office-${randomUUID()}`, companyProfileId: company.id, name: c.name, type: c.method, status: "active", address: c.address || null, description: c.description || null, documents: [] } });
      state.sites.push({ id: site.id, name: c.name, address: c.address, description: c.description, method: c.method, at });
      for (const d of docs) d!.siteIds.push(site.id);
      if (inquiry) inquiry.siteId = site.id;
      ref = site.id; kind = "site";
    }
    state.events.push({ id, owner: role, kind, ref, at });
  });
}
export async function uploadOfficeFile(input: { requestId: string; revision: number; folderId?: string; shared: boolean }, file: File) {
  await demoOfficeActor();
  const prepared = await prepareDemoFile(file, "document");
  return mutateOffice(input, digest(JSON.stringify(["upload", input.folderId, input.shared, prepared.name, digest(prepared.data)])), async (tx, state, role, at) => {
    if (input.folderId && !state.folders.some(f => f.id === input.folderId && f.owner === role && !f.archived)) throw new SharedWorkshopError("permission", 403);
    const previous = await tx.baumdienstDemoFile.findMany({ where: { workspaceKey: OFFICE_WORKSPACE_KEY, target: role, name: prepared.name, mime: prepared.mime, bytes: prepared.data.length }, select: { data: true } });
    if (previous.some(f => digest(f.data) === digest(prepared.data))) throw new SharedWorkshopError("duplicate", 409);
    const usage = await tx.baumdienstDemoFile.aggregate({ where: { workspaceKey: OFFICE_WORKSPACE_KEY }, _count: true, _sum: { bytes: true } });
    if (usage._count >= 200 || (usage._sum.bytes ?? 0) + prepared.data.length > 30_000_000) throw new SharedWorkshopError("storage", 413);
    // One original blob. Worksite links later point to this same identity.
    await tx.baumdienstDemoFile.create({ data: { id: input.requestId, workspaceKey: OFFICE_WORKSPACE_KEY, kind: "document", target: role, name: prepared.name, mime: prepared.mime, bytes: prepared.data.length, data: prepared.data } });
    state.documents.push({ id: input.requestId, owner: role, folderId: input.folderId, shared: input.shared, archived: false, siteIds: [], at });
    state.events.push({ id: input.requestId, owner: role, kind: "file", ref: input.requestId, at });
  });
}
export async function officeSiteFiles(siteId: string) {
  const company = await requireWorkshopDemo();
  if (!await prisma.baustelle.findFirst({ where: { id: siteId, companyProfileId: company.id }, select: { id: true } })) throw new SharedWorkshopError("missing", 404);
  const { state } = await readOfficeState(), ids = state.documents.filter(d => d.siteIds.includes(siteId)).map(d => d.id);
  return prisma.baumdienstDemoFile.findMany({ where: { workspaceKey: OFFICE_WORKSPACE_KEY, id: { in: ids } }, select: { id: true, name: true, mime: true, bytes: true } });
}
export async function officeFile(fileId: string, siteId?: string) {
  const { state } = await readOfficeState(), doc = state.documents.find(d => d.id === fileId);
  if (!doc) throw new SharedWorkshopError("missing", 404);
  if (siteId) { if (!(await officeSiteFiles(siteId)).some(f => f.id === fileId)) throw new SharedWorkshopError("permission", 403); }
  else if (!canReadDocument(doc, (await demoOfficeActor()).role)) throw new SharedWorkshopError("permission", 403);
  const file = await prisma.baumdienstDemoFile.findFirst({ where: { workspaceKey: OFFICE_WORKSPACE_KEY, id: fileId } });
  if (!file) throw new SharedWorkshopError("missing", 404);
  return file;
}
