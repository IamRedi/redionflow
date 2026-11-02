import { z } from "zod";

/**
 * Shape of one real customer company, handed to the platform by the
 * operator through the `PROVISION_COMPANY_JSON` variable. Customer data never
 * lives in this public repository.
 */
export const provisionCompanySchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(200),
  mode: z.enum(["baumdienst", "bau"]),
  country: z.enum(["DE", "AL"]),
  vatId: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(200).optional(),
  street: z.string().trim().max(200).optional(),
  zip: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  logoDataUrl: z.string().max(220_000).optional(),
  plan: z.enum(["starter", "pro", "enterprise"]).default("enterprise"),
  owner: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
  }),
  sites: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(160),
        type: z.enum(["STEEL_WORKSHOP", "STEEL_ASSEMBLY", "RENOVATION", "OTHER"]),
        status: z.enum(["active", "inactive"]).default("active"),
        address: z.string().trim().max(240).optional(),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .max(50)
    .default([]),
  /** Company knowledge entries (references, rules), shown to the team and the assistant. */
  knowledge: z
    .array(
      z.object({
        key: z.string().trim().min(2).max(80),
        language: z.enum(["DE", "EN", "SQ", "IT", "PL", "RO"]),
        title: z.string().trim().min(2).max(200),
        content: z.string().trim().min(2).max(8000),
        tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
      }),
    )
    .max(50)
    .default([]),
});

export type ProvisionCompany = z.infer<typeof provisionCompanySchema>;

export function parseProvisionInput(json: string | undefined, password: string | undefined) {
  if (!json?.trim()) return null;
  const company = provisionCompanySchema.parse(JSON.parse(json));
  const ownerPassword = password?.trim() ?? "";
  if (ownerPassword.length < 12) throw new Error("PROVISION_OWNER_PASSWORD must have at least 12 characters.");
  return { company, ownerPassword };
}
