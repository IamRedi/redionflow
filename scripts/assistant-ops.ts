/**
 * One-time assistant operations at boot (remove the variable after one boot).
 *
 *   ASSISTANT_OPS=reset          clear today's assistant quota (requests + tokens) for the company
 *   ASSISTANT_OPS=review:40      log the last 40 assistant questions/answers with the tools they used,
 *                                so the answers can be reviewed and the assistant improved
 *   ASSISTANT_OPS=reset,review:40   both
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionString } from "../src/lib/db/connection-string";

const clip = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

export async function runAssistantOps() {
  const ops = (process.env.ASSISTANT_OPS ?? "").split(",").map(op => op.trim()).filter(Boolean);
  if (!ops.length) return;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: resolveDatabaseConnectionString({ preferDirect: true }) }) });
  try {
    const companies = await prisma.companyProfile.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) { console.log(`[assistant-ops] expected exactly one company, found ${companies.length}; nothing done.`); return; }
    const companyId = companies[0].id;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, companyId);
      if (ops.includes("reset")) {
        const dayStart = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000);
        const cleared = await tx.assistantQuotaBucket.deleteMany({ where: { companyProfileId: companyId, windowStart: { gte: dayStart } } });
        console.log(`[assistant-ops] quota reset: ${cleared.count} buckets cleared for today.`);
      }
      const review = ops.find(op => op.startsWith("review"));
      if (review) {
        const take = Math.min(200, Math.max(1, Number(review.split(":")[1]) || 40));
        const runs = await tx.assistantRun.findMany({ where: { companyProfileId: companyId }, orderBy: { startedAt: "desc" }, take, include: { toolTraces: { orderBy: { createdAt: "asc" }, select: { toolName: true, status: true, input: true, result: true } } } });
        console.log(`[assistant-ops] review: ${runs.length} runs (newest first).`);
        for (const run of runs) {
          console.log(`[assistant-review] ${run.startedAt.toISOString()} run=${run.id} status=${run.status} error=${run.errorCode ?? "-"} tokens=${run.totalTokens ?? "-"}`);
          console.log(`[assistant-review]   Q: ${clip(run.question, 500)}`);
          for (const trace of run.toolTraces) console.log(`[assistant-review]   tool ${trace.toolName} ${trace.status} in=${clip(trace.input, 200)} out=${clip(trace.result, 300)}`);
          console.log(`[assistant-review]   A: ${clip(run.answer, 900)}`);
        }
      }
    }, { timeout: 60_000 });
  } finally {
    await prisma.$disconnect();
  }
}
