import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/audit/log";
import { verifyStripeSignature } from "@/lib/billing/stripe-signature";
import { logger } from "@/lib/observability/logger";
import { isSaasMode } from "@/lib/saas-config";

/**
 * T-027 — Stripe webhook endpoint.
 *
 * Handles the subscription lifecycle events we care about:
 *   - `customer.subscription.created`
 *   - `customer.subscription.updated`
 *   - `customer.subscription.deleted`
 *   - `invoice.payment_failed`  → mark `past_due`
 *   - `invoice.payment_succeeded` → mark `active`
 *
 * Idempotency: every Stripe `event.id` is recorded in `StripeWebhookEvent`
 * on first successful processing. Replays return 200 without touching the
 * database again — Stripe expects this and retries otherwise.
 *
 * Signature verification uses `STRIPE_WEBHOOK_SECRET`. When either env var
 * is missing we return 503 so Stripe surfaces the misconfiguration.
 */
export const runtime = "nodejs";

type StripeSubscriptionEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      status?: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      items?: {
        data?: Array<{ price?: { id?: string } }>;
      };
    };
  };
};

const HANDLED_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

function mapStripeStatus(status: string | undefined): "trialing" | "active" | "past_due" | "canceled" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

export async function POST(request: NextRequest) {
  if (!isSaasMode) {
    return NextResponse.json({ ok: false, message: "Not enabled." }, { status: 404 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, signatureHeader, secret)) {
    return NextResponse.json({ ok: false, message: "Invalid signature." }, { status: 400 });
  }

  let event: StripeSubscriptionEvent;
  try {
    event = JSON.parse(rawBody) as StripeSubscriptionEvent;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed JSON." }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ ok: false, message: "Missing event id or type." }, { status: 400 });
  }

  // Idempotency: replay-safe short-circuit.
  const already = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true },
  });
  if (already) return NextResponse.json({ ok: true, replayed: true });

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    // Record it so Stripe stops retrying; we intentionally ignore the payload.
    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, eventType: event.type },
    });
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const obj = event.data.object;
  const stripeCustomerId = obj.customer ?? null;
  const stripeSubscriptionId = obj.id ?? null;
  const stripePriceId = obj.items?.data?.[0]?.price?.id ?? null;

  const company = stripeCustomerId
    ? await prisma.companyProfile.findFirst({
        where: { stripeCustomerId },
        select: { id: true },
      })
    : null;

  if (!company) {
    // Record the event so Stripe stops retrying; nothing else to do until a
    // signup or checkout links the Customer to a CompanyProfile.
    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, eventType: event.type },
    });
    return NextResponse.json({ ok: true, unlinked: true });
  }

  const plan = stripePriceId
    ? await prisma.plan.findUnique({ where: { stripePriceId }, select: { id: true } })
    : null;

  const currentPeriodEnd = obj.current_period_end
    ? new Date(obj.current_period_end * 1000)
    : undefined;

  const status =
    event.type === "invoice.payment_failed"
      ? "past_due"
      : event.type === "invoice.payment_succeeded"
        ? "active"
        : event.type === "customer.subscription.deleted"
          ? "canceled"
          : mapStripeStatus(obj.status);

  const previousStatus = (
    await prisma.subscription.findUnique({
      where: { companyProfileId: company.id },
      select: { status: true },
    })
  )?.status;

  await prisma.$transaction(async (tx) => {
    await tx.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, eventType: event.type },
    });

    await tx.subscription.upsert({
      where: { companyProfileId: company.id },
      create: {
        companyProfileId: company.id,
        planId: plan?.id ?? null,
        status,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        currentPeriodEnd: currentPeriodEnd ?? null,
        cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
      },
      update: {
        planId: plan?.id ?? undefined,
        status,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
        cancelAtPeriodEnd: obj.cancel_at_period_end ?? undefined,
      },
    });
  });

  // T-033: audit only when the tenant-visible status actually changed.
  if (previousStatus !== status) {
    await recordAudit({
      companyProfileId: company.id,
      actorType: "SYSTEM",
      action: "subscription.status_changed",
      payload: {
        previousStatus: previousStatus ?? null,
        nextStatus: status,
        stripeEventType: event.type,
      },
    }).catch((error) => {
      logger.error({ event: "stripe.webhook.audit_failed", stripeEventType: event.type }, "audit failed", error);
    });
  }

  return NextResponse.json({ ok: true, companyId: company.id, status });
}
