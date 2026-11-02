import { z } from "zod";
import { prisma as bootstrapDb } from "@/lib/db/prisma";
import { isSaasMode } from "@/lib/saas-config";
import { regionConfig } from "@/lib/region";
import { assertSignupBootstrapAllowed, runSignupBootstrap } from "@/lib/db/operation-boundary";

// A fixed, new-tenant-only command. No generic privileged client/callback export.
const bootstrapSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(200),
  mode: z.enum(["baumdienst", "bau"]),
  country: z.enum(["DE", "AL"]).default("DE"),
  email: z.string().email().max(200),
  fullName: z.string().trim().min(2).max(120),
  passwordHash: z.string().min(20).max(1000),
  trialEndsAt: z.date(),
}).strict();

export async function bootstrapSignupTenant(value: unknown) {
  assertSignupBootstrapAllowed(); // Deny before any privileged lookup or write.
  if (!isSaasMode) throw new Error("Signup bootstrap requires SaaS mode");
  const input = bootstrapSchema.parse(value);
  const region = regionConfig(input.country);
  const language = region.defaultLanguage === "sq" ? "SQ" : "DE";
  return runSignupBootstrap(async () => {
    const existing = await bootstrapDb.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) return null;
    return bootstrapDb.$transaction(async tx => {
      const company = await tx.companyProfile.create({
        data: {
          displayName: input.displayName.trim(),
          legalName: input.legalName.trim(),
          mode: input.mode,
          country: input.country,
          trialEndsAt: input.trialEndsAt,
          overheadSettings: {
            create: {
              bgkPct: 0.18,
              agkPct: 0.1,
              riskPct: 0.03,
              profitPct: 0.06,
              vatPct: region.defaultVatPct / 100,
              bgkBase: "EK_TOTAL",
              riskProfitMode: "SEPARATE",
              applyVatByDefault: true,
            },
          },
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.fullName.trim(),
          role: "ADMIN",
          isOwner: true,
          preferredLanguage: language,
          motherTongue: language,
          passwordHash: input.passwordHash,
          isActive: true,
          companyProfileId: company.id,
        },
        select: { id: true, sessionEpoch: true },
      });

      await tx.auditLog.create({ data: { companyProfileId: company.id, actorType: "SYSTEM",
        action: "signup.bootstrap", payload: { adminUserId: user.id, mode: input.mode } } });
      return { admin: user, companyId: company.id };
    });
  });
}
