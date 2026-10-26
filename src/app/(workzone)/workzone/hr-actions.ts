"use server";

import { createSessionCookie } from "@/lib/auth/session-cookie";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE, getCurrentAdmin } from "@/lib/auth/admin-session";
import { authenticateWorkerByCode } from "@/lib/auth/authenticate-worker";
import { normalizeAssistantLanguage } from "@/lib/assistant/language";
import { DISPLAY_COOKIE } from "@/lib/auth/display-session";
import { clearFailedLogin, ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { logger } from "@/lib/observability/logger";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { updateNotificationSettings } from "@/lib/notifications/notification-store";
import { sendNotificationToAdmins } from "@/lib/notifications/sendNotification";
import { scanFileContent } from "@/lib/storage/content-scan";
import { validateFileAgainstAllowedCategories } from "@/lib/storage/file-validation";
import { deleteManagedFileByUrl, uploadManagedFile } from "@/lib/storage/object-storage";
import type { ActionResult } from "@/lib/validation/action-result";
import { reportNoteSchema, startWorkSessionSchema, stopWorkSessionSchema, workerLoginSchema } from "@/lib/validation/schemas";
import { closePauseInterval, createPauseInterval, findPauseIntervalsForSession } from "@/lib/workzone/pause-interval-store";
import { monthKey, parseReportMessages, serializeReportMessages, type ReportMessage } from "@/lib/workzone/reporting";
import { hasOpenPause, isTrivialSession, stopBreakMinutes, totalPauseMinutes, totalWorkHours } from "@/lib/workzone/session-rules";
import { getCurrentWorker, WORKER_COOKIE } from "@/lib/workzone/worker-session";

type LoginState = { message?: string };

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseActionDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function monthKeyForDate(value: Date) {
  return monthKey(value);
}

function hhmm(value: Date) {
  return value.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

async function appendAdminTimeEntry(workerId: string, sessionStart: Date, sessionEnd: Date) {
  const lang = await resolveRequestLanguage();
  const periodKey = monthKeyForDate(sessionStart);
  const existing = await prisma.workReportNote.findUnique({
    where: { workerId_type_periodKey: { workerId, type: "MONTHLY", periodKey } },
  });
  const messages = parseReportMessages(existing?.note, lang);
  const nextMessage: ReportMessage = {
    id: crypto.randomUUID(),
    authorName: "Admin",
    authorRole: "Admin",
    // Structured marker for Stundenzettel compact time rows.
    text: `KOHE|${sessionStart.toISOString()}|${sessionEnd.toISOString()}`,
    createdAt: new Date().toISOString(),
  };

  await prisma.workReportNote.upsert({
    where: { workerId_type_periodKey: { workerId, type: "MONTHLY", periodKey } },
    create: { workerId, type: "MONTHLY", periodKey, note: serializeReportMessages([...messages, nextMessage]) },
    update: { note: serializeReportMessages([...messages, nextMessage]) },
  });

  revalidatePath(`/workzone/profile/month/${periodKey}`);
  revalidatePath(`/app/admin/workers/${workerId}/month/${periodKey}`);
}

type WorkerDocument = {
  id: string;
  label: string;
  type: string;
  url: string;
  filename: string;
  uploadedAt: string;
};

function parseWorkerDocuments(value: unknown): WorkerDocument[] {
  if (!value || !Array.isArray(value)) return [];
  return value
    .filter((item: any) => typeof item?.url === "string" && typeof item?.label === "string")
    .map((item: any) => ({
      id: String(item.id ?? crypto.randomUUID()),
      label: String(item.label),
      type: String(item.type ?? "document"),
      url: String(item.url),
      filename: String(item.filename ?? item.label),
      uploadedAt: String(item.uploadedAt ?? new Date().toISOString()),
    }));
}

function cleanFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function extensionOf(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  if (fromName) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return file.type.split("/")[1] ?? "jpg";
  return "bin";
}

function documentTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.includes("vertrag") || lower.includes("kontrat")) return "contract";
  if (lower.includes("zert") || lower.includes("certifikat") || lower.includes("certificate")) return "certificate";
  if (lower.includes("schule") || lower.includes("school") || lower.includes("shkoll")) return "school";
  if (lower.includes("patent") || lower.includes("fuhrerschein") || lower.includes("fuehrerschein") || lower.includes("license")) return "license";
  return "document";
}

