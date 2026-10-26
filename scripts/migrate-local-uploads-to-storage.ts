import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/db/prisma";
import { uploadManagedFile } from "../src/lib/storage/object-storage";
import { isRecord } from "../src/lib/workzone/site-json";

function mimeTypeFromName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

function isLocalUploadUrl(url: string) {
  return url.startsWith("/uploads/");
}

function toDiskPath(uploadUrl: string) {
  return path.join(process.cwd(), "public", uploadUrl.replace(/^\/+/, ""));
}

async function uploadFromLocalUrl(scope: "worker-assets" | "baustelle-documents", entityId: string, url: string) {
  const fileName = path.basename(url);
  const buffer = await readFile(toDiskPath(url));
  const file = new File([buffer], fileName, { type: mimeTypeFromName(fileName) });
  return uploadManagedFile({
    scope,
    entityId,
    file,
    fileName,
  });
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
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
      .filter((item) => typeof item?.url === "string")
    .map((item) => ({
      id: String(item.id ?? item.url),
      label: String(item.label ?? item.filename ?? "Dokument"),
      type: String(item.type ?? "document"),
      url: String(item.url),
      filename: String(item.filename ?? path.basename(String(item.url ?? ""))),
      uploadedAt: String(item.uploadedAt ?? new Date().toISOString()),
    }));
}

async function migrateWorkers() {
  const workers = await prisma.worker.findMany({
    select: {
      id: true,
      profileImageUrl: true,
      documents: true,
    },
  });

  for (const worker of workers) {
    let nextProfileImageUrl = worker.profileImageUrl;
    let changed = false;

    if (worker.profileImageUrl && isLocalUploadUrl(worker.profileImageUrl)) {
      try {
        nextProfileImageUrl = await uploadFromLocalUrl("worker-assets", worker.id, worker.profileImageUrl);
        changed = true;
      } catch (error) {
        console.warn(`[migrate-storage] worker photo skipped ${worker.id}:`, error);
      }
    }

    const currentDocuments = parseWorkerDocuments(worker.documents);
    const nextDocuments: WorkerDocument[] = [];

    for (const document of currentDocuments) {
      if (!isLocalUploadUrl(document.url)) {
        nextDocuments.push(document);
        continue;
      }

      try {
        const nextUrl = await uploadFromLocalUrl("worker-assets", worker.id, document.url);
        nextDocuments.push({ ...document, url: nextUrl });
        changed = true;
      } catch (error) {
        console.warn(`[migrate-storage] worker document skipped ${worker.id}/${document.id}:`, error);
        nextDocuments.push(document);
      }
    }

    if (changed) {
      await prisma.worker.update({
        where: { id: worker.id },
        data: {
          profileImageUrl: nextProfileImageUrl,
          documents: nextDocuments,
        },
      });
    }
  }
}

async function migrateBaustellen() {
  const baustellen = await prisma.baustelle.findMany({
    select: {
      id: true,
      documents: true,
    },
  });

  for (const baustelle of baustellen) {
    let changed = false;
    const nextDocuments: string[] = [];

    for (const document of baustelle.documents ?? []) {
      if (!isLocalUploadUrl(document)) {
        nextDocuments.push(document);
        continue;
      }

      try {
        const nextUrl = await uploadFromLocalUrl("baustelle-documents", baustelle.id, document);
        nextDocuments.push(nextUrl);
        changed = true;
      } catch (error) {
        console.warn(`[migrate-storage] baustelle document skipped ${baustelle.id}:`, error);
        nextDocuments.push(document);
      }
    }

    if (changed) {
      await prisma.baustelle.update({
        where: { id: baustelle.id },
        data: { documents: nextDocuments },
      });
    }
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sind erforderlich.");
  }

  console.log("[migrate-storage] start");
  await migrateWorkers();
  await migrateBaustellen();
  console.log("[migrate-storage] done");
}

main()
  .catch((error) => {
    console.error("[migrate-storage] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
