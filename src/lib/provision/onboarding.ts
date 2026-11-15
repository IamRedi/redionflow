import { createHash } from 'node:crypto';
import { z } from 'zod';
import { provisionCompanySchema } from './company-input';
import { blueprintChoiceSchema, blueprintModules, resolveBlueprint } from './blueprints';

/** Operator-only input: never accept a database clone or a source company's identifier. */
export const onboardingSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{5,63}$/),
  blueprint: blueprintChoiceSchema,
  company: provisionCompanySchema.strict(),
}).strict();
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export function planCompanySetup(raw: unknown) {
  const input = onboardingSchema.parse(raw);
  const profile = resolveBlueprint(input.blueprint);
  if (input.company.mode !== profile.mode) throw new Error('BLUEPRINT_MODE_MISMATCH');
  if (!profile.factory && input.company.sites.some(site => site.type === 'STEEL_WORKSHOP')) throw new Error('FACTORY_SITE_DISABLED');
  const siteNames = input.company.sites.map(site => site.name.toLocaleLowerCase('en'));
  if (new Set(siteNames).size !== siteNames.length) throw new Error('DUPLICATE_SITE');
  const knowledgeKeys = input.company.knowledge.map(entry => `${entry.language}:${entry.key}`);
  if (new Set(knowledgeKeys).size !== knowledgeKeys.length) throw new Error('DUPLICATE_KNOWLEDGE');
  // Canonical parsed field order, normalized values and pinned defaults bind review to apply.
  const digest = createHash('sha256').update(JSON.stringify({ key: input.key, company: input.company, profile })).digest('hex');
  return { input, profile, digest, modules: blueprintModules(profile) };
}
export type CompanySetupPlan = ReturnType<typeof planCompanySetup>;

/** Safe CLI preview. Names, addresses, owner email, knowledge and passwords stay private. */
export function setupSummary(plan: CompanySetupPlan) {
  return { key: plan.input.key, digest: plan.digest, blueprint: plan.profile, modules: plan.modules,
    records: { owners: 1, sites: plan.input.company.sites.length, knowledge: plan.input.company.knowledge.length },
    copiedClientRecords: 0, providerConfigurationChanged: false, runtimeOfficeConfigurationRequired: true,
    review: ['Confirm workflows and roles with the company before activation.', 'Crane dispatch, load charts and crane-specific quotations require a separate adaptation; they are not supplied by the steel profile.'] };
}