function labelFromFileName(fileName: string) {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/[-_]+/g, " ").trim() || fileName || "Dokument";
}

type ProfileActor = {
  role: "ADMIN" | "WORKER";
  name: string;
  workerId?: string;
};

async function getProfileActor(): Promise<ProfileActor | null> {
  const admin = await getCurrentAdmin();
  if (admin) return { role: "ADMIN", name: admin.name ?? admin.email };

  const worker = await getCurrentWorker();
  if (worker) {
    return {
      role: "WORKER",
      name: `${worker.firstName} ${worker.lastName}`.trim(),
      workerId: worker.id,
    };
  }

  return null;
}

function canAccessWorkerProfile(actor: ProfileActor | null, workerId: string) {
  return actor?.role === "ADMIN" || actor?.workerId === workerId;
}

/**
 * Tenant-safe variant of canAccessWorkerProfile. Verifies both role access
 * AND that the target worker belongs to the current company. Prefer this over
 * the plain role check for any action that reads or writes worker data.
 */
async function assertWorkerAccess(
  actor: ProfileActor | null,
  workerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tr = await getActionTranslator();
  if (!canAccessWorkerProfile(actor, workerId)) {
    return { ok: false, message: tr("profileAccessDenied") };
  }
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { companyProfileId: true },
  });
  if (!worker || worker.companyProfileId !== currentCompanyId) {
    return { ok: false, message: tr("profileAccessDenied") };
  }
  return { ok: true };
}

function revalidateWorkerProfile(workerId: string) {
  revalidatePath("/workzone");
  revalidatePath("/workzone/profile");
  revalidatePath(`/app/admin/workers/${workerId}`);
  revalidatePath(`/workzone/admin-workers/${workerId}`);
}

function cleanProfileText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function updateWorkerContactDetailsAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  if (!workerId) return { ok: false, message: tr("workerNotFound") };

  const actor = await getProfileActor();
  if (actor?.role !== "ADMIN") return { ok: false, message: tr("profileAccessDenied") };
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  await prisma.worker.update({
    where: { id: workerId },
    data: {
      phone: cleanProfileText(formData.get("phone")),
      emailAccount: cleanProfileText(formData.get("emailAccount")),
      position: cleanProfileText(formData.get("position")),
      licenses: cleanProfileText(formData.get("licenses")),
    },
  });

  revalidateWorkerProfile(workerId);
  return { ok: true, message: tr("contactDetailsSaved") };
}

export async function updateWorkerContactDetailsFormAction(formData: FormData): Promise<void> {
  await updateWorkerContactDetailsAction(formData);
}

export async function updateWorkerLanguagePreferencesAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  if (!workerId) return { ok: false, message: tr("workerNotFound") };

  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  await prisma.worker.update({
    where: { id: workerId },
    data: {
      motherTongue: normalizeAssistantLanguage(formData.get("motherTongue")),
      preferredLanguage: normalizeAssistantLanguage(formData.get("preferredLanguage")),
    },
  });

  revalidateWorkerProfile(workerId);
  return { ok: true, message: tr("languageSaved") };
}

export async function updateWorkerLanguagePreferencesFormAction(formData: FormData): Promise<void> {
  await updateWorkerLanguagePreferencesAction(formData);
}

export async function updateWorkerClothingSizesAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  if (!workerId) return { ok: false, message: tr("workerNotFound") };

  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  await prisma.worker.update({
    where: { id: workerId },
    data: {
      clothingTopSize: String(formData.get("clothingTopSize") ?? "").trim() || null,
      clothingBottomSize: String(formData.get("clothingBottomSize") ?? "").trim() || null,
      shoeSize: String(formData.get("shoeSize") ?? "").trim() || null,
    },
  });

  revalidateWorkerProfile(workerId);
  return { ok: true, message: tr("clothingSizesSaved") };
}

export async function updateWorkerClothingSizesFormAction(formData: FormData): Promise<void> {
  await updateWorkerClothingSizesAction(formData);
}

