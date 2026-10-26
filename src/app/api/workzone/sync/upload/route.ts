import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { UploadValidationError } from "@/lib/storage/upload-validation";
import { uploadManagedFile } from "@/lib/storage/object-storage";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import type { SyncActionResult, WorkzoneActorKind } from "@/lib/workzone/offline/types";

type UploadLang = "de" | "en" | "it" | "sq";

function normalizeUploadLang(lang: string): UploadLang {
  return lang === "en" || lang === "it" || lang === "sq" ? lang : "de";
}

function uploadMessages(lang: string) {
  const selected = normalizeUploadLang(lang);
  const messages = {
    de: {
      unauthorized: "Anmeldung erforderlich.",
      invalidMultipartBody: "Multipart-Inhalt ist ungueltig.",
      missingMetaOrFile: "Metadaten oder Datei fehlen.",
      invalidUploadMetadata: "Upload-Metadaten sind ungueltig.",
      actorMismatch: "Akteur passt nicht zur angemeldeten Session.",
      companyMismatch: "Firma passt nicht zur angemeldeten Session.",
      emptyFile: "Datei ist leer.",
      fileTooLarge: "Datei ist groesser als 15 MB.",
      unsupportedUploadKind: "Upload-Typ wird nicht unterstuetzt.",
      disallowedFileType: "Dateityp ist nicht erlaubt.",
      siteNotFound: "Baustelle wurde nicht gefunden.",
      storageUploadFailed: "Datei konnte nicht gespeichert werden.",
    },
    en: {
      unauthorized: "Sign-in required.",
      invalidMultipartBody: "Invalid multipart body.",
      missingMetaOrFile: "Missing metadata or file.",
      invalidUploadMetadata: "Invalid upload metadata.",
      actorMismatch: "Actor does not match the signed-in session.",
      companyMismatch: "Company does not match the signed-in session.",
      emptyFile: "File is empty.",
      fileTooLarge: "File exceeds 15 MB.",
      unsupportedUploadKind: "Unsupported upload type.",
      disallowedFileType: "File type is not allowed.",
      siteNotFound: "Site was not found.",
      storageUploadFailed: "File could not be stored.",
    },
    it: {
      unauthorized: "Accesso richiesto.",
      invalidMultipartBody: "Corpo multipart non valido.",
      missingMetaOrFile: "Metadati o file mancanti.",
      invalidUploadMetadata: "Metadati di upload non validi.",
      actorMismatch: "L'attore non corrisponde alla sessione collegata.",
      companyMismatch: "L'azienda non corrisponde alla sessione collegata.",
      emptyFile: "Il file e vuoto.",
      fileTooLarge: "Il file supera 15 MB.",
      unsupportedUploadKind: "Tipo di upload non supportato.",
      disallowedFileType: "Tipo di file non consentito.",
      siteNotFound: "Cantiere non trovato.",
      storageUploadFailed: "Impossibile salvare il file.",
    },
    sq: {
      unauthorized: "Duhet te hysh.",
      invalidMultipartBody: "Permbajtje multipart e pavlefshme.",
      missingMetaOrFile: "Mungojne metadhenat ose file.",
      invalidUploadMetadata: "Metadhenat e upload-it jane te pavlefshme.",
      actorMismatch: "Aktori nuk perputhet me sesionin e loguar.",
      companyMismatch: "Firma nuk perputhet me sesionin e loguar.",
      emptyFile: "File eshte bosh.",
      fileTooLarge: "File kalon 15 MB.",
      unsupportedUploadKind: "Ky lloj upload-i nuk mbeshtetet.",
      disallowedFileType: "Ky lloj file nuk lejohet.",
      siteNotFound: "Kantieri nuk u gjet.",
      storageUploadFailed: "File nuk mund te ruhej.",
    },
  } as const;
  return messages[selected];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 15_000_000; // 15 MB — matches uploadBaustelleDocumentAction

// ---------------------------------------------------------------------------
// Metadata schema
// ---------------------------------------------------------------------------

const actorKindEnum = z.enum(["WORKER", "ADMIN"] satisfies [WorkzoneActorKind, WorkzoneActorKind]);

const uploadPayloadSchema = z.object({
  scope: z.enum(["baustelle-documents", "worker-assets"]),
  entityId: z.string().min(1).max(128),
  fileName: z.string().min(1).max(256),
  contentType: z.string().max(256).optional(),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  kind: z.enum(["baustelle-document", "worker-document", "worker-photo"]),
  label: z.string().max(200).optional(),
});

const uploadMetaSchema = z.object({
  id: z.string().uuid(),
  actorKind: actorKindEnum,
  actorId: z.string().min(1).max(128),
  companyProfileId: z.string().min(1).max(128),
  entityType: z.literal("BAUSTELLE"),
  entityId: z.string().min(1).max(256),
  clientCreatedAt: z.string().datetime(),
  payload: uploadPayloadSchema,
});

// ---------------------------------------------------------------------------
// Auth
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
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqueDocuments(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function allowedBaustelleDocument(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const ext = fromName ?? "";
  const isPdf = file.type === "application/pdf" || ext === "pdf";
  const isWord = ["doc", "docx"].includes(ext) || file.type.includes("word") || file.type.includes("officedocument");
  const isImage = file.type.startsWith("image/");
  return isPdf || isWord || isImage;
}

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
  meta: z.infer<typeof uploadMetaSchema>,
  outcome: SyncActionResult["outcome"],
  outcomeMsg?: string,
): Promise<void> {
  await prisma.workzoneSyncAction.create({
    data: {
      id: actionId,
      companyProfileId: auth.companyProfileId,
      actorKind: auth.kind,
      actorId: auth.id,
      actionType: "UPLOAD_DOCUMENT",
      entityType: meta.entityType,
      entityId: meta.entityId,
      payload: meta.payload,
      outcome,
      outcomeMsg: outcomeMsg ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ result: SyncActionResult } | { ok: false; message: string }>> {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const m = uploadMessages(await resolveRequestLanguage());
  const auth = await resolveAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, message: m.unauthorized }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: m.invalidMultipartBody }, { status: 400 });
  }

  const rawMeta = form.get("meta");
  const file = form.get("file");
  if (typeof rawMeta !== "string" || !(file instanceof File)) {
    return NextResponse.json({ ok: false, message: m.missingMetaOrFile }, { status: 400 });
  }

  let parsedMeta: z.infer<typeof uploadMetaSchema>;
  try {
    parsedMeta = uploadMetaSchema.parse(JSON.parse(rawMeta));
  } catch {
    return NextResponse.json({ ok: false, message: m.invalidUploadMetadata }, { status: 400 });
  }

  // Idempotency: replay stored outcome without re-uploading.
  const existing = await findExistingOutcome(parsedMeta.id);
  if (existing) {
    return NextResponse.json({ result: existing });
  }

  // Actor / company match
  if (parsedMeta.actorKind !== auth.kind || parsedMeta.actorId !== auth.id) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.actorMismatch);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.actorMismatch },
    });
  }
  if (parsedMeta.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.companyMismatch);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.companyMismatch },
    });
  }

  // File validation
  if (file.size === 0) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.emptyFile);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.emptyFile },
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.fileTooLarge);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.fileTooLarge },
    });
  }

  // Currently only baustelle-document is wired end-to-end. Worker upload is a follow-up.
  if (parsedMeta.payload.kind !== "baustelle-document") {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.unsupportedUploadKind);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.unsupportedUploadKind },
    });
  }
  if (!allowedBaustelleDocument(file)) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.disallowedFileType);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.disallowedFileType },
    });
  }

  const baustelleId = parsedMeta.payload.entityId;
  const baustelle = await prisma.baustelle.findUnique({
    where: { id: baustelleId },
    select: { id: true, companyProfileId: true, documents: true, isActive: true },
  });
  if (!baustelle) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "conflict", m.siteNotFound);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "conflict", message: m.siteNotFound },
    });
  }
  if (baustelle.companyProfileId !== auth.companyProfileId) {
    await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.companyMismatch);
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "rejected", message: m.companyMismatch },
    });
  }

  const fileName = `${Date.now()}-${sanitizeFileName(file.name || parsedMeta.payload.fileName || "dokument")}`;

  let publicUrl: string;
  try {
    publicUrl = await uploadManagedFile({
      scope: "baustelle-documents",
      entityId: baustelleId,
      file,
      fileName,
    });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      await recordOutcome(parsedMeta.id, auth, parsedMeta, "rejected", m.disallowedFileType);
      return NextResponse.json({result:{id:parsedMeta.id,outcome:"rejected",message:m.disallowedFileType}});
    }
    const msg = m.storageUploadFailed;
    // Do NOT record outcome — this is retryable.
    return NextResponse.json({
      result: { id: parsedMeta.id, outcome: "retryable_error", message: msg },
    });
  }

  await prisma.baustelle.update({
    where: { id: baustelleId },
    data: { documents: uniqueDocuments([...(baustelle.documents ?? []), publicUrl]) },
  });

  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  revalidatePath("/app/baustellen");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);

  await recordOutcome(parsedMeta.id, auth, parsedMeta, "synced");
  return NextResponse.json({ result: { id: parsedMeta.id, outcome: "synced" } });
}
