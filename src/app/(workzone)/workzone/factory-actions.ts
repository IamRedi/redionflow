"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentCompanyId } from "@/lib/db/tenant";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  applyStepCommand,
  batchState,
  initialFactorySteps,
  PRODUCTION_UNITS,
  readFactorySteps,
  StepCommandError,
  type StepCommand,
} from "@/lib/factory/production";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import type { ActionResult } from "@/lib/validation/action-result";
import { currentCompanyActor } from "@/lib/site-files/actor";
import { dispatchWorkNotification, type WorkNotification } from '@/lib/notifications/events';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { steelWorkLabel } from '@/components/steel/work-catalog-label';

const currentActor = currentCompanyActor;

function revalidateFactory(baustelleId: string) {
  revalidatePath("/workzone");
  revalidatePath(`/workzone/baustellen/${baustelleId}`);
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
}

const createSchema = z.object({
  baustelleId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(1_000_000).optional(),
  unit: z.enum(PRODUCTION_UNITS).default("t"),
});

/** Office only: put a material group for one construction site on the factory line. */
export async function createProductionBatchAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentActor(companyId);
  const { baustelleId, title, quantity, unit } = parsed.data;
  if (!actor?.at(baustelleId).office) return { ok: false, message: tr("accessDenied") };
  const created = await withTenantContext(companyId, async (tx) => {
    const site = await tx.baustelle.findFirst({ where: { id: baustelleId, companyProfileId: companyId }, select: { id: true, type: true } });
    if (!site || site.type === "STEEL_WORKSHOP") return null;
    const batch = await tx.productionBatch.create({
      data: {
        companyProfileId: companyId,
        baustelleId,
        title,
        quantity: quantity ?? null,
        unit,
        steps: initialFactorySteps(),
        createdByName: actor.name,
      },
      select: { id: true },
    });
    await tx.productionEvent.create({
      data: {
        companyProfileId: companyId,
        batchId: batch.id,
        action: "create",
        toStatus: "waiting",
        note: quantity ? `${title} · ${quantity} ${unit}` : title,
        actorName: actor.name,
        actorUserId: actor.userId,
        actorWorkerId: actor.workerId,
      },
    });
    return batch;
  });
  if (!created) return { ok: false, message: tr("accessDenied") };
  revalidateFactory(baustelleId);
  return { ok: true, message: "OK" };
}

const stepSchema = z.object({
  batchId: z.string().min(1).max(64),
  stepIndex: z.number().int().min(0).max(20),
  command: z.enum(["start", "done", "reopen", "block", "unblock", "note"]),
  text: z.string().max(500).optional().default(""),
});

/** Worker or office: one touch on one step of a material group. */
export async function updateProductionStepAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };
  const actor = await currentActor(companyId);
  if (!actor) return { ok: false, message: tr("notSignedIn") };
  // Factory engineer or admin only: the person responsible for the process.
  if (!actor.can.factorySteps) return { ok: false, message: tr("accessDenied") };

  const { batchId, stepIndex, command: kind, text } = parsed.data;
  const command: StepCommand = kind === "block" || kind === "note" ? { kind, text } : { kind };
  const lang = await resolveRequestLanguage();
  let notification: WorkNotification | null = null;

  const result = await withTenantContext(companyId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProductionBatch" WHERE "id"=${batchId} AND "companyProfileId"=${companyId} FOR UPDATE`;
    const batch = await tx.productionBatch.findFirst({
      where: { id: batchId, companyProfileId: companyId },
      select: { id: true, title: true, baustelleId: true, steps: true, readyAt: true, baustelle: { select: { name: true } } },
    });
    if (!batch) return { error: tr("accessDenied") ?? "Access denied" } as const;
    let change;
    try {
      change = applyStepCommand(readFactorySteps(batch.steps), stepIndex, command, actor.name, new Date());
    } catch (error) {
      if (error instanceof StepCommandError) return { error: tr("invalidInput") ?? "Invalid input" } as const;
      throw error;
    }
    const ready = batchState(change.steps) === "ready";
    await tx.productionBatch.update({
      where: { id: batch.id },
      data: { steps: change.steps, readyAt: ready ? (batch.readyAt ?? new Date()) : null },
    });
    const event = await tx.productionEvent.create({
      data: {
        companyProfileId: companyId,
        batchId: batch.id,
        stepKey: change.event.stepKey,
        action: change.event.action,
        fromStatus: change.event.fromStatus,
        toStatus: change.event.toStatus,
        note: change.event.note || null,
        actorName: actor.name,
        actorUserId: actor.userId,
        actorWorkerId: actor.workerId,
      },
    });
    if (change.event.toStatus === 'done' && change.event.fromStatus !== 'done') notification = { key: `batch:${event.id}`, kind: 'process', action: 'factory.view', siteId: batch.baustelleId, title: batch.baustelle.name, body: `✓ ${steelWorkLabel({ kind: 'factory', key: change.event.stepKey, label: '' }, lang)} · ${batch.title}`, url: `/workzone/baustellen/${batch.baustelleId}`, preference: 'workEnd' };
    return { baustelleId: batch.baustelleId } as const;
  });
  if ("error" in result) return { ok: false, message: String(result.error) };
  if (notification) await dispatchWorkNotification(companyId, notification);
  revalidateFactory(result.baustelleId);
  return { ok: true, message: "OK" };
}
