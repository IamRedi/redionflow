

import { prisma } from "@/lib/db/prisma";

import type { SyncActionResult, WorkzoneActorKind } from "@/lib/workzone/offline/types";

import { type AuthContext, type PendingAction } from "./schemas";

/** Idempotency log: every processed action id is stored with its outcome. */
export async function findExistingOutcome(actionId: string): Promise<SyncActionResult | null> {
  const existing = await prisma.workzoneSyncAction.findUnique({
    where: { id: actionId },
    select: { outcome: true, outcomeMsg: true },
  });
  if (!existing) return null;
  return {
    id: actionId,
    outcome: existing.outcome as SyncActionResult["outcome"],
    message: existing.outcomeMsg ?? undefined,
  };
}

export async function recordOutcome(
  actionId: string,
  auth: AuthContext,
  action: PendingAction,
  outcome: SyncActionResult["outcome"],
  outcomeMsg?: string,
): Promise<void> {
  await prisma.workzoneSyncAction.create({
    data: {
      id: actionId,
      companyProfileId: auth.companyProfileId,
      actorKind: auth.kind,
      actorId: auth.id,
      actionType: action.type,
      entityType: action.entityType,
      entityId: action.entityId,
      payload: action.payload ?? {},
      outcome,
      outcomeMsg: outcomeMsg ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Action processors
// ---------------------------------------------------------------------------
