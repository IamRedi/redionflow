import { randomUUID } from "node:crypto";
import { managedFileReference, parseManagedReference, safeObjectSegment, type ManagedReference, type StorageScope } from "./managed-reference";
import { validateManagedUpload } from "./upload-validation";
import { rm } from "node:fs/promises";
import path from "node:path";

type UploadOptions = {
  scope: StorageScope;
  entityId: string;
  file: File;
  fileName: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

const STORAGE_CONFIG: Record<
  StorageScope,
  {
    bucket: string;
    localFolder: string;
  }
> = {
  "worker-assets": {
    bucket: process.env.SUPABASE_STORAGE_PRIVATE_BUCKET_WORKERS?.trim() || "worker-private",
    localFolder: "workers",
  },
  "baustelle-documents": {
    bucket: process.env.SUPABASE_STORAGE_PRIVATE_BUCKET_BAUSTELLEN?.trim() || "baustelle-private",
    localFolder: "baustellen",
  },
};

function hasSupabaseStorage() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}


function localDiskPath(scope: StorageScope, entityId: string, fileName?: string) {
  const config = STORAGE_CONFIG[scope];
  return path.join(process.cwd(), "public", "uploads", config.localFolder, entityId, ...(fileName ? [fileName] : []));
}

function requireSupabaseStorage() {
  if (hasSupabaseStorage()) return;
  throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before uploading company files.");
}

function parseSupabasePublicUrl(url: string) {
  if (!/^https?:\/\//i.test(url) || !SUPABASE_URL) return null;

  try {
    const target = new URL(url);
    const base = new URL(SUPABASE_URL);
    if (target.origin !== base.origin) return null;

    const prefix = "/storage/v1/object/public/";
    if (!target.pathname.startsWith(prefix)) return null;
    const remainder = target.pathname.slice(prefix.length);
    const [bucket, ...pathParts] = remainder.split("/");
    const objectPath = pathParts.join("/");
    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

async function uploadToSupabase(bucket: string, objectPath: string, file: File, mime: string, signal?: AbortSignal) {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "x-upsert": "false",
        "Content-Type": mime,
      },
      body: Buffer.from(await file.arrayBuffer()),
      signal,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${response.status}): ${details || response.statusText}`);
  }

  return;
}

async function removeFromSupabase(bucket: string, objectPath: string) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/remove`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: bucket,
      prefixes: [objectPath],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage delete failed (${response.status}): ${details || response.statusText}`);
  }
}

async function clearSupabasePrefix(bucket: string, prefix: string) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase Storage list failed (${response.status}): ${details || response.statusText}`);
  }

  const items = (await response.json().catch(() => [])) as Array<{ name?: string }>;
  const objectPaths = items
    .map((item) => (item.name ? `${prefix}/${item.name}` : ""))
    .filter(Boolean);
  if (objectPaths.length === 0) return;

  const removeResponse = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/remove`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: bucket,
      prefixes: objectPaths,
    }),
    cache: "no-store",
  });

  if (!removeResponse.ok) {
    const details = await removeResponse.text().catch(() => "");
    throw new Error(`Supabase Storage prefix delete failed (${removeResponse.status}): ${details || removeResponse.statusText}`);
  }
}

async function requirePrivateBucket(bucket: string) {
  requireSupabaseStorage();
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY }, cache: "no-store",
  });
  if (!response.ok || (await response.json()).public !== false) throw new Error("Private storage bucket is required.");
}

export async function uploadManagedFile({ scope, entityId, file, fileName }: UploadOptions) {
  if (!safeObjectSegment(entityId) || !safeObjectSegment(fileName)) throw new Error("Invalid managed object path.");
  const mime = await validateManagedUpload(file, scope);
  const config = STORAGE_CONFIG[scope];
  await requirePrivateBucket(config.bucket);
  const storedName = `${randomUUID()}-${fileName}`;
  await uploadToSupabase(config.bucket, `${entityId}/${storedName}`, file, mime);
  return managedFileReference({ scope, entityId, fileName: storedName });
}

/** Server only. Call after current auth, tenant and metadata-membership checks. */
export async function readManagedFile(ref: ManagedReference) {
  if (!safeObjectSegment(ref.entityId) || !safeObjectSegment(ref.fileName)) throw new Error("Invalid managed object path.");
  const config = STORAGE_CONFIG[ref.scope];
  await requirePrivateBucket(config.bucket);
  return fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/authenticated/${encodeURIComponent(config.bucket)}/${encodeURIComponent(ref.entityId)}/${encodeURIComponent(ref.fileName)}`, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY }, cache: "no-store",
  });
}

type ManagedOwner = { scope: StorageScope; entityId: string };

export function isManagedFileOwnedBy(url: string, owner: ManagedOwner) {
  const config = STORAGE_CONFIG[owner.scope];
  const ref = parseManagedReference(url);
  if (ref) return ref.scope === owner.scope && ref.entityId === owner.entityId;
  const remote = parseSupabasePublicUrl(url);
  if (remote) return remote.bucket === config.bucket && remote.objectPath.startsWith(`${owner.entityId}/`) && !remote.objectPath.split("/").some(part => part === ".." || part === ".");
  const prefix = `/uploads/${config.localFolder}/${owner.entityId}/`;
  return url.startsWith(prefix) && !url.split("/").some(part => part === ".." || part === ".") && !url.includes("\\");
}

