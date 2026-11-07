import { prisma } from "@/lib/db/prisma";
import { withTenantContext } from "@/lib/db/tenant-context";

import type { StorageScope } from "./managed-reference";

/**
 * Private files kept in Postgres (table ManagedFile) for installations without
 * Supabase Storage, such as the Railway pilot. Same contract as the Supabase
 * path in object-storage.ts: callers check access first; reads go only through
 * /api/private-files. The owning company comes from the entity (worker or site),
 * so a file can never be written under another tenant.
 */
async function ownerCompany(scope: StorageScope, entityId: string) {
  const owner = scope === "worker-assets"
    ? await prisma.worker.findUnique({ where: { id: entityId }, select: { companyProfileId: true } })
    : await prisma.baustelle.findUnique({ where: { id: entityId }, select: { companyProfileId: true } });
  if (!owner?.companyProfileId) throw new Error("Managed file owner not found.");
  return owner.companyProfileId;
}

export async function putDbObject(scope: StorageScope, entityId: string, fileName: string, file: File, mime: string) {
  const companyProfileId = await ownerCompany(scope, entityId);
  const data = new Uint8Array(await file.arrayBuffer());
  await withTenantContext(companyProfileId, tx => tx.managedFile.create({
    data: { companyProfileId, scope, entityId, fileName, mime, size: data.byteLength, data },
    select: { id: true },
  }));
}

/** Returns a Response like the Supabase read so /api/private-files stays unchanged. */
export async function readDbObject(scope: StorageScope, entityId: string, fileName: string) {
  const companyProfileId = await ownerCompany(scope, entityId).catch(() => null);
  if (!companyProfileId) return new Response(null, { status: 404 });
  const row = await withTenantContext(companyProfileId, tx => tx.managedFile.findUnique({
    where: { scope_entityId_fileName: { scope, entityId, fileName } },
    select: { mime: true, data: true },
  }));
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "content-type": row.mime } });
}

export async function deleteDbObjects(scope: StorageScope, entityId: string, fileNames?: string[]) {
  const companyProfileId = await ownerCompany(scope, entityId).catch(() => null);
  if (!companyProfileId) return;
  await withTenantContext(companyProfileId, tx => tx.managedFile.deleteMany({
    where: { companyProfileId, scope, entityId, ...(fileNames ? { fileName: { in: fileNames } } : {}) },
  }));
}