export async function updateNotificationSettingsAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, message: tr("profileNotFound") };

  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };
  if (actor.role !== "ADMIN" && actor.workerId !== userId) return { ok: false, message: tr("profileAccessDenied") };
  const companyProfileId = await getCurrentCompanyId();
  if (!companyProfileId) return { ok: false, message: tr("profileAccessDenied") };
  const [targetWorker, targetUser] = await Promise.all([
    prisma.worker.findFirst({ where: { id: userId, companyProfileId }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: userId, companyProfileId }, select: { id: true } }),
  ]);
  if (!targetWorker && !targetUser) return { ok: false, message: tr("profileAccessDenied") };


  try {
    await updateNotificationSettings(userId, {
      tagesplan: formData.get("tagesplan") === "on",
      workStart: formData.get("workStart") === "on",
      workEnd: formData.get("workEnd") === "on",
      adminMessages: formData.get("adminMessages") === "on",
    });
  } catch (error) {
    logger.error({ event: "notifications.update_failed", userId }, "update settings failed", error);
    return { ok: false, message: tr("notificationsSaveFailed") };
  }

  revalidateWorkerProfile(userId);
  return { ok: true, message: tr("notificationsSaved") };
}

export async function updateNotificationSettingsFormAction(formData: FormData): Promise<void> {
  await updateNotificationSettingsAction(formData);
}

export async function loginWorkerAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const tr = await getActionTranslator();
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);
  const access = await ensureLoginAllowed("worker", clientIp);
  if (!access.ok) {
    return { message: tr("tooManyAttemptsRetryMinutes", { minutes: Math.ceil(access.retryAfterSeconds / 60) }) };
  }

  const parsed = workerLoginSchema.safeParse({
    name: formData.get("name"),
    loginCode: formData.get("loginCode"),
  });

  if (!parsed.success) {
    await registerFailedLogin("worker", clientIp);
    return { message: tr("checkNameAndCode") };
  }

  const name = normalizeName(parsed.data.name);

  // BDF-P1-005: scrypt-only worker verification. Legacy plaintext
  // `loginCode` values cannot authenticate; the admin must rotate them
  // through the worker-management UI which now writes `loginCodeHash`
  // via `hashPassword`.
  const authResult = await authenticateWorkerByCode(prisma, parsed.data.loginCode);
  if (!authResult.ok) {
    await registerFailedLogin("worker", clientIp);
    if (authResult.reason === "legacy_plaintext") {
      logger.warn(
        { event: "worker_login.legacy_plaintext", workerName: name },
        "legacy plaintext worker login code cannot authenticate; admin must rotate the code via the worker-management UI",
      );
    }
    return { message: tr("workerOrCodeNotFound") };
  }
  const worker = authResult.worker;

  const fullName = normalizeName(`${worker.firstName} ${worker.lastName}`);
  const firstName = normalizeName(worker.firstName);
  if (name !== fullName && name !== firstName) {
    await registerFailedLogin("worker", clientIp);
    return { message: tr("nameDoesNotMatchCode") };
  }

  const jar = await cookies();
  await clearFailedLogin("worker", clientIp);
  jar.set(WORKER_COOKIE, await createSessionCookie("worker", worker.id, worker.sessionEpoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.delete(ADMIN_COOKIE);
  jar.delete(DISPLAY_COOKIE);

  redirect("/workzone/profile");
}

export async function logoutWorkerAction() {
  const jar = await cookies();
  jar.delete(WORKER_COOKIE);
  jar.delete(ADMIN_COOKIE);
  jar.delete(DISPLAY_COOKIE);
  redirect("/workzone/login");
}

export async function startWorkerSessionAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = typeof input === "string" ? startWorkSessionSchema.safeParse({ workerId: input }) : startWorkSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("checkStartTime") };

  const { workerId, startTime } = parsed.data;
  const [admin, currentWorker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (!admin && !currentWorker) return { ok: false, message: tr("loginRequired") };
  if (!admin && currentWorker?.id !== workerId) {
    return { ok: false, message: tr("cannotStartOtherWorkerSession") };
  }

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker || worker.status !== "active") return { ok: false, message: tr("workerNotActive") };
  if (worker.companyProfileId !== currentCompanyId) return { ok: false, message: tr("accessDenied") };
  // Admin can intentionally start a worker session even when availability is not AVAILABLE.
  if (!admin && worker.availability !== "AVAILABLE") return { ok: false, message: tr("workerUnavailableToday") };
  const selectedStartTime = parseActionDate(startTime, new Date());

  const existing = await prisma.workSession.findFirst({
    where: { workerId, isLive: true, endTime: null },
    orderBy: { startTime: "desc" },
  });

  if (existing) {
    return { ok: true, message: tr("workAlreadyActive") };
  }

  await prisma.workSession.create({
    data: {
      workerId,
      startTime: selectedStartTime,
      breakMinutes: 30,
      isLive: true,
    },
  });

  await sendNotificationToAdmins({
    title: tr("workerStartedNotificationTitle"),
    body: tr("workerStartedNotificationBody", { name: `${worker.firstName} ${worker.lastName}`.trim() }),
    url: "/workzone",
    preference: "workStart",
  });

  revalidateWorkerProfile(workerId);
  revalidatePath(`/workzone/baustellen`);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("workStarted") };
}

