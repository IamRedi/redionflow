"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { parseOrderText, sameSiteName, type OrderDraft } from "@/lib/factory/order-parse";
import { initialFactorySteps, PRODUCTION_UNITS } from "@/lib/factory/production";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import { currentCompanyActor } from "@/lib/site-files/actor";
import { allowedForKind, safeFileName, SITE_FILE_MAX_BYTES, sniffSiteFileMime, type SiteFileKind } from "@/lib/site-files/validate";
import type { ActionResult } from "@/lib/validation/action-result";

function revalidateSite(baustelleId: string) {
  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("baustelle.updated", ["workzone-cards", "mission-control"]);
}

async function readUpload(file: FormDataEntryValue | null, kind: SiteFileKind) {
  if (!(file instanceof File) || file.size === 0 || file.size > SITE_FILE_MAX_BYTES) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffSiteFileMime(bytes, file.name);
  if (!mime || !allowedForKind(mime, kind)) return null;
  return { bytes, mime, fileName: safeFileName(file.name), size: bytes.byteLength };
}

const uploadKinds = z.enum(["document", "photo", "invoice"]);

/**
 * Documents and photos: anyone signed in for the company (workers take site
 * photos). Invoices carry prices, so only the office can add or see them.
 */
export async function uploadSiteFileAction(formData: FormData): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };

  const kind = uploadKinds.safeParse(formData.get("kind"));
  const baustelleId = String(formData.get("baustelleId") ?? "");
  if (!kind.success || !baustelleId) return { ok: false, message: tr("invalidInput") };
  if (kind.data === "invoice" && !actor.isAdmin) return { ok: false, message: tr("accessDenied") };

  const upload = await readUpload(formData.get("file"), kind.data);
  if (!upload) return { ok: false, message: tr("documentTypeAllowed") };
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const supplier = String(formData.get("supplier") ?? "").trim().slice(0, 120) || null;

  const saved = await withTenantContext(companyId, async (tx) => {
    const site = await tx.baustelle.findFirst({ where: { id: baustelleId, companyProfileId: companyId }, select: { id: true } });
    if (!site) return false;
    await tx.siteFile.create({
      data: {
        companyProfileId: companyId,
        baustelleId,
        kind: kind.data,
        officeOnly: kind.data === "invoice",
        fileName: upload.fileName,
        mime: upload.mime,
        size: upload.size,
        data: upload.bytes,
        amount: amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null,
        currency: amount !== null ? "ALL" : null,
        supplier,
        uploadedByName: actor.name,
      },
    });
    return true;
  });
  if (!saved) return { ok: false, message: tr("siteNotFound") };
  revalidateSite(baustelleId);
  return { ok: true, message: tr("documentUploaded") };
}

/** Office only. */
export async function deleteSiteFileAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.isAdmin) return { ok: false, message: tr("accessDenied") };
  const removed = await withTenantContext(companyId, async (tx) => {
    const file = await tx.siteFile.findFirst({ where: { id: parsed.data.id, companyProfileId: companyId }, select: { id: true, baustelleId: true } });
    if (!file) return null;
    await tx.siteFile.delete({ where: { id: file.id } });
    return file.baustelleId;
  });
  if (!removed) return { ok: false, message: tr("documentNotFound") };
  revalidateSite(removed);
  return { ok: true, message: "OK" };
}

const siteInfoSchema = z.object({
  baustelleId: z.string().min(1).max(64),
  address: z.string().trim().max(240),
  description: z.string().trim().max(2000),
});

/** Office only: address and details of a site. */
export async function updateSiteInfoAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = siteInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.isAdmin) return { ok: false, message: tr("accessDenied") };
  const { baustelleId, address, description } = parsed.data;
  const updated = await withTenantContext(companyId, async (tx) => {
    const result = await tx.baustelle.updateMany({
      where: { id: baustelleId, companyProfileId: companyId },
      data: { address: address || null, description: description || null },
    });
    return result.count > 0;
  });
  if (!updated) return { ok: false, message: tr("siteNotFound") };
  revalidateSite(baustelleId);
  return { ok: true, message: "OK" };
}

/** Text of a PDF, page by page joined, for the order reader. */
async function pdfText(bytes: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text ?? "");
}

export type ParseOrderResult =
  | { ok: true; draft: OrderDraft; matchedSiteId: string | null }
  | { ok: false; message: string };

/** Office only: read a supplier order PDF into a draft to check. Nothing is saved. */
export async function parseOrderAction(formData: FormData): Promise<ParseOrderResult> {
  const tr = await getActionTranslator();
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") ?? "" };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.isAdmin) return { ok: false, message: tr("accessDenied") ?? "" };
  const upload = await readUpload(formData.get("file"), "order");
  if (!upload) return { ok: false, message: tr("documentTypeAllowed") ?? "" };
  let draft: OrderDraft;
  try {
    draft = parseOrderText(await pdfText(upload.bytes));
  } catch {
    return { ok: false, message: tr("invalidInput") ?? "" };
  }
  const sites = await withTenantContext(companyId, (tx) =>
    tx.baustelle.findMany({
      where: { companyProfileId: companyId, type: { not: "STEEL_WORKSHOP" } },
      select: { id: true, name: true },
    }),
  );
  const matched = draft.siteName ? sites.find((site) => sameSiteName(site.name, draft.siteName)) : undefined;
  return { ok: true, draft, matchedSiteId: matched?.id ?? null };
}

