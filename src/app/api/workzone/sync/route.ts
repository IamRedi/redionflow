import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { totalWorkHours } from "@/lib/workzone/session-rules";
import type { SyncActionResult, SyncResponse, WorkzoneActorKind } from "@/lib/workzone/offline/types";

type SyncLang = "de" | "en" | "it" | "sq";

function normalizeSyncLang(lang: string): SyncLang {
  return lang === "en" || lang === "it" || lang === "sq" ? lang : "de";
}

function syncMessages(lang: string) {
  const selected = normalizeSyncLang(lang);
  const messages = {
    de: {
      unauthorized: "Anmeldung erforderlich.",
      invalidJsonBody: "JSON-Inhalt ist ungueltig.",
      invalidRequestPayload: "Sync-Anfrage ist ungueltig.",
      invalidPayload: (type: string) => `Ungueltige ${type}-Daten.`,
      workerMismatch: "Worker passt nicht zur angemeldeten Session.",
      workerNotActive: "Worker ist nicht aktiv.",
      workerNotFoundOrCompanyMismatch: "Worker wurde nicht gefunden oder gehoert nicht zu dieser Firma.",
      companyMismatch: "Firma passt nicht zur angemeldeten Session.",
      companyMismatchTarget: "Aktion gehoert zu einer anderen Firma.",
      actorMismatch: "Akteur passt nicht zur angemeldeten Session.",
      actorMismatchTarget: "Akteur der Aktion passt nicht zur angemeldeten Session.",
      siteNotFound: "Baustelle wurde nicht gefunden.",
      siteNoLongerActive: "Baustelle ist nicht mehr aktiv.",
      sessionAlreadyActiveOnSite: "Session ist auf dieser Baustelle bereits aktiv.",
      sessionAlreadyClosed: "Session ist bereits beendet.",
      endBeforeStart: "Endzeit liegt vor oder gleich der Startzeit.",
      treeNotFoundDeleted: "Baum wurde nicht gefunden oder wurde geloescht.",
      treeStatusAlreadyMatches: "Baumstatus entspricht bereits dem gewuenschten Stand.",
      noOfficeUser: "Kein Office-User gefunden.",
      taskNotFoundRemoved: "Aufgabe wurde nicht gefunden oder ist bereits entfernt.",
      taskAlreadyCleared: "Aufgabe ist bereits erledigt.",
      treeItemNotFoundOnSite: "Baum wurde auf dieser Baustelle nicht gefunden.",
      noQuantityChange: "Keine Mengenaenderung.",
      inventoryCatalogMissing: "Inventarposition wurde nicht gefunden.",
      insufficientStock: "Nicht genug Bestand verfuegbar.",
      quantityPositive: "Menge muss positiv sein.",
      collectExceedsOnSite: "Rueckgabemenge ist groesser als Menge vor Ort.",
      unsupportedAction: (type: string) => `Aktionstyp "${type}" wird von dieser Serverversion noch nicht unterstuetzt.`,
      legacyNoteAuthor: "Notiz",
    },
    en: {
      unauthorized: "Sign-in required.",
      invalidJsonBody: "Invalid JSON body.",
      invalidRequestPayload: "Invalid sync request.",
      invalidPayload: (type: string) => `Invalid ${type} payload.`,
      workerMismatch: "Worker does not match the signed-in session.",
      workerNotActive: "Worker is not active.",
      workerNotFoundOrCompanyMismatch: "Worker was not found or does not belong to this company.",
      companyMismatch: "Company does not match the signed-in session.",
      companyMismatchTarget: "Action targets a different company.",
      actorMismatch: "Actor does not match the signed-in session.",
      actorMismatchTarget: "Action actor does not match the signed-in session.",
      siteNotFound: "Site was not found.",
      siteNoLongerActive: "Site is no longer active.",
      sessionAlreadyActiveOnSite: "Session is already active on this site.",
      sessionAlreadyClosed: "Session is already ended.",
      endBeforeStart: "End time is before or equal to start time.",
      treeNotFoundDeleted: "Tree was not found or may have been deleted.",
      treeStatusAlreadyMatches: "Tree status already matches the requested state.",
      noOfficeUser: "No office user found.",
      taskNotFoundRemoved: "Task was not found or is already removed.",
      taskAlreadyCleared: "Task is already cleared.",
      treeItemNotFoundOnSite: "Tree item was not found on this site.",
      noQuantityChange: "No quantity change.",
      inventoryCatalogMissing: "Inventory catalog entry was not found.",
      insufficientStock: "Insufficient stock.",
      quantityPositive: "Quantity must be positive.",
      collectExceedsOnSite: "Collect quantity exceeds on-site quantity.",
      unsupportedAction: (type: string) => `Action type "${type}" is not yet supported by this server version.`,
      legacyNoteAuthor: "Note",
    },
    it: {
      unauthorized: "Accesso richiesto.",
      invalidJsonBody: "Corpo JSON non valido.",
      invalidRequestPayload: "Richiesta di sincronizzazione non valida.",
      invalidPayload: (type: string) => `Dati ${type} non validi.`,
      workerMismatch: "Il worker non corrisponde alla sessione collegata.",
      workerNotActive: "Il worker non e attivo.",
      workerNotFoundOrCompanyMismatch: "Worker non trovato o non appartenente a questa azienda.",
      companyMismatch: "L'azienda non corrisponde alla sessione collegata.",
      companyMismatchTarget: "L'azione punta a un'altra azienda.",
      actorMismatch: "L'attore non corrisponde alla sessione collegata.",
      actorMismatchTarget: "L'attore dell'azione non corrisponde alla sessione collegata.",
      siteNotFound: "Cantiere non trovato.",
      siteNoLongerActive: "Il cantiere non e piu attivo.",
      sessionAlreadyActiveOnSite: "La sessione e gia attiva su questo cantiere.",
      sessionAlreadyClosed: "La sessione e gia terminata.",
      endBeforeStart: "L'ora di fine e precedente o uguale all'inizio.",
      treeNotFoundDeleted: "Albero non trovato o forse eliminato.",
      treeStatusAlreadyMatches: "Lo stato dell'albero corrisponde gia alla richiesta.",
      noOfficeUser: "Nessun utente ufficio trovato.",
      taskNotFoundRemoved: "Attivita non trovata o gia rimossa.",
      taskAlreadyCleared: "Attivita gia completata.",
      treeItemNotFoundOnSite: "Albero non trovato su questo cantiere.",
      noQuantityChange: "Nessuna modifica quantita.",
      inventoryCatalogMissing: "Voce inventario non trovata.",
      insufficientStock: "Scorte insufficienti.",
      quantityPositive: "La quantita deve essere positiva.",
      collectExceedsOnSite: "La quantita da raccogliere supera quella in cantiere.",
      unsupportedAction: (type: string) => `Il tipo di azione "${type}" non e ancora supportato da questa versione del server.`,
      legacyNoteAuthor: "Nota",
    },
    sq: {
      unauthorized: "Duhet te hysh.",
      invalidJsonBody: "JSON i pavlefshem.",
      invalidRequestPayload: "Kerkese sinkronizimi e pavlefshme.",
      invalidPayload: (type: string) => `Te dhena ${type} te pavlefshme.`,
      workerMismatch: "Workeri nuk perputhet me sesionin e loguar.",
      workerNotActive: "Workeri nuk eshte aktiv.",
      workerNotFoundOrCompanyMismatch: "Workeri nuk u gjet ose nuk i perket kesaj firme.",
      companyMismatch: "Firma nuk perputhet me sesionin e loguar.",
      companyMismatchTarget: "Veprimi i perket nje firme tjeter.",
      actorMismatch: "Aktori nuk perputhet me sesionin e loguar.",
      actorMismatchTarget: "Aktori i veprimit nuk perputhet me sesionin e loguar.",
      siteNotFound: "Kantieri nuk u gjet.",
      siteNoLongerActive: "Kantieri nuk eshte me aktiv.",
      sessionAlreadyActiveOnSite: "Sesioni eshte tashme aktiv ne kete kantier.",
      sessionAlreadyClosed: "Sesioni eshte tashme i mbyllur.",
      endBeforeStart: "Ora e mbarimit eshte para ose e barabarte me fillimin.",
      treeNotFoundDeleted: "Dru nuk u gjet ose mund te jete fshire.",
      treeStatusAlreadyMatches: "Statusi i drurit perputhet tashme me kerkesen.",
      noOfficeUser: "Nuk u gjet user zyre.",
      taskNotFoundRemoved: "Detyra nuk u gjet ose eshte hequr tashme.",
      taskAlreadyCleared: "Detyra eshte tashme e perfunduar.",
      treeItemNotFoundOnSite: "Dru nuk u gjet ne kete kantier.",
      noQuantityChange: "Sasia nuk ndryshoi.",
      inventoryCatalogMissing: "Artikulli i inventarit nuk u gjet.",
      insufficientStock: "Nuk ka mjaftueshem gjendje.",
      quantityPositive: "Sasia duhet te jete pozitive.",
      collectExceedsOnSite: "Sasia per kthim eshte me e madhe se sasia ne kantier.",
      unsupportedAction: (type: string) => `Tipi i veprimit "${type}" nuk mbeshtetet ende nga ky version i serverit.`,
      legacyNoteAuthor: "Shenim",
    },
  } as const;
  return messages[selected];
}