function actionSessionId(input: unknown) {
  if (!input || typeof input !== "object") return "";
  return String((input as { sessionId?: unknown }).sessionId ?? "");
}

export async function startWorkSessionPauseAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const sessionId = actionSessionId(input);
  if (!sessionId) return { ok: false, message: tr("sessionNotFound") };

  const currentWorker = await getCurrentWorker();
  if (!currentWorker) return { ok: false, message: tr("loginRequired") };

  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.workerId !== currentWorker.id) return { ok: false, message: tr("sessionAccessDenied") };
  if (!session.isLive || session.endTime) return { ok: false, message: tr("sessionNotActive") };
  const pauseIntervals = await findPauseIntervalsForSession(session.id);
  if (hasOpenPause(pauseIntervals)) return { ok: true, message: tr("pauseAlreadyRunning") };

  const created = await createPauseInterval({
    workSessionId: session.id,
    workerId: session.workerId,
    startedAt: new Date(),
    note: "Manuelle Pause",
  });
  if (!created) return { ok: false, message: tr("pauseMigrationMissing") };

  revalidateWorkerProfile(session.workerId);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("pauseStarted") };
}

export async function stopWorkSessionPauseAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const sessionId = actionSessionId(input);
  if (!sessionId) return { ok: false, message: tr("sessionNotFound") };

  const currentWorker = await getCurrentWorker();
  if (!currentWorker) return { ok: false, message: tr("loginRequired") };

  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.workerId !== currentWorker.id) return { ok: false, message: tr("sessionAccessDenied") };
  if (!session.isLive || session.endTime) return { ok: false, message: tr("sessionNotActive") };

  const pauseIntervals = await findPauseIntervalsForSession(session.id);
  const openPause = pauseIntervals.find((interval) => interval.endedAt === null);
  if (!openPause) return { ok: true, message: tr("noOpenPause") };

  const endedAt = new Date();
  const intervals = pauseIntervals.map((interval) =>
    interval.id === openPause.id ? { ...interval, endedAt } : interval,
  );
  const breakMinutes = totalPauseMinutes(intervals, endedAt);

  await closePauseInterval(openPause.id, endedAt);
  await prisma.workSession.update({ where: { id: session.id }, data: { breakMinutes } });

  revalidateWorkerProfile(session.workerId);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("pauseEnded") };
}

