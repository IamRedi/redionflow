import { prisma } from "@/lib/db/prisma";

import { assistantNoAccessText } from "./access-text";

export { assistantNoAccessText };

/**
 * Who may use the AI assistant.
 *
 * By default every signed-in admin and worker may (unchanged behaviour). A
 * company can switch on `assistantAccessSelected`; then only the owner and the
 * people the boss enabled (`assistantAccess`) may. Everyone else sees a short
 * "ask your boss" message instead of the chat; nothing is sent to the provider.
 */
export type AssistantActor =
  | { kind: "admin"; adminId: string; companyId: string }
  | { kind: "worker"; workerId: string; companyId: string };

export async function hasAssistantAccess(actor: AssistantActor): Promise<boolean> {
  const company = await prisma.companyProfile.findUnique({
    where: { id: actor.companyId },
    select: { assistantAccessSelected: true },
  });
  if (!company) return false;
  if (!company.assistantAccessSelected) return true;
  if (actor.kind === "admin") {
    const user = await prisma.user.findFirst({
      where: { id: actor.adminId, companyProfileId: actor.companyId, isActive: true },
      select: { isOwner: true, assistantAccess: true },
    });
    return Boolean(user && (user.isOwner || user.assistantAccess));
  }
  const worker = await prisma.worker.findFirst({
    where: { id: actor.workerId, companyProfileId: actor.companyId, status: "active" },
    select: { assistantAccess: true },
  });
  return Boolean(worker?.assistantAccess);
}

/** Whether the company limits the assistant to selected people. */
export async function companyLimitsAssistant(companyId: string): Promise<boolean> {
  const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { assistantAccessSelected: true } });
  return Boolean(company?.assistantAccessSelected);
}

/** A plain answer (not an error) so the chat simply shows the message. */
export function assistantNoAccessResponse(language: string | null | undefined) {
  return new Response(assistantNoAccessText(language), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