type SyncMessages = ReturnType<typeof syncMessages>;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const actorKindEnum = z.enum(["WORKER", "ADMIN"] satisfies [WorkzoneActorKind, WorkzoneActorKind]);

const entityTypeEnum = z.enum([
  "WORKER",
  "BAUSTELLE",
  "TREE",
  "MANUAL_TASK",
  "WORK_SESSION",
  "INVENTORY",
]);

const actionTypeEnum = z.enum([
  "START_WORK",
  "STOP_WORK",
  "CHECK_TREE",
  "UNDO_TREE",
  "ADD_MANUAL_TASK",
  "CLEAR_MANUAL_TASK",
  "ADD_REPORT_NOTE",
  "SITE_EQUIPMENT_MOVEMENT",
  "UPLOAD_DOCUMENT",
]);

const pendingActionSchema = z.object({
  id: z.string().uuid(),
  type: actionTypeEnum,
  actorKind: actorKindEnum,
  actorId: z.string().min(1).max(128),
  companyProfileId: z.string().min(1).max(128),
  entityType: entityTypeEnum,
  entityId: z.string().min(1).max(256),
  payload: z.unknown(),
  baseUpdatedAt: z.string().datetime().optional(),
  baseVersion: z.string().optional(),
  clientCreatedAt: z.string().datetime(),
});