export async function stopWorkerSessionAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = stopWorkSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("checkEndTimeAndBreak") };

  const [admin, currentWorker] = await Promise.all([getCurrentAdmin(), getCurrentWorker()]);
  if (!admin && !currentWorker) return { ok: false, message: tr("loginRequired") };

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };

  const session = await prisma.workSession.findUnique({
    where: { id: parsed.data.sessionId },
    include: { worker: { select: { companyProfileId: true } } },
  });
  if (!session) return { ok: false, message: tr("sessionNotFound") };
  if (session.worker.companyProfileId !== currentCompanyId) return { ok: false, message: tr("accessDenied") };
  if (!admin && currentWorker?.id !== session.workerId) {
    return { ok: false, message: tr("cannotStopOtherWorkerSession") };
  }
  if (!session.isLive) return { ok: false, message: tr("sessionAlreadyEnded") };

  const endTime = new Date(parsed.data.endTime);
  if (Number.isNaN(endTime.getTime()) || endTime < session.startTime) {
    return { ok: false, message: tr("invalidEndTime") };
  }

  if (isTrivialSession(session.startTime, endTime)) {
    await prisma.workSession.delete({ where: { id: session.id } });
    revalidateWorkerProfile(session.workerId);
    revalidatePath(`/workzone/baustellen`);
    notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
    return { ok: true, message: tr("shortClickDiscarded") };
  }

  const pauseIntervals = await findPauseIntervalsForSession(session.id);
  const openPauseUpdates = pauseIntervals
    .filter((interval) => interval.endedAt === null)
    .map((interval) => closePauseInterval(interval.id, endTime));
  const intervals = pauseIntervals.map((interval) => (interval.endedAt === null ? { ...interval, endedAt: endTime } : interval));
  const breakMinutes = stopBreakMinutes(parsed.data.breakMinutes, intervals, endTime);

  await Promise.all(openPauseUpdates);
  await prisma.workSession.update({
    where: { id: session.id },
    data: {
      endTime,
      breakMinutes,
      totalHours: totalWorkHours(session.startTime, endTime, breakMinutes),
      isLive: false,
      closedBySystem: false,
      systemNote: null,
    },
  });

  const worker = await prisma.worker.findUnique({
    where: { id: session.workerId },
    select: { firstName: true, lastName: true },
  });
  await sendNotificationToAdmins({
    title: tr("workerFinishedNotificationTitle"),
    body: tr("workerFinishedNotificationBody", { name: `${worker?.firstName ?? ""} ${worker?.lastName ?? ""}`.trim() }),
    url: "/workzone",
    preference: "workEnd",
  });

  if (admin) {
    await appendAdminTimeEntry(session.workerId, session.startTime, endTime);
  }

  revalidateWorkerProfile(session.workerId);
  revalidatePath(`/workzone/baustellen`);
  notifyRealtimeUpdate("worker.session.updated", ["worker-strip", "working-badge"]);
  return { ok: true, message: tr("workEnded") };
}

export async function saveReportNoteAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = reportNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidNote") };

  const { workerId, type, periodKey, note } = parsed.data;
  const text = note.trim();
  if (!text) return { ok: false, message: tr("messageRequired") };

  const profileActor = await getProfileActor();
  const _access = await assertWorkerAccess(profileActor, workerId);
  if (!_access.ok) return _access;

  const [admin, worker, existing] = await Promise.all([
    getCurrentAdmin(),
    getCurrentWorker(),
    prisma.workReportNote.findUnique({ where: { workerId_type_periodKey: { workerId, type, periodKey } } }),
  ]);

  const actor =
    admin != null
      ? { authorName: admin.name ?? admin.email, authorRole: "Admin" as const }
      : worker?.id === workerId
        ? { authorName: `${worker.firstName} ${worker.lastName}`.trim(), authorRole: "Worker" as const }
        : { authorName: "System", authorRole: "System" as const };

  const nextMessage: ReportMessage = {
    id: crypto.randomUUID(),
    authorName: actor.authorName,
    authorRole: actor.authorRole,
    text,
    createdAt: new Date().toISOString(),
  };
  const messages = [...parseReportMessages(existing?.note, await resolveRequestLanguage()), nextMessage];

  await prisma.workReportNote.upsert({
    where: { workerId_type_periodKey: { workerId, type, periodKey } },
    create: { workerId, type, periodKey, note: serializeReportMessages(messages) },
    update: { note: serializeReportMessages(messages) },
  });

  revalidatePath("/workzone/profile");
  revalidatePath(`/workzone/profile/day/${periodKey}`);
  if (type === "MONTHLY") revalidatePath(`/workzone/profile/month/${periodKey}`);
  revalidatePath(`/app/admin/workers/${workerId}/day/${periodKey}`);
  if (type === "MONTHLY") revalidatePath(`/app/admin/workers/${workerId}/month/${periodKey}`);
  return { ok: true, message: tr("messageSent") };
}

