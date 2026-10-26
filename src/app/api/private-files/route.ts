import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { managedFileReference, parseManagedReference } from "@/lib/storage/managed-reference";
import { readManagedFile } from "@/lib/storage/object-storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const denied = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const companyProfileId = await getCurrentCompanyId();
  if (!companyProfileId) return new Response("Unauthorized", {status:401,headers:{"Cache-Control":"private, no-store"}});
  const ref = parseManagedReference(`/api/private-files${new URL(request.url).search}`);
  if (!ref) return denied();
  const stored = managedFileReference(ref);
  if (ref.scope === "baustelle-documents") {
    const site = await prisma.baustelle.findFirst({where:{id:ref.entityId,companyProfileId},select:{documents:true}});
    if (!site?.documents.includes(stored)) return denied();
  } else {
    const [worker, admin, currentWorker] = await Promise.all([
      prisma.worker.findFirst({where:{id:ref.entityId,companyProfileId},select:{documents:true,profileImageUrl:true}}),
      getCurrentAdmin(),getCurrentWorker(),
    ]);
    if (!worker) return denied();
    const photo = worker.profileImageUrl === stored;
    const docs = Array.isArray(worker.documents) ? worker.documents : [];
    const member = docs.some(doc => typeof doc === "object" && doc !== null && "url" in doc && doc.url === stored);
    // Team profile pictures are shared within the company; documents are owner/admin only.
    if (!photo && (!member || (!admin && currentWorker?.id !== ref.entityId))) return denied();
  }
  try {
    const upstream = await readManagedFile(ref);
    if (!upstream.ok) return denied();
    const type = upstream.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const image = ["image/jpeg","image/png","image/gif","image/webp"].includes(type);
    return new Response(upstream.body, { headers: {
      "Content-Type": image ? type : "application/octet-stream",
      "Content-Disposition": `${image ? "inline" : "attachment"}; filename="${ref.fileName}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'none'; sandbox", "Cross-Origin-Resource-Policy":"same-origin",
    } });
  } catch { return new Response("Storage unavailable", { status:503,headers:{"Cache-Control":"private, no-store"} }); }
}
