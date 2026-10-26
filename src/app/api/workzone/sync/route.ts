import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import type { SyncActionResult, SyncResponse } from "@/lib/workzone/offline/types";
import { syncMessages, type SyncMessages } from "@/lib/workzone/sync/messages";
import { findExistingOutcome, recordOutcome } from "@/lib/workzone/sync/outcome";
import { syncRequestSchema, type AuthContext, type PendingAction } from "@/lib/workzone/sync/schemas";
import {
  processAddManualTask,
  processAddReportNote,
  processCheckTree,
  processClearManualTask,
  processStartWork,
  processStopWork,
} from "@/lib/workzone/sync/process-work";
import { processSiteEquipmentMovement } from "@/lib/workzone/sync/process-equipment";

async function resolveAuthContext(): Promise<AuthContext | null> {
  const worker = await getCurrentWorker();
  if (worker?.status === "active") {
    return { kind: "WORKER", id: worker.id, companyProfileId: worker.companyProfileId };
  }

  const admin = await getCurrentAdmin();
  if (admin) {
    const company = await prisma.companyProfile.findFirst({ select: { id: true } });
    if (company) return { kind: "ADMIN", id: admin.id, companyProfileId: company.id };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function processAction(
  action: PendingAction,
  auth: AuthContext,
  m: SyncMessages,
): Promise<SyncActionResult> {
  if (action.actorKind !== auth.kind || action.actorId !== auth.id) {
    const msg = m.actorMismatchTarget;
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  if (action.companyProfileId !== auth.companyProfileId) {
    const msg = m.companyMismatchTarget;
    await recordOutcome(action.id, auth, action, "rejected", msg);
    return { id: action.id, outcome: "rejected", message: msg };
  }

  switch (action.type) {
    case "START_WORK":
      return processStartWork(action, auth, m);
    case "STOP_WORK":
      return processStopWork(action, auth, m);
    case "CHECK_TREE":
    case "UNDO_TREE":
      return processCheckTree(action, auth, m);
    case "ADD_MANUAL_TASK":
      return processAddManualTask(action, auth, m);
    case "CLEAR_MANUAL_TASK":
      return processClearManualTask(action, auth, m);
    case "ADD_REPORT_NOTE":
      return processAddReportNote(action, auth, m);
    case "SITE_EQUIPMENT_MOVEMENT":
      return processSiteEquipmentMovement(action, auth, m);
    default:
      // UPLOAD_DOCUMENT — Phase 5
      return {
        id: action.id,
        outcome: "retryable_error",
        message: m.unsupportedAction(action.type),
      };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SyncResponse | { ok: false; message: string }>> {
  const originDenied = rejectCrossOriginMutation(request);
  if (originDenied) return originDenied;
  const m = syncMessages(await resolveRequestLanguage());
  const auth = await resolveAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, message: m.unauthorized }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: m.invalidJsonBody }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: m.invalidRequestPayload }, { status: 400 });
  }

  const results: SyncActionResult[] = [];

  for (const action of parsed.data.actions) {
    const existing = await findExistingOutcome(action.id);
    if (existing) {
      results.push(existing);
      continue;
    }

    const result = await processAction(action, auth, m);
    results.push(result);
  }

  return NextResponse.json({ results });
}