const syncRequestSchema = z.object({
  actions: z.array(pendingActionSchema).min(1).max(50),
});

const startWorkPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  startTime: z.string().datetime().optional(),
});

const stopWorkPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  endTime: z.string().datetime().optional(),
  breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
});

const checkTreePayloadSchema = z.object({
  treeItemId: z.string().min(1),
  workerId: z.string().min(1),
  baustelleId: z.string().min(1),
  done: z.boolean(),
});

const addManualTaskPayloadSchema = z.object({
  baustelleId: z.string().min(1),
  workerId: z.string().min(1),
  description: z.string().min(1).max(2000),
});

const clearManualTaskPayloadSchema = z.object({
  taskId: z.string().min(1),
  workerId: z.string().min(1),
  baustelleId: z.string().min(1),
});

const addReportNotePayloadSchema = z.object({
  workerId: z.string().min(1),
  type: z.enum(["DAILY", "MONTHLY"]),
  periodKey: z.string().min(1).max(32),
  note: z.string().min(1).max(10_000),
});

const siteEquipmentMovementPayloadSchema = z.object({
  movementType: z.enum(["REQUEST", "DEPLOY", "COLLECT", "SET_QUANTITY"]),
  baustelleId: z.string().min(1),
  category: z.enum(["SIGN", "PLATE", "FENCE"]),
  quantity: z.coerce.number().int().min(1).optional(),
  targetQuantity: z.coerce.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
  workerId: z.string().min(1),
  treeItemId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

type AuthContext =
  | { kind: "WORKER"; id: string; companyProfileId: string }
  | { kind: "ADMIN"; id: string; companyProfileId: string };

async function resolveAuthContext(): Promise<AuthContext | null> {
  const worker = await getCurrentWorker();
  if (worker?.status === "active") {
    return { kind: "WORKER", id: worker.id, companyProfileId: worker.companyProfileId };
  }

  const admin = await getCurrentAdmin();
  if (admin) {
    const company = await prisma.companyProfile.findFirst({ select: { id: true } });
    if (company) return { kind: "ADMIN", id: admin.id, companyProfileId: company.id };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Idempotency log
// ---------------------------------------------------------------------------

async function findExistingOutcome(actionId: string): Promise<SyncActionResult | null> {
  const existing = await prisma.workzoneSyncAction.findUnique({
    where: { id: actionId },
    select: { outcome: true, outcomeMsg: true },
  });
  if (!existing) return null;
  return {
    id: actionId,
    outcome: existing.outcome as SyncActionResult["outcome"],
    message: existing.outcomeMsg ?? undefined,
  };
}

async function recordOutcome(
  actionId: string,
  auth: AuthContext,
  action: z.infer<typeof pendingActionSchema>,
  outcome: SyncActionResult["outcome"],
  outcomeMsg?: string,
): Promise<void> {
  await prisma.workzoneSyncAction.create({
    data: {
      id: actionId,
      companyProfileId: auth.companyProfileId,
      actorKind: auth.kind,
      actorId: auth.id,
      actionType: action.type,
      entityType: action.entityType,
      entityId: action.entityId,
      payload: action.payload ?? {},
      outcome,
      outcomeMsg: outcomeMsg ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Action processors
// ---------------------------------------------------------------------------

async function processStartWork(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = startWorkPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("START_WORK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId } = payload.data;
  const startTime = payload.data.startTime ? new Date(payload.data.startTime) : new Date();

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const [worker, baustelle] = await Promise.all([
    prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, status: true, availability: true, companyProfileId: true } }),
    prisma.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true, isActive: true } }),
  ]);

  if (!worker || worker.status !== "active") {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotActive);
    return { id: action.id, outcome: "rejected", message: m.workerNotActive };
  }

  if (worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!baustelle || !baustelle.isActive) {
    const msg = !baustelle ? m.siteNotFound : m.siteNoLongerActive;
    await recordOutcome(action.id, auth, action, "conflict", msg);
    return { id: action.id, outcome: "conflict", message: msg };
  }

  const existing = await prisma.workSession.findFirst({
    where: { workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (existing) {
    if (existing.baustelleId === baustelleId) {
      await recordOutcome(action.id, auth, action, "noop", m.sessionAlreadyActiveOnSite);
      return { id: action.id, outcome: "noop", message: m.sessionAlreadyActiveOnSite };
    }
    await prisma.workSession.update({
      where: { id: existing.id },
      data: { baustelleId, startTime: existing.startTime, endTime: null, isLive: true, closedBySystem: false, systemNote: null },
    });
  } else {
    await prisma.workSession.create({
      data: { workerId, baustelleId, startTime, endTime: null, breakMinutes: 30, isLive: true },
    });
  }

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

async function processStopWork(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = stopWorkPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("STOP_WORK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId } = payload.data;
  const endTime = payload.data.endTime ? new Date(payload.data.endTime) : new Date();
  const breakMinutes = payload.data.breakMinutes ?? 30;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, companyProfileId: true },
  });

  if (!worker || worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotFoundOrCompanyMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerNotFoundOrCompanyMismatch };
  }

  const existing = await prisma.workSession.findFirst({
    where: { baustelleId, workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (!existing) {
    // Session was already closed (e.g. auto-closed by the system) — treat as noop
    await recordOutcome(action.id, auth, action, "noop", m.sessionAlreadyClosed);
    return { id: action.id, outcome: "noop", message: m.sessionAlreadyClosed };
  }

  if (endTime <= existing.startTime) {
    const msg = m.endBeforeStart;
    await recordOutcome(action.id, auth, action, "conflict", msg);
    return { id: action.id, outcome: "conflict", message: msg };
  }

  await prisma.workSession.update({
    where: { id: existing.id },
    data: { baustelleId: null },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

async function processCheckTree(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = checkTreePayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("CHECK_TREE");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { treeItemId, workerId, done } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const tree = await prisma.treeItem.findUnique({
    where: { id: treeItemId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      baustelle: { select: { id: true, companyProfileId: true, isActive: true } },
    },
  });

  if (!tree) {
    await recordOutcome(action.id, auth, action, "conflict", m.treeNotFoundDeleted);
    return { id: action.id, outcome: "conflict", message: m.treeNotFoundDeleted };
  }

  if (tree.baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!tree.baustelle.isActive) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNoLongerActive);
    return { id: action.id, outcome: "conflict", message: m.siteNoLongerActive };
  }

  // Idempotent: desired state already matches server state
  if ((done && tree.status === "done") || (!done && tree.status === "todo")) {
    await recordOutcome(action.id, auth, action, "noop", m.treeStatusAlreadyMatches);
    return { id: action.id, outcome: "noop", message: m.treeStatusAlreadyMatches };
  }

  await prisma.treeItem.update({
    where: { id: treeItemId },
    data: done
      ? { status: "done", completedAt: new Date(), completedBy: null, completedByWorkerId: workerId }
      : { status: "todo", completedAt: null, completedBy: null, completedByWorkerId: null },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

async function processAddManualTask(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = addManualTaskPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("ADD_MANUAL_TASK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { baustelleId, workerId, description } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, isActive: true },
  });

  if (!baustelle) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNotFound);
    return { id: action.id, outcome: "conflict", message: m.siteNotFound };
  }

  if (baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  const systemUser = await prisma.user.findFirst({
    where: { companyProfileId: auth.companyProfileId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true },
  });
  if (!systemUser) {
    return { id: action.id, outcome: "retryable_error", message: m.noOfficeUser };
  }

  await prisma.manualTask.create({
    data: {
      baustelleId,
      userId: systemUser.id,
      workerId,
      description: description.trim(),
      isFlagged: true,
    },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

async function processClearManualTask(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = clearManualTaskPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("CLEAR_MANUAL_TASK");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { taskId, workerId } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const task = await prisma.manualTask.findUnique({
    where: { id: taskId },
    select: { id: true, isFlagged: true, baustelle: { select: { companyProfileId: true } } },
  });

  if (!task) {
    // Task was deleted — treat as noop, the end state is the same
    await recordOutcome(action.id, auth, action, "noop", m.taskNotFoundRemoved);
    return { id: action.id, outcome: "noop", message: m.taskNotFoundRemoved };
  }

  if (task.baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  if (!task.isFlagged) {
    // Already cleared — idempotent noop
    await recordOutcome(action.id, auth, action, "noop", m.taskAlreadyCleared);
    return { id: action.id, outcome: "noop", message: m.taskAlreadyCleared };
  }

  await prisma.manualTask.update({
    where: { id: taskId },
    data: {
      isFlagged: false,
      resolvedAt: new Date(),
      resolvedByWorkerId: workerId,
      resolvedByUserId: null,
    },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

async function processAddReportNote(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = addReportNotePayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("ADD_REPORT_NOTE");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { workerId, type, periodKey, note } = payload.data;
  const text = note.trim();

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, lastName: true, companyProfileId: true },
  });

  if (!worker || worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotFoundOrCompanyMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerNotFoundOrCompanyMismatch };
  }

  const existing = await prisma.workReportNote.findUnique({
    where: { workerId_type_periodKey: { workerId, type, periodKey } },
  });

  function parseMessages(raw: string | null | undefined): unknown[] {
    if (!raw) return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : Array.isArray((p as Record<string, unknown>)?.messages) ? (p as Record<string, unknown[]>).messages : [];
    } catch {
      return raw.trim() ? [{ id: "legacy", authorName: m.legacyNoteAuthor, authorRole: "System", text: raw, createdAt: "" }] : [];
    }
  }

  const messages = [
    ...parseMessages(existing?.note),
    {
      id: crypto.randomUUID(),
      authorName: `${worker.firstName} ${worker.lastName}`.trim(),
      authorRole: "Worker",
      text,
      createdAt: action.clientCreatedAt,
    },
  ];

  await prisma.workReportNote.upsert({
    where: { workerId_type_periodKey: { workerId, type, periodKey } },
    create: { workerId, type, periodKey, note: JSON.stringify(messages) },
    update: { note: JSON.stringify(messages) },
  });

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

function parseSiteEquipmentStatus(value: unknown): Record<string, { requested: boolean; quantity: number; workerId: string; workerName: string; dateSet: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map = value as Record<string, unknown>;
  const next: Record<string, { requested: boolean; quantity: number; workerId: string; workerName: string; dateSet: string }> = {};
  for (const cat of ["SIGN", "PLATE", "FENCE"]) {
    const row = map[cat];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    next[cat] = {
      requested: Boolean(r.requested),
      quantity: Math.max(0, Number(r.quantity ?? 0) || 0),
      workerId: String(r.workerId ?? ""),
      workerName: String(r.workerName ?? ""),
      dateSet: String(r.dateSet ?? ""),
    };
  }
  return next;
}

async function processSiteEquipmentMovement(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  const payload = siteEquipmentMovementPayloadSchema.safeParse(action.payload);
  if (!payload.success) {
    const msg = m.invalidPayload("SITE_EQUIPMENT_MOVEMENT");
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  const { movementType, baustelleId, category, workerId, treeItemId, quantity, targetQuantity, note } = payload.data;

  if (auth.kind === "WORKER" && auth.id !== workerId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerMismatch };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, lastName: true, companyProfileId: true },
  });

  if (!worker || worker.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.workerNotFoundOrCompanyMismatch);
    return { id: action.id, outcome: "rejected", message: m.workerNotFoundOrCompanyMismatch };
  }

  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, isActive: true, activeEquipmentStatus: true },
  });

  if (!baustelle) {
    await recordOutcome(action.id, auth, action, "conflict", m.siteNotFound);
    return { id: action.id, outcome: "conflict", message: m.siteNotFound };
  }

  if (baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(action.id, auth, action, "rejected", m.companyMismatch);
    return { id: action.id, outcome: "rejected", message: m.companyMismatch };
  }

  const treeItem = treeItemId
    ? await prisma.treeItem.findUnique({
        where: { id: treeItemId },
        select: { id: true, baustelleId: true, siteEquipmentStatus: true },
      })
    : null;

  if (treeItemId && (!treeItem || treeItem.baustelleId !== baustelleId)) {
    await recordOutcome(action.id, auth, action, "conflict", m.treeItemNotFoundOnSite);
    return { id: action.id, outcome: "conflict", message: m.treeItemNotFoundOnSite };
  }

  const actorName = `${worker.firstName} ${worker.lastName}`.trim();
  const rawStatus = treeItem ? treeItem.siteEquipmentStatus : baustelle.activeEquipmentStatus;
  const current = parseSiteEquipmentStatus(rawStatus);

  // baustelle is guaranteed non-null here (early return above handles the null case)
  const nonNullBaustelle = baustelle!;
  async function updateStatus(next: typeof current) {
    if (treeItem) {
      await prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: next } });
    } else {
      await prisma.baustelle.update({ where: { id: nonNullBaustelle.id }, data: { activeEquipmentStatus: next } });
    }
  }

  if (movementType === "REQUEST") {
    const existing = current[category];
    current[category] = {
      requested: true,
      quantity: existing?.quantity ?? 0,
      workerId: existing?.workerId ?? "",
      workerName: existing?.workerName ?? "",
      dateSet: existing?.dateSet ?? "",
    };
    await updateStatus(current);
    await recordOutcome(action.id, auth, action, "synced");
    return { id: action.id, outcome: "synced" };
  }

  if (movementType === "SET_QUANTITY") {
    const target = Math.max(0, Math.floor(Number(targetQuantity ?? 0) || 0));
    const currentQty = current[category]?.quantity ?? 0;
    if (target === 0 && (current[category]?.requested ?? false)) {
      delete current[category];
      await updateStatus(current);
      await recordOutcome(action.id, auth, action, "synced");
      return { id: action.id, outcome: "synced" };
    }
    if (target === currentQty) {
      await recordOutcome(action.id, auth, action, "noop", m.noQuantityChange);
      return { id: action.id, outcome: "noop", message: m.noQuantityChange };
    }
    const delta = target > currentQty ? target - currentQty : currentQty - target;
    const type = target > currentQty ? "DEPLOY" : "COLLECT";
    const catalog = await prisma.companyInventoryCatalog.findFirst({
      where: { companyProfileId: auth.companyProfileId, category, isActive: true },
    });
    if (!catalog) {
      await recordOutcome(action.id, auth, action, "conflict", m.inventoryCatalogMissing);
      return { id: action.id, outcome: "conflict", message: m.inventoryCatalogMissing };
    }
    if (type === "DEPLOY" && catalog.totalQuantity < delta) {
      await recordOutcome(action.id, auth, action, "conflict", m.insufficientStock);
      return { id: action.id, outcome: "conflict", message: m.insufficientStock };
    }
    const nextQty = target;
    if (nextQty <= 0) {
      delete current[category];
    } else {
      current[category] = { requested: false, quantity: nextQty, workerId, workerName: actorName, dateSet: new Date().toISOString() };
    }
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({
        where: { id: catalog.id },
        data: { totalQuantity: type === "DEPLOY" ? { decrement: delta } : { increment: delta } },
      }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: delta,
          type,
          note: note?.trim() || null,
        },
      }),
    ]);
    await recordOutcome(action.id, auth, action, "synced");
    return { id: action.id, outcome: "synced" };
  }

  // DEPLOY or COLLECT
  const qty = Math.floor(Number(quantity ?? 0) || 0);
  if (qty <= 0) {
    await recordOutcome(action.id, auth, action, "rejected", m.quantityPositive);
    return { id: action.id, outcome: "rejected", message: m.quantityPositive };
  }

  const catalog = await prisma.companyInventoryCatalog.findFirst({
    where: { companyProfileId: auth.companyProfileId, category, isActive: true },
  });

  if (!catalog) {
    await recordOutcome(action.id, auth, action, "conflict", m.inventoryCatalogMissing);
    return { id: action.id, outcome: "conflict", message: m.inventoryCatalogMissing };
  }

  if (movementType === "DEPLOY") {
    if (catalog.totalQuantity < qty) {
      await recordOutcome(action.id, auth, action, "conflict", m.insufficientStock);
      return { id: action.id, outcome: "conflict", message: m.insufficientStock };
    }
    const existing = current[category];
    current[category] = {
      requested: false,
      quantity: (existing?.quantity ?? 0) + qty,
      workerId,
      workerName: actorName,
      dateSet: new Date().toISOString(),
    };
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({ where: { id: catalog.id }, data: { totalQuantity: { decrement: qty } } }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: qty,
          type: "DEPLOY",
          note: note?.trim() || null,
        },
      }),
    ]);
  } else {
    // COLLECT
    const onSite = current[category]?.quantity ?? 0;
    if (onSite < qty) {
      await recordOutcome(action.id, auth, action, "conflict", m.collectExceedsOnSite);
      return { id: action.id, outcome: "conflict", message: m.collectExceedsOnSite };
    }
    const remaining = onSite - qty;
    if (remaining <= 0) {
      delete current[category];
    } else {
      current[category] = {
        requested: false,
        quantity: remaining,
        workerId: current[category]?.workerId ?? "",
        workerName: current[category]?.workerName ?? "",
        dateSet: current[category]?.dateSet ?? new Date().toISOString(),
      };
    }
    await prisma.$transaction([
      prisma.companyInventoryCatalog.update({ where: { id: catalog.id }, data: { totalQuantity: { increment: qty } } }),
      treeItem
        ? prisma.treeItem.update({ where: { id: treeItem.id }, data: { siteEquipmentStatus: current } })
        : prisma.baustelle.update({ where: { id: baustelle.id }, data: { activeEquipmentStatus: current } }),
      prisma.inventoryMovement.create({
        data: {
          companyProfileId: auth.companyProfileId,
          baustelleId,
          workerId,
          actorAdminId: null,
          actorRole: "WORKER",
          actorName,
          treeItemId: treeItem?.id ?? null,
          category,
          quantity: qty,
          type: "COLLECT",
          note: note?.trim() || null,
        },
      }),
    ]);
  }

  await recordOutcome(action.id, auth, action, "synced");
  return { id: action.id, outcome: "synced" };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function processAction(
  action: z.infer<typeof pendingActionSchema>,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  if (action.actorKind !== auth.kind || action.actorId !== auth.id) {
    const msg = m.actorMismatchTarget;
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  if (action.companyProfileId !== auth.companyProfileId) {
    const msg = m.companyMismatchTarget;
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  switch (action.type) {
    case "START_WORK":
      return processStartWork(action, auth, m);
    case "STOP_WORK":
      return processStopWork(action, auth, m);
    case "CHECK_TREE":
    case "UNDO_TREE":
      return processCheckTree(action, auth, m);
    case "ADD_MANUAL_TASK":
      return processAddManualTask(action, auth, m);
    case "CLEAR_MANUAL_TASK":
      return processClearManualTask(action, auth, m);
    case "ADD_REPORT_NOTE":
      return processAddReportNote(action, auth, m);
    case "SITE_EQUIPMENT_MOVEMENT":
      return processSiteEquipmentMovement(action, auth, m);
    default:
      // UPLOAD_DOCUMENT — Phase 5
      return {
        id: action.id,
        outcome: "retryable_error",
        message: m.unsupportedAction(action.type),
      };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SyncResponse | { ok: false; message: string }>> {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const m = syncMessages(await resolveRequestLanguage());
  const auth = await resolveAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, message: m.unauthorized }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: m.invalidJsonBody }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: m.invalidRequestPayload }, { status: 400 });
  }

  const results: SyncActionResult[] = [];

  for (const action of parsed.data.actions) {
    const existing = await findExistingOutcome(action.id);
    if (existing) {
      results.push(existing);
      continue;
    }

    const result = await processAction(action, auth, m);
    results.push(result);
  }

  return NextResponse.json({ results });
}
