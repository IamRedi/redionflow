"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { withPilotDbContext } from "@/lib/db/tenant-runtime";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { clearManagedEntityFolder, deleteManagedFiles, uploadManagedFile } from "@/lib/storage/object-storage";
import type { ActionResult } from "@/lib/validation/action-result";
import { createBaustelleSchema, updateBaustelleCanvasPositionSchema, updateBaustelleMetaSchema } from "@/lib/validation/schemas";
import { checkLimit, overLimitMessage } from "@/lib/billing/limits";
import { getPilotAdminCompanyId as getCurrentCompanyId } from "@/lib/auth/pilot-session";
import { isOwnedByCurrentCompany } from "@/lib/db/tenant";

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isAllowedDocument(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const ext = fromName ?? "";
  const isPdf = file.type === "application/pdf" || ext === "pdf";
  const isWord = ["doc", "docx"].includes(ext) || file.type.includes("word") || file.type.includes("officedocument");
  const isImage = file.type.startsWith("image/");
  return isPdf || isWord || isImage;
}

export async function createBaustelleAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator("admin");
  const parsed = createBaustelleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: tr("checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== v.companyId) return { ok: false, message: tr("checkInputs") };
  const requestLang = await resolveRequestLanguage();
  const description = v.description?.trim() ? v.description.trim() : null;
  const address = v.address?.trim() ? v.address.trim() : null;
  const documents = (v.documentsText ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await withPilotDbContext(currentCompanyId, async tx => {
    if (v.status === "active") {
      const limit = await checkLimit(currentCompanyId, "activeBaustellen", tx);
      if (!limit.ok) return { ok: false, message: overLimitMessage(limit, requestLang) };
    }
    await tx.baustelle.create({
      data: {
        companyProfileId: v.companyId,
        name: v.name.trim(),
        type: v.type,
        status: v.status,
        address,
        description,
        documents,
      },
    });

    return { ok: true as const };
  }, "admin");
  if (!result.ok) return result;
  revalidatePath("/app/baustellen");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("baustelleCreated") };
}

export async function createBaustelleWithDocumentsAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator("admin");
  const createFirstTreeItem = String(formData.get("createFirstTreeItem") ?? "") === "on";
  const parsed = createBaustelleSchema.safeParse({
    companyId: String(formData.get("companyId") ?? ""),
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    status: String(formData.get("status") ?? ""),
    address: String(formData.get("address") ?? ""),
    description: String(formData.get("description") ?? ""),
    documentsText: "",
    createFirstTreeItem,
    firstTreeId: String(formData.get("firstTreeId") ?? ""),
    firstTreeSpecies: String(formData.get("firstTreeSpecies") ?? ""),
    firstTreeDiameter: String(formData.get("firstTreeDiameter") ?? "0"),
    firstTreeNote: String(formData.get("firstTreeNote") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: tr("checkInputs"),
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }

  const v = parsed.data;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId || currentCompanyId !== v.companyId) return { ok: false, message: tr("checkInputs") };
  const requestLang = await resolveRequestLanguage();
  const description = v.description?.trim() ? v.description.trim() : null;
  const address = v.address?.trim() ? v.address.trim() : null;
  const firstTreeId = v.firstTreeId?.trim() || "1";
  const firstTreeSpecies = v.firstTreeSpecies?.trim() || "Arbeit";
  const firstTreeNote = v.firstTreeNote?.trim() || null;
  if (v.createFirstTreeItem && !firstTreeSpecies) return { ok: false, message: tr("workTypeRequired") };
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  for (const file of files) {
    if (file.size > 15_000_000) return { ok: false, message: tr("documentTooLargeNamed", { name: file.name }) };
    if (!isAllowedDocument(file)) return { ok: false, message: tr("documentTypeNotAllowedNamed", { name: file.name }) };
  }

  const result = await withPilotDbContext(currentCompanyId, async tx => {
    if (v.status === "active") {
      const limit = await checkLimit(currentCompanyId, "activeBaustellen", tx);
      if (!limit.ok) return { ok: false, message: overLimitMessage(limit, requestLang) };
    }
    const baustelle = await tx.baustelle.create({
      data: {
        companyProfileId: v.companyId,
        name: v.name.trim(),
        type: v.type,
        status: v.status,
        address,
        description,
        documents: [],
      },
      select: { id: true },
    });

    if (v.createFirstTreeItem) {
      await tx.treeItem.create({
        data: {
          baustelleId: baustelle.id,
          treeId: firstTreeId,
          species: firstTreeSpecies,
          diameter: Math.max(0, Number(v.firstTreeDiameter ?? 0) || 0),
          notes: firstTreeNote ? JSON.stringify({ note: firstTreeNote }) : null,
        },
      });
    }

    return { ok: true as const, baustelle };
  }, "admin");
  if (!result.ok) return result;
  if (!result.baustelle) throw new Error("Site creation returned no site");
  const { baustelle } = result;
  const storedDocs: string[] = [];
  if (files.length > 0) {
    for (const file of files) {
      const filename = `${Date.now()}-${sanitizeFileName(file.name || "dokument")}`;
      storedDocs.push(
        await uploadManagedFile({
          scope: "baustelle-documents",
          entityId: baustelle.id,
          file,
          fileName: filename,
        }),
      );
    }
    await withPilotDbContext(currentCompanyId, tx => tx.baustelle.update({
      where: { id: baustelle.id, companyProfileId: currentCompanyId },
      data: { documents: storedDocs },
    }), "admin");
  }

  revalidatePath("/app/baustellen");
  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelle.id}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("baustelleCreated") };
}

export async function updateBaustelleCanvasPositionAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator("admin");
  const parsed = updateBaustelleCanvasPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidCoordinates") };

  const { baustelleId, x, y, viewport } = parsed.data;
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return { ok: false, message: tr("notSignedIn") };
  const updated = await withPilotDbContext(currentCompanyId, async tx => {
    const baustelle = await tx.baustelle.findUnique({ where: { id: baustelleId }, select: { id: true, companyProfileId: true } });
    if (!baustelle || !isOwnedByCurrentCompany(baustelle, currentCompanyId)) return null;

    await tx.baustelle.update({
      where: { id: baustelleId },
      data: viewport === "mobile" ? { canvasMobileX: x, canvasMobileY: y } : { canvasX: x, canvasY: y },
    });

    return baustelle;
  }, "admin");
  if (!updated) return { ok: false, message: tr("baustelleNotFound") };

  revalidatePath("/workzone");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
  return { ok: true, message: tr("positionSaved") };
}

export async function updateBaustelleMetaAction(formData: FormData): Promise<void> {
  "use server";

  const parsed = updateBaustelleMetaSchema.safeParse({
    baustelleId: String(formData.get("baustelleId") ?? ""),
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    status: String(formData.get("status") ?? ""),
    address: String(formData.get("address") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) return;

  const v = parsed.data;
  const description = v.description?.trim() ? v.description.trim() : null;
  const address = v.address?.trim() ? v.address.trim() : null;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const updated = await withPilotDbContext(currentCompanyId, async tx => {
    const existing = await tx.baustelle.findUnique({
      where: { id: v.baustelleId },
      select: { id: true, companyProfileId: true },
    });
    if (!existing || !isOwnedByCurrentCompany(existing, currentCompanyId)) return null;

    await tx.baustelle.update({
      where: { id: v.baustelleId },
      data: {
        name: v.name.trim(),
        type: v.type,
        status: v.status,
        address,
        description,
      },
    });

    return existing;
  }, "admin");
  if (!updated) return;

  revalidatePath("/app/baustellen");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
}

export async function clearBaustelleImportDataAction(formData: FormData): Promise<void> {
  "use server";

  const baustelleId = String(formData.get("baustelleId") ?? "");
  if (!baustelleId) return;

  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;
  const existing = await withPilotDbContext(currentCompanyId, async tx => {
    const existing = await tx.baustelle.findUnique({
      where: { id: baustelleId },
      select: { id: true, documents: true, companyProfileId: true },
    });
    if (!existing || !isOwnedByCurrentCompany(existing, currentCompanyId)) return null;


      await tx.treeItem.deleteMany({ where: { baustelleId } });
      await tx.baustelle.update({
        where: { id: baustelleId },
        data: {
          documents: [],
          coordinates: Prisma.JsonNull,
        },
      });

    return existing;
  }, "admin");
  if (!existing) return;

  await deleteManagedFiles(existing.documents ?? [], { scope: "baustelle-documents", entityId: baustelleId }).catch(() => undefined);
  await clearManagedEntityFolder("baustelle-documents", baustelleId);

  revalidatePath("/app/baustellen");
  revalidatePath("/app/baustellen/import");
  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
}

export async function deleteBaustelleAction(formData: FormData): Promise<void> {
  "use server";

  const baustelleId = String(formData.get("baustelleId") ?? "");
  if (!baustelleId) return;

  // T-025 tenant scoping: refuse silently on cross-tenant or unauthenticated
  // calls. Never delete an entity that does not belong to the current company.
  const currentCompanyId = await getCurrentCompanyId();
  if (!currentCompanyId) return;

  const existing = await withPilotDbContext(currentCompanyId, async tx => {
    const existing = await tx.baustelle.findUnique({
      where: { id: baustelleId },
      select: { id: true, documents: true, companyProfileId: true },
    });
    if (!existing || !isOwnedByCurrentCompany(existing, currentCompanyId)) return null;

    await tx.baustelle.delete({ where: { id: baustelleId } });

    return existing;
  }, "admin");
  if (!existing) return;

  await deleteManagedFiles(existing.documents ?? [], { scope: "baustelle-documents", entityId: baustelleId }).catch(() => undefined);
  await clearManagedEntityFolder("baustelle-documents", baustelleId);

  revalidatePath("/app/baustellen");
  revalidatePath("/app/baustellen/import");
  revalidatePath("/workzone");
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
}
