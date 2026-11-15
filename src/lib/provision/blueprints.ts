import { z } from 'zod';

/** Product capabilities, not user permissions, subscriptions or provider switches. */
export const CORE_MODULES = ['workzone', 'sites', 'planning', 'staff', 'offices', 'inventory', 'fleet', 'workshop', 'documents', 'calculation'] as const;
export const BLUEPRINT_SOURCE = '4c2c96331d14c4dbbb83d8c49a5499b17a0d2889';
export const blueprintChoiceSchema = z.object({
  id: z.enum(['steel-fabrication', 'steel-assembly']),
  version: z.literal(1),
  factory: z.boolean().optional(),
}).strict();
export type BlueprintChoice = z.infer<typeof blueprintChoiceSchema>;

const snapshotSchema = z.object({
  schema: z.literal(1),
  id: z.enum(['steel-fabrication', 'steel-assembly']),
  version: z.literal(1),
  source: z.literal(BLUEPRINT_SOURCE),
  mode: z.literal('bau'),
  factory: z.boolean(),
}).strict();
export type CompanyBlueprint = z.infer<typeof snapshotSchema>;

/** Frozen v1 profiles. Future defaults belong in v2, never in a tenant's saved v1. */
export function resolveBlueprint(choice: BlueprintChoice): CompanyBlueprint {
  const value = blueprintChoiceSchema.parse(choice);
  return { schema: 1, id: value.id, version: 1, source: BLUEPRINT_SOURCE, mode: 'bau', factory: value.factory ?? value.id === 'steel-fabrication' };
}

/** Null alone means legacy. Malformed or unsupported configuration must not enable anything. */
export function readBlueprint(value: unknown): CompanyBlueprint | null {
  if (value === null || value === undefined) return null;
  return snapshotSchema.parse(value);
}
export function factoryEnabled(value: unknown): boolean {
  return readBlueprint(value)?.factory ?? true;
}

export function blueprintModules(profile: CompanyBlueprint) {
  return { enabled: [...CORE_MODULES, ...(profile.factory ? ['factory'] : [])], disabled: profile.factory ? [] : ['factory'] };
}
