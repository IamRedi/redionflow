import { createHash } from "node:crypto";

import { withTenantContext } from "@/lib/db/tenant-context";
import { logger } from "@/lib/observability/logger";

/**
 * Signals for the platform team: what users miss, bugs, questions the guide
 * could not answer and system errors the assistant hit. Stored per company
 * (deduplicated) and forwarded to the operator's hub when REDION_HUB_URL and
 * REDION_HUB_KEY are set. Recording never breaks the user's request.
 */
export type PlatformSignalKind = "feature" | "bug" | "question" | "error";
export type PlatformSignalActor = { companyId: string; kind: "admin" | "worker"; id: string; name?: string; language?: string };
export type PlatformSignalInput = { kind: PlatformSignalKind; title: string; details?: string };

const clip = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function signalFingerprint(kind: PlatformSignalKind, title: string) {
  const normal = title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return createHash("sha256").update(`${kind}:${normal}`).digest("hex").slice(0, 32);
}

export async function recordPlatformSignal(actor: PlatformSignalActor, input: PlatformSignalInput) {
  const title = clip(input.title, 200);
  if (!title) return null;
  const details = clip(input.details ?? "", 2000);
  const fingerprint = signalFingerprint(input.kind, title);
  try {
    const signal = await withTenantContext(actor.companyId, tx => tx.platformSignal.upsert({
      where: { companyProfileId_fingerprint: { companyProfileId: actor.companyId, fingerprint } },
      create: {
        companyProfileId: actor.companyId, kind: input.kind, title, details, fingerprint,
        actorKind: actor.kind, actorId: actor.id, actorName: clip(actor.name ?? "", 120), language: actor.language ?? "",
      },
      // A repeat counts and is forwarded again, so the hub sees it is recurring.
      update: { count: { increment: 1 }, lastSeenAt: new Date(), forwardedAt: null, ...(details ? { details } : {}) },
    }));
    void forwardPendingSignals(actor.companyId).catch(() => {});
    return { id: signal.id, count: signal.count };
  } catch (error) {
    logger.warn({ event: "platform_signal.record_failed", kind: input.kind, error: error instanceof Error ? error.message : "unknown" }, "Platform signal not stored");
    return null;
  }
}

function hubConfig() {
  const url = process.env.REDION_HUB_URL?.trim();
  const key = process.env.REDION_HUB_KEY?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/** Sends unforwarded signals of one company to the hub; failures retry on the next signal. */
export async function forwardPendingSignals(companyId: string, fetcher: typeof fetch = fetch) {
  const hub = hubConfig();
  if (!hub) return 0;
  const [company, pending] = await withTenantContext(companyId, tx => Promise.all([
    tx.companyProfile.findUnique({ where: { id: companyId }, select: { legalName: true, mode: true } }),
    tx.platformSignal.findMany({ where: { companyProfileId: companyId, forwardedAt: null, forwardAttempts: { lt: 20 } }, orderBy: { lastSeenAt: "asc" }, take: 20 }),
  ]));
  if (!company || !pending.length) return 0;
  const platform = process.env.REDION_PLATFORM_NAME?.trim() || (company.mode === "bau" ? "BauFlow" : "BaumdienstFlow");
  let sent = 0;
  for (const signal of pending) {
    let ok = false;
    try {
      const response = await fetcher(`${hub.url}/api/signals`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${hub.key}` },
        body: JSON.stringify({
          platform, externalId: signal.id, company: { id: companyId, name: company.legalName },
          kind: signal.kind, title: signal.title, details: signal.details, count: signal.count,
          actor: { kind: signal.actorKind, name: signal.actorName }, language: signal.language,
          firstSeenAt: signal.createdAt.toISOString(), lastSeenAt: signal.lastSeenAt.toISOString(),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      ok = response.ok;
    } catch { ok = false; }
    await withTenantContext(companyId, tx => tx.platformSignal.updateMany({
      where: { id: signal.id, lastSeenAt: signal.lastSeenAt },
      data: ok ? { forwardedAt: new Date(), forwardAttempts: 0 } : { forwardAttempts: { increment: 1 } },
    }));
    if (ok) sent += 1; else break;
  }
  return sent;
}

