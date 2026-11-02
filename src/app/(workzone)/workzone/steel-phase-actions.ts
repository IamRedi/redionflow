"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getCurrentCompanyId, isOwnedByCurrentCompany } from "@/lib/db/tenant";
import { getActionTranslator } from "@/lib/i18n/action-messages";
import { notifyRealtimeUpdate } from "@/lib/realtime/event-hub";
import type { ActionResult } from "@/lib/validation/action-result";
import { getCurrentWorker } from "@/lib/workzone/worker-session";
import {
  applySteelPhaseCommand,
  readSteelPhaseMeta,
  steelPhaseKeyFromTreeId,
  type SteelPhaseCommand,
} from "@/lib/workzone/steel-phases";

const steelPhaseSchema = z.object({
  phaseItemId: z.string().min(1).max(64),
  command: z.enum(["done", "reopen", "note", "missing", "materialArrived"]),
  text: z.string().max(500).optional().default(""),
});

/**
 * One touch on a steel work phase: finished, reopen, note, material missing
 * or material arrived. The actor comes from the signed session, never from
 * the client.
 */
export async function updateSteelPhaseAction(input: unknown): Promise<ActionResult> {
  const tr = await getActionTranslator();
  const parsed = steelPhaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: tr("invalidInput") };

  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, message: tr("notSignedIn") };

  const [worker, admin] = await Promise.all([getCurrentWorker(), getCurrentAdmin()]);
  const actorWorker = worker && worker.companyProfileId === companyId ? worker : null;
  const actorAdmin = !actorWorker && admin && admin.companyProfileId === companyId ? admin : null;
  if (!actorWorker && !actorAdmin) return { ok: false, message: tr("notSignedIn") };
  const actorName = actorWorker
    ? `${actorWorker.firstName} ${actorWorker.lastName}`.trim()
    : (actorAdmin!.name ?? actorAdmin!.email ?? "Admin").trim();

  const item = await prisma.treeItem.findUnique({
    where: { id: parsed.data.phaseItemId },
    include: { baustelle: { select: { id: true, companyProfileId: true, status: true } } },
  });
  if (!item || !steelPhaseKeyFromTreeId(item.treeId)) return { ok: false, message: tr("treeNotFound") };
  if (!isOwnedByCurrentCompany(item.baustelle, companyId)) return { ok: false, message: tr("accessDenied") };

  const text = parsed.data.text.trim();
  let command: SteelPhaseCommand;
  switch (parsed.data.command) {
    case "done":
      command = { kind: "done", actor: actorName };
      break;
    case "reopen":
      command = { kind: "reopen" };
      break;
    case "note":
      command = { kind: "note", actor: actorName, text };
      break;
    case "missing":
      if (!text) return { ok: false, message: tr("invalidInput") };
      command = { kind: "missing", actor: actorName, text };
      break;
    default:
      command = { kind: "materialArrived" };
  }

  const next = applySteelPhaseCommand({ status: item.status, meta: readSteelPhaseMeta(item.notes) }, command, new Date());
  const finished = next.status === "done";
  await prisma.treeItem.update({
    where: { id: item.id },
    data: {
      status: next.status,
      notes: JSON.stringify(next.meta),
      lastEditedBy: actorName,
      lastEditedAt: new Date(),
      ...(finished && item.status !== "done"
        ? actorWorker
          ? { completedAt: new Date(), completedBy: null, completedByWorkerId: actorWorker.id }
          : { completedAt: new Date(), completedBy: actorAdmin!.id, completedByWorkerId: null }
        : {}),
      ...(!finished ? { completedAt: null, completedBy: null, completedByWorkerId: null } : {}),
    },
  });

  revalidatePath(`/workzone/baustellen/${item.baustelleId}`);
  revalidatePath("/workzone");
  notifyRealtimeUpdate("tree.updated", ["tree-list", "baustelle-progress"]);
  return { ok: true, message: "OK" };
}