const lineSchema = z.object({
  title: z.string().trim().min(1).max(160),
  quantity: z.number().positive().max(1_000_000).nullable(),
  unit: z.enum(PRODUCTION_UNITS),
  price: z.number().min(0).max(1_000_000_000).nullable(),
});

const importSchema = z.object({
  siteId: z.string().max(64).nullable(),
  siteName: z.string().trim().max(160),
  address: z.string().trim().max(240),
  client: z.string().trim().max(160),
  supplier: z.string().trim().max(120),
  reference: z.string().trim().max(60),
  total: z.number().min(0).max(10_000_000_000).nullable(),
  currency: z.string().trim().max(8),
  lines: z.array(lineSchema).min(1).max(80),
});

/**
 * Office only: save a checked order. The material goes on the factory line for
 * its site; a site that does not exist yet is created from the order, and an
 * existing site gets the address or details it is missing. The PDF is kept with
 * the site's costs (office only).
 */
export async function importOrderAction(formData: FormData): Promise<ActionResult & { siteId?: string }> {
  const tr = await getActionTranslator();
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentCompanyActor(companyId);
  if (!actor?.isAdmin) return { ok: false, message: tr("accessDenied") };
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("draft") ?? ""));
  } catch {
    return { ok: false, message: tr("invalidInput") };
  }
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const order = parsed.data;
  if (!order.siteId && !order.siteName) return { ok: false, message: tr("invalidInput") };
  const upload = await readUpload(formData.get("file"), "order");
  if (!upload) return { ok: false, message: tr("documentTypeAllowed") };

  const details = [order.client ? `Klienti: ${order.client}` : "", order.reference ? `Porosia: ${order.reference}` : ""].filter(Boolean).join(" · ");

  const siteId = await withTenantContext(companyId, async (tx) => {
    let site = order.siteId
      ? await tx.baustelle.findFirst({
          where: { id: order.siteId, companyProfileId: companyId, type: { not: "STEEL_WORKSHOP" } },
          select: { id: true, address: true, description: true },
        })
      : null;
    if (order.siteId && !site) return null;
    if (!site) {
      const all = await tx.baustelle.findMany({
        where: { companyProfileId: companyId, type: { not: "STEEL_WORKSHOP" } },
        select: { id: true, name: true, address: true, description: true },
      });
      site = all.find((item) => sameSiteName(item.name, order.siteName)) ?? null;
    }
    if (!site) {
      site = await tx.baustelle.create({
        data: {
          companyProfileId: companyId,
          name: order.siteName,
          type: "STEEL_ASSEMBLY",
          status: "active",
          address: order.address || null,
          description: details || null,
        },
        select: { id: true, address: true, description: true },
      });
    } else if ((!site.address && order.address) || (!site.description && details)) {
      await tx.baustelle.update({
        where: { id: site.id },
        data: {
          ...(!site.address && order.address ? { address: order.address } : {}),
          ...(!site.description && details ? { description: details } : {}),
        },
      });
    }

    for (const line of order.lines) {
      const batch = await tx.productionBatch.create({
        data: {
          companyProfileId: companyId,
          baustelleId: site.id,
          title: line.title,
          quantity: line.quantity,
          unit: line.unit,
          steps: initialFactorySteps(),
          createdByName: actor.name,
          orderRef: order.reference || null,
        },
        select: { id: true },
      });
      await tx.productionEvent.create({
        data: {
          companyProfileId: companyId,
          batchId: batch.id,
          action: "create",
          toStatus: "waiting",
          note: [order.supplier, order.reference].filter(Boolean).join(" · ") || null,
          actorName: actor.name,
          actorUserId: actor.userId,
          actorWorkerId: actor.workerId,
        },
      });
    }

    await tx.siteFile.create({
      data: {
        companyProfileId: companyId,
        baustelleId: site.id,
        kind: "order",
        officeOnly: true,
        fileName: upload.fileName,
        mime: upload.mime,
        size: upload.size,
        data: upload.bytes,
        amount: order.total,
        currency: order.currency || "ALL",
        supplier: order.supplier || null,
        reference: order.reference || null,
        uploadedByName: actor.name,
      },
    });
    return site.id;
  });

  if (!siteId) return { ok: false, message: tr("siteNotFound") };
  revalidateSite(siteId);
  revalidatePath("/app/baustellen");
  return { ok: true, message: "OK", siteId };
}
