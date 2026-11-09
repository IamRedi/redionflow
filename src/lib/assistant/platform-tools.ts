import type { ToolSet } from "ai";
import { z } from "zod";

import { recordPlatformSignal, type PlatformSignalActor } from "@/lib/platform-signals/record";
import type { AssistantFailure } from "./diagnostics";
import { searchPlatformGuide, steelPlatformGuide } from "./platform-guide";
import type { RequesterContext } from "./requester";

type Known = Exclude<RequesterContext, { kind: "anonymous" }>;

export function signalActor(requester: Known): PlatformSignalActor {
  return {
    companyId: requester.companyId,
    kind: requester.kind,
    id: requester.kind === "admin" ? requester.adminId : requester.workerId,
    name: requester.displayName,
    language: requester.preferredLanguage,
  };
}

/** The guide part for things the platform does not have yet. */
export function notAvailableTopic() {
  return steelPlatformGuide().find(topic => topic.id === "not-available")?.body ?? "";
}

/** Static how-to guide and the request/bug channel to the platform team. */
export function platformAssistantTools(requester: Known, options: { guide: boolean }): ToolSet {
  const actor = signalActor(requester);
  return {
    ...(options.guide ? {
      getPlatformGuide: {
        description: "How the app works: where to click, step by step, and which role may do it (login, hours, vacation, new project, factory/field lists, confirming pieces, documents/phases, access, roles, warehouse, workshop, fleet, fuel, daily plan, dashboard). Use for any how-to / where-is / can-I question about the app. Reads no business records. If nothing matches, the question is passed to the platform team automatically.",
        inputSchema: z.object({ question: z.string().trim().min(2).max(300) }),
        execute: async ({ question }: { question: string }) => {
          const topics = searchPlatformGuide(steelPlatformGuide(), question);
          if (!topics.length) {
            await recordPlatformSignal(actor, { kind: "question", title: question });
            return { ok: true, matched: false, notAvailable: notAvailableTopic(), instruction: "The guide does not cover this. Say you do not know the exact steps, do not invent a path, and say the question was passed to the platform team." };
          }
          return { ok: true, matched: true, topics: topics.map(topic => ({ id: topic.id, title: topic.title, who: topic.who, steps: topic.body })), notAvailable: notAvailableTopic() };
        },
      },
    } : {}),
    sendToPlatformTeam: {
      description: "Send a request to the platform team (the people who build this app): a feature the user needs that the app does not have, or a bug/wrong behaviour the user reports. ONLY after the user agreed in this conversation to send it. Write a short clear title and the details in the user's words (what they need and why). Not for business data changes.",
      inputSchema: z.object({
        kind: z.enum(["feature", "bug"]),
        title: z.string().trim().min(3).max(160),
        details: z.string().trim().max(1500).optional(),
        userAgreed: z.literal(true),
      }),
      execute: async (input: { kind: "feature" | "bug"; title: string; details?: string }) => {
        const saved = await recordPlatformSignal(actor, { kind: input.kind, title: input.title, details: input.details });
        return saved
          ? { ok: true, sent: true, repeated: saved.count > 1, message: "Saved for the platform team. Tell the user it was sent; the team decides if and when it is built." }
          : { ok: false, sent: false, message: "Could not be saved now. Tell the user to try again later." };
      },
    },
  };
}

const systemCodes = new Set<AssistantFailure["code"]>(["missing_key", "provider_auth", "provider_quota", "db", "tool_unknown", "tool_failure", "provider_unavailable", "internal", "step_limit", "input_payload"]);

/** System errors the assistant hit are reported without asking the user. */
export async function reportAssistantFailure(requester: Known, failure: AssistantFailure | undefined, toolName?: string) {
  if (!failure || !systemCodes.has(failure.code)) return;
  const parts = [failure.providerCode, failure.dbCode, failure.dbReason, failure.sqlState].filter(Boolean);
  await recordPlatformSignal(signalActor(requester), {
    kind: "error",
    title: `Assistant ${requester.kind}: ${failure.code}${toolName ? ` in ${toolName}` : ""}`,
    details: parts.length ? `Details: ${parts.join(", ")}` : "",
  });
}