export async function uploadWorkerAssetAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const kind = String(formData.get("kind") ?? "document");
  const label = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");

  if (!workerId || !(file instanceof File) || file.size === 0) return { ok: false, message: tr("selectFile") };
  const actor = await getProfileActor();
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  const maxSize = kind === "photo" ? 2_000_000 : 15_000_000;
  if (file.size > maxSize) return { ok: false, message: kind === "photo" ? tr("photoMax2Mb") : tr("documentMax15Mb") };

  // BDF-P8-007: validate against actual magic bytes, not the client-
  // supplied MIME. A photo must actually be an image; a document must
  // actually be a PDF, an Office file, or an image (worker photo cards
  // sometimes accept scanned images as documents).
  const allowedCategories = kind === "photo" ? (["image"] as const) : (["pdf", "office", "image"] as const);
  const signatureCheck = await validateFileAgainstAllowedCategories(file, allowedCategories);
  if (!signatureCheck.ok) {
    if (kind === "photo") return { ok: false, message: tr("photoMustBeImage") };
    return { ok: false, message: tr("documentTypeAllowed") };
  }
  const ext = extensionOf(file);

  // BDF-P8-007: content-level scan. Under the default no-op backend
  // this is free (just an EICAR canary check); once ClamAV / an
  // equivalent is wired via CONTENT_SCANNER, every upload flows
  // through it automatically.
  const scan = await scanFileContent(file);
  if (!scan.ok) return { ok: false, message: tr("documentTypeAllowed") };

  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, documents: true } });
  if (!worker) return { ok: false, message: tr("workerNotFound") };

  const filename = `${Date.now()}-${cleanFileName(file.name || `asset.${ext}`)}`;
  const url = await uploadManagedFile({
    scope: "worker-assets",
    entityId: workerId,
    file,
    fileName: filename,
  });

  if (kind === "photo") {
    const previous = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { profileImageUrl: true },
    });
    await prisma.worker.update({ where: { id: workerId }, data: { profileImageUrl: url } });
    if (previous?.profileImageUrl && previous.profileImageUrl !== url) {
      await deleteManagedFileByUrl(previous.profileImageUrl, { scope: "worker-assets", entityId: workerId }).catch(() => undefined);
    }
  } else {
    const documents = parseWorkerDocuments(worker.documents);
    documents.unshift({
      id: crypto.randomUUID(),
      label: label || labelFromFileName(file.name),
      type: kind === "document" ? documentTypeFromFileName(file.name) : kind,
      url,
      filename,
      uploadedAt: new Date().toISOString(),
    });
    await prisma.worker.update({ where: { id: workerId }, data: { documents } });
  }

  revalidateWorkerProfile(workerId);
  return { ok: true, message: kind === "photo" ? tr("photoSaved") : tr("documentUploaded") };
}

export async function deleteWorkerDocumentAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!workerId || !documentId) return { ok: false, message: tr("documentNotFound") };

  const actor = await getProfileActor();
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, documents: true } });
  if (!worker) return { ok: false, message: tr("workerNotFound") };

  const currentDocuments = parseWorkerDocuments(worker.documents);
  const removedDocument = currentDocuments.find((document) => document.id === documentId) ?? null;
  const nextDocuments = currentDocuments.filter((document) => document.id !== documentId);
  await prisma.worker.update({ where: { id: workerId }, data: { documents: nextDocuments } });
  if (removedDocument?.url) {
    await deleteManagedFileByUrl(removedDocument.url, { scope: "worker-assets", entityId: workerId }).catch(() => undefined);
  }

  revalidateWorkerProfile(workerId);
  return { ok: true, message: tr("profileDocumentRemoved") };
}

function assetKind(value: FormDataEntryValue | null) {
  return value === "EQUIPMENT" ? "EQUIPMENT" : "CLOTHING";
}

function itemStatusForNewAsset(actor: ProfileActor) {
  return actor.role === "ADMIN" ? "PENDING_WORKER_CONFIRMATION" : "PENDING_ADMIN_CONFIRMATION";
}

function canConfirmStatus(actor: ProfileActor, workerId: string, status: string) {
  if (actor.role === "ADMIN") {
    return status === "PENDING_ADMIN_CONFIRMATION" || status === "PENDING_ADMIN_DELETE_CONFIRMATION";
  }

  return (
    actor.workerId === workerId &&
    (status === "PENDING_WORKER_CONFIRMATION" || status === "PENDING_WORKER_DELETE_CONFIRMATION")
  );
}

function deleteStatusForActor(actor: ProfileActor) {
  return actor.role === "ADMIN" ? "PENDING_WORKER_DELETE_CONFIRMATION" : "PENDING_ADMIN_DELETE_CONFIRMATION";
}

