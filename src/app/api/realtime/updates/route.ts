import { isSaasMode } from "@/lib/saas-config";
import { getCurrentCompanyId } from "@/lib/db/tenant";
import { subscribeRealtimeUpdates } from "@/lib/realtime/event-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const companyProfileId = (await getCurrentCompanyId()) ?? undefined;
  if (isSaasMode && !companyProfileId) return new Response("Unauthorized", { status: 401 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      send(JSON.stringify({ event: "connected", scope: [] }));
      const unsubscribe = subscribeRealtimeUpdates((payload) => send(payload), {
        companyProfileId,
      });
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, 25000);

      cleanup = () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream already closed by runtime/client.
        }
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
