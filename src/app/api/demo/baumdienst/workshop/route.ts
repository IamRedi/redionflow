import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { mutationEnvelope } from "@/lib/workshop/shared-contract";
import { boundedBody, demoHeaders, workshopResponseError } from "@/lib/workshop/shared-http";
import { digest, ensureWorkshopDemo, requireWorkshopDemo, runWorkshopCommand, workshopSnapshot } from "@/lib/workshop/shared-store";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireWorkshopDemo(); await ensureWorkshopDemo();
    const snapshot = await prisma.$transaction(tx => workshopSnapshot(tx), { isolationLevel: "RepeatableRead" });
    const etag = `"workshop-${snapshot.revision}-${digest(JSON.stringify(snapshot.directory)).slice(0, 16)}"`;
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ...demoHeaders, ETag: etag } });
    return Response.json(snapshot, { headers: { ...demoHeaders, ETag: etag } });
  } catch (error) { return workshopResponseError(error); }
}
export async function POST(request: Request) {
  try {
    await requireWorkshopDemo();
    const rejected = rejectCrossOriginMutation(request); if (rejected) return rejected;
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "required" }, { status: 415, headers: demoHeaders });
    const envelope = mutationEnvelope.parse(JSON.parse((await boundedBody(request, 12000)).toString("utf8")));
    return Response.json(await runWorkshopCommand(envelope), { headers: demoHeaders });
  } catch (error) { return workshopResponseError(error); }
}
