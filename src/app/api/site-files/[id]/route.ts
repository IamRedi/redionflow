import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { currentCompanyActor } from "@/lib/site-files/actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const notFound = () => new Response("Not found", { status: 404, headers: NO_STORE });

/** A site file for a signed-in member of the same company; office files only for admins. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  const actor = await currentCompanyActor(companyId);
  if (!actor) return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound();

  const file = await withTenantContext(companyId, (tx) =>
    tx.siteFile.findFirst({
      where: { id, companyProfileId: companyId },
      select: { data: true, mime: true, fileName: true, officeOnly: true, baustelleId: true },
    }),
  );
  if (!file || (file.officeOnly && !actor.at(file.baustelleId).office && !actor.allows("costs.view"))) return notFound();

  const download = new URL(request.url).searchParams.has("download");
  const inline = !download && (file.mime.startsWith("image/") || file.mime === "application/pdf");
  const encoded = encodeURIComponent(file.fileName);
  return new Response(new Uint8Array(file.data), {
    headers: {
      ...NO_STORE,
      "Content-Type": file.mime,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      ...(file.mime.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),
    },
  });
}
