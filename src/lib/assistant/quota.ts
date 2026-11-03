import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import { logger } from "@/lib/observability/logger";
import type { RequesterContext } from "./requester";
import { ASSISTANT_MAX_INPUT_BYTES, ASSISTANT_MAX_OUTPUT_TOKENS, assistantSteps } from "./limits";

type Identity = Exclude<RequesterContext, { kind: "anonymous" }>;
type Denied = { ok: false; status: 403 | 429 | 503; reason: "rate" | "budget" | "unavailable"; retryAfterSeconds: number };
const BURST_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
function setting(name: string, fallback: number, ceiling: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) throw new Error("Invalid assistant quota configuration");
  return value;
}

/** Durable reservations share one company lock across both routes and replicas.
 * No transcript, prompt, IP, API key or tool result is stored. A failed/aborted
 * request keeps its conservative charge until the UTC day expires. */
export async function reserveAssistantQuota(requester: Identity, now = new Date()) {
  try {
    const companyId = await getCurrentCompanyId();
    if (!companyId || companyId !== requester.companyId) return { ok: false, status: 403, reason: "unavailable", retryAfterSeconds: 60 } satisfies Denied;
    const actorKey = `${requester.kind}:${requester.kind === "admin" ? requester.adminId : requester.workerId}`;
    const burstStart = new Date(Math.floor(now.getTime() / BURST_MS) * BURST_MS);
    const dayStart = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
    const reservation = assistantSteps(requester.kind) * (ASSISTANT_MAX_INPUT_BYTES + ASSISTANT_MAX_OUTPUT_TOKENS);
    const buckets = [
      { actorKey, window: "burst", windowStart: burstStart, requests: setting("ASSISTANT_USER_BURST_REQUESTS", 6, 100), tokens: null },
      { actorKey: "company", window: "burst", windowStart: burstStart, requests: setting("ASSISTANT_COMPANY_BURST_REQUESTS", 30, 1_000), tokens: null },
      { actorKey, window: "day", windowStart: dayStart, requests: setting("ASSISTANT_USER_DAILY_REQUESTS", 50, 10_000), tokens: setting("ASSISTANT_USER_DAILY_TOKENS", 500_000, 50_000_000) },
      { actorKey: "company", window: "day", windowStart: dayStart, requests: setting("ASSISTANT_COMPANY_DAILY_REQUESTS", 200, 100_000), tokens: setting("ASSISTANT_COMPANY_DAILY_TOKENS", 1_000_000, 100_000_000) },
    ];
    const access = await withTenantContext(companyId, async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant:${companyId}`}))`;
      const rows = [];
      for (const bucket of buckets) {
        const row = await tx.assistantQuotaBucket.upsert({
          where: { companyProfileId_actorKey_window_windowStart: { companyProfileId: companyId, actorKey: bucket.actorKey, window: bucket.window, windowStart: bucket.windowStart } },
          create: { companyProfileId: companyId, actorKey: bucket.actorKey, window: bucket.window, windowStart: bucket.windowStart }, update: {},
        });
        if (row.requests >= bucket.requests || (bucket.tokens !== null && row.tokens + reservation > bucket.tokens)) {
          const end = bucket.windowStart.getTime() + (bucket.window === "day" ? DAY_MS : BURST_MS);
          return { ok: false, status: 429, reason: bucket.window === "day" ? "budget" : "rate", retryAfterSeconds: Math.max(1, Math.ceil((end - now.getTime()) / 1_000)) } satisfies Denied;
        }
        rows.push({ id: row.id, daily: bucket.window === "day" });
      }
      // Only charge after every scope passes, so a rejection consumes nothing.
      for (const row of rows) await tx.assistantQuotaBucket.update({ where: { id: row.id }, data: { requests: { increment: 1 }, ...(row.daily ? { tokens: { increment: reservation } } : {}) } });
      await tx.assistantQuotaBucket.deleteMany({ where: { companyProfileId: companyId, windowStart: { lt: new Date(dayStart.getTime() - 32 * DAY_MS) } } });
      return { ok: true as const, dailyIds: rows.filter(row => row.daily).map(row => row.id) };
    });
    if (!access.ok) return access;
    let settled = false;
    return {
      ok: true as const,
      reservation,
      async settle(actualTokens?: number) {
        if (settled) return;
        settled = true;
        if (!Number.isSafeInteger(actualTokens) || actualTokens! < 0 || actualTokens! > reservation) return;
        try {
          await withTenantContext(companyId, async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant:${companyId}`}))`;
            await tx.assistantQuotaBucket.updateMany({ where: { companyProfileId: companyId, id: { in: access.dailyIds } }, data: { tokens: { increment: actualTokens! - reservation } } });
          });
          logger.info({ event: "assistant.usage", tenantId: companyId, kind: requester.kind, tokens: actualTokens }, "Assistant usage settled");
        } catch {
          logger.error({ event: "assistant.quota_settlement_failed" }, "Reserved quota retained");
        }
      },
    };
  } catch {
    logger.error({ event: "assistant.quota_unavailable" }, "Assistant unavailable; quota failed closed");
    return { ok: false, status: 503, reason: "unavailable", retryAfterSeconds: 60 } satisfies Denied;
  }
}

export function assistantQuotaResponse(access: Denied, lang: string) {
  const copy: Record<string, [string, string, string]> = {
    SQ: ["Shumë kërkesa. Provo përsëri pas pak.", "Kufiri ditor i asistentit u arrit. Provo përsëri nesër.", "Asistenti përkohësisht nuk është i disponueshëm. Provo përsëri pas pak."],
    EN: ["Too many requests. Please try again shortly.", "The assistant's daily limit has been reached. Please try again tomorrow.", "The assistant is temporarily unavailable. Please try again shortly."],
    DE: ["Zu viele Anfragen. Bitte gleich erneut versuchen.", "Das Tageslimit des Assistenten wurde erreicht. Bitte morgen erneut versuchen.", "Der Assistent ist vorübergehend nicht verfügbar. Bitte gleich erneut versuchen."],
    IT: ["Troppe richieste. Riprova tra poco.", "Limite giornaliero dell'assistente raggiunto. Riprova domani.", "Assistente temporaneamente non disponibile. Riprova tra poco."],
    PL: ["Za dużo zapytań. Spróbuj za chwilę.", "Osiągnięto dzienny limit asystenta. Spróbuj jutro.", "Asystent jest chwilowo niedostępny. Spróbuj za chwilę."],
    RO: ["Prea multe cereri. Încearcă din nou în curând.", "Limita zilnică a asistentului a fost atinsă. Încearcă mâine.", "Asistentul este temporar indisponibil. Încearcă din nou în curând."],
  };
  const index = access.reason === "rate" ? 0 : access.reason === "budget" ? 1 : 2;
  return Response.json({ error: (copy[lang] ?? copy.EN)[index] }, { status: access.status, headers: { "Retry-After": String(access.retryAfterSeconds), "Cache-Control": "no-store" } });
}