export async function createWorkerInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const workerId = String(formData.get("workerId") ?? "");
  const companyInventoryItemId = String(formData.get("companyInventoryItemId") ?? "").trim();
  const itemName = String(formData.get("itemName") ?? "").trim();
  const itemCode = String(formData.get("itemCode") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const kind = assetKind(formData.get("kind"));

  if (!workerId) return { ok: false, message: tr("workerNotFound") };
  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };
  const _access = await assertWorkerAccess(actor, workerId);
  if (!_access.ok) return _access;

  const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { companyProfileId: true } });
  if (!worker) return { ok: false, message: tr("workerNotFound") };

  const companyItem = companyInventoryItemId
    ? await prisma.companyInventoryItem.findFirst({
        where: {
          id: companyInventoryItemId,
          companyProfileId: worker.companyProfileId,
          isActive: true,
        },
      })
    : null;

  const resolvedName = companyItem?.name ?? itemName;
  const resolvedCode = companyItem?.itemCode ?? itemCode;
  const resolvedNote = note || companyItem?.note || null;
  if (!resolvedName) return { ok: false, message: tr("selectArticleOrEnterName") };

  await prisma.workerAssetItem.create({
    data: {
      workerId,
      companyInventoryItemId: companyItem?.id ?? null,
      kind,
      itemName: resolvedName,
      itemCode: resolvedCode || null,
      note: resolvedNote,
      status: itemStatusForNewAsset(actor),
      createdByRole: actor.role,
      createdByName: actor.name,
    },
  });

  revalidateWorkerProfile(workerId);
  return { ok: true, message: actor.role === "ADMIN" ? tr("itemWaitsWorkerConfirmation") : tr("itemWaitsAdminConfirmation") };
}

export async function confirmWorkerInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ok: false, message: tr("itemNotFound") };

  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };

  const item = await prisma.workerAssetItem.findUnique({ where: { id: itemId }, select: { id: true, workerId: true, status: true } });
  if (!item || !canConfirmStatus(actor, item.workerId, item.status)) {
    return { ok: false, message: tr("confirmationWrongProfile") };
  }
  const access = await assertWorkerAccess(actor, item.workerId);
  if (!access.ok) return access;

  const isDeleteConfirmation = item.status === "PENDING_ADMIN_DELETE_CONFIRMATION" || item.status === "PENDING_WORKER_DELETE_CONFIRMATION";
  await prisma.workerAssetItem.update({
    where: { id: itemId },
    data: isDeleteConfirmation
      ? {
          status: "DELETED",
          deletedAt: new Date(),
          confirmedAt: new Date(),
          confirmedByRole: actor.role,
          confirmedByName: actor.name,
        }
      : {
          status: "ACTIVE",
          confirmedAt: new Date(),
          confirmedByRole: actor.role,
          confirmedByName: actor.name,
        },
  });

  revalidateWorkerProfile(item.workerId);
  return { ok: true, message: isDeleteConfirmation ? tr("deleteConfirmed") : tr("handoverConfirmed") };
}

export async function requestDeleteWorkerInventoryItemAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ok: false, message: tr("itemNotFound") };

  const actor = await getProfileActor();
  if (!actor) return { ok: false, message: tr("loginRequired") };

  const item = await prisma.workerAssetItem.findUnique({ where: { id: itemId }, select: { id: true, workerId: true, status: true } });
  if (!item || !canAccessWorkerProfile(actor, item.workerId)) return { ok: false, message: tr("profileAccessDenied") };
  const access = await assertWorkerAccess(actor, item.workerId);
  if (!access.ok) return access;
  if (item.status === "DELETED") return { ok: true, message: tr("itemAlreadyDeleted") };
  if (item.status === "PENDING_ADMIN_DELETE_CONFIRMATION" || item.status === "PENDING_WORKER_DELETE_CONFIRMATION") {
    return { ok: true, message: tr("deleteWaitsConfirmation") };
  }

  await prisma.workerAssetItem.update({
    where: { id: itemId },
    data: {
      status: deleteStatusForActor(actor),
      deleteRequestedAt: new Date(),
      deleteRequestedByRole: actor.role,
      deleteRequestedByName: actor.name,
    },
  });

  revalidateWorkerProfile(item.workerId);
  return { ok: true, message: actor.role === "ADMIN" ? tr("deleteWaitsWorkerConfirmation") : tr("deleteWaitsAdminConfirmation") };
}