export async function deleteManagedFileByUrl(url: string, owner?: ManagedOwner) {
  const trimmed = url.trim();
  if (!trimmed) return;
  if (owner && !isManagedFileOwnedBy(trimmed, owner)) throw new Error("Managed file belongs to another entity.");

  const ref = parseManagedReference(trimmed);
  if (ref) {
    requireSupabaseStorage();
    await removeFromSupabase(STORAGE_CONFIG[ref.scope].bucket, `${ref.entityId}/${ref.fileName}`);
    return;
  }

  const supabaseFile = parseSupabasePublicUrl(trimmed);
  if (supabaseFile && hasSupabaseStorage()) {
    await removeFromSupabase(supabaseFile.bucket, supabaseFile.objectPath);
    return;
  }

  if (trimmed.startsWith("/uploads/")) {
    const relative = trimmed.replace(/^\/+/, "");
    const root = path.resolve(process.cwd(), "public", "uploads");
    const target = path.resolve(process.cwd(), "public", relative);
    if (!target.startsWith(root + path.sep)) throw new Error("Invalid managed upload path.");
    await rm(target, { force: true });
  }
}

export async function deleteManagedFiles(urls: string[], owner: ManagedOwner) {
  for (const url of urls) {
    try {
      await deleteManagedFileByUrl(url, owner);
    } catch {
      // Deletion must stay best-effort so legacy paths or already-missing files do not break user flows.
    }
  }
}

export async function clearManagedEntityFolder(scope: StorageScope, entityId: string) {
  if (hasSupabaseStorage()) {
    await clearSupabasePrefix(STORAGE_CONFIG[scope].bucket, entityId);
  }

  // Keep this legacy cleanup for old local dev uploads. New uploads never write to public/uploads.
  await rm(localDiskPath(scope, entityId), { recursive: true, force: true });
}

export type PendingImport = {
  version: 1;
  id: string;
  companyId: string;
  entityId: string;
  expiresAt: number;
  fileNames: string[];
};
const pendingManifestPath = (id: string) => `pending-imports/${id}.json`;
const importBucket = () => STORAGE_CONFIG["baustelle-documents"].bucket;

// Supabase Storage remove API: DELETE /object/{bucket}, { prefixes }.
async function removePendingObject(objectPath: string) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(importBucket())}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [objectPath] }), cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Supabase Storage delete failed (${response.status}).`);
}

/** Plans every key before the first request, including ambiguous upload failures. */
export function planPendingImport(companyId: string, entityId: string, files: File[]): PendingImport {
  if (!safeObjectSegment(companyId) || !safeObjectSegment(entityId)) throw new Error("Invalid pending import owner.");
  return { version: 1, id: randomUUID(), companyId, entityId, expiresAt: Date.now() + 86_400_000,
    fileNames: files.map(file => `${randomUUID()}-${file.name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}${path.extname(file.name).toLowerCase()}`) };
}
export function pendingImportReferences(batch: PendingImport) {
  return batch.fileNames.map(fileName => managedFileReference({ scope: "baustelle-documents", entityId: batch.entityId, fileName }));
}

export async function uploadPendingImport(batch: PendingImport, files: File[]) {
  if (batch.fileNames.length !== files.length) throw new Error("Invalid pending import files.");
  const mimeTypes = await Promise.all(files.map(file => validateManagedUpload(file, "baustelle-documents")));
  await requirePrivateBucket(importBucket());
  // A private durable journal survives process termination and cleanup outages.
  await uploadToSupabase(importBucket(), pendingManifestPath(batch.id),
    new File([JSON.stringify(batch)], "pending.json", { type: "application/json" }), "application/json", AbortSignal.timeout(30_000));
  for (const [index, file] of files.entries()) {
    await uploadToSupabase(importBucket(), `${batch.entityId}/${batch.fileNames[index]}`, file, mimeTypes[index], AbortSignal.timeout(30_000));
  }
}

/** Idempotent. Keep the journal until every uncommitted object has been removed. */
export async function abortPendingImport(batch: PendingImport) {
  for (const fileName of batch.fileNames) await removePendingObject( `${batch.entityId}/${fileName}`);
  await finalizePendingImport(batch);
}
/** DB references activate the objects atomically; no storage copy is necessary. */
export async function finalizePendingImport(batch: PendingImport) {
  await removePendingObject( pendingManifestPath(batch.id));
}

/** Server-only recovery. Caller supplies an authoritative tenant-scoped DB read.
 * Expiry exceeds the bounded DB transaction timeout; active imports cannot be swept.
 * A failed recovery retains the journal and can be retried with the same ID.
 */
export async function reconcilePendingImport(id: string,
  readDocuments: (companyId: string, entityId: string) => Promise<string[]>, now = Date.now()) {
  if (!safeObjectSegment(id)) throw new Error("Invalid pending import ID.");
  await requirePrivateBucket(importBucket());
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/authenticated/${importBucket()}/${pendingManifestPath(id)}`, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY }, cache: "no-store",
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error("Pending import journal read failed.");
  const batch = await response.json() as PendingImport;
  if (batch.version !== 1 || batch.id !== id || !safeObjectSegment(batch.companyId) || !safeObjectSegment(batch.entityId)
    || !Array.isArray(batch.fileNames) || !batch.fileNames.every(name => typeof name === "string" && safeObjectSegment(name))
    || !Number.isFinite(batch.expiresAt)) throw new Error("Invalid pending import journal.");
  if (now < batch.expiresAt) throw new Error("Pending import is still active.");
  const documents = new Set(await readDocuments(batch.companyId, batch.entityId));
  const references = pendingImportReferences(batch);
  for (const [index, fileName] of batch.fileNames.entries()) {
    if (!documents.has(references[index])) await removePendingObject( `${batch.entityId}/${fileName}`);
  }
  await finalizePendingImport(batch);
}
