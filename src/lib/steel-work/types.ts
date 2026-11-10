import type { CrewPermissions } from '@/lib/workzone/crew-roles';

export type SteelWorkKind = 'site' | 'factory' | 'field';
export type SteelWorkDefinitionView = {
  id: string; key: string; kind: SteelWorkKind; label: string; description: string; sortOrder: number; revision: number;
  archivedAt: string | null; linkedProcessKey: string | null; linkedList: 'assembly' | 'part' | null; linkedKind: string | null; phaseGroup?: string | null;
  visualUpdatedAt: string | null; visualStatus: string; enabled?: boolean; selectionPosition?: number | null; phaseItemId?: string | null; selectionRevision?: number;
};
export const canManageSteelCatalog = (can: CrewPermissions) => can.office || can.factorySteps || can.siteSteps;

/** The three windows a steel site opens with; every site task belongs to one. */
export const STEEL_PHASE_GROUPS = ['concrete', 'production', 'assembly'] as const;
export type SteelPhaseGroup = typeof STEEL_PHASE_GROUPS[number];
export const steelPhaseGroup = (value: string | null | undefined): SteelPhaseGroup =>
  (STEEL_PHASE_GROUPS as readonly string[]).includes(value ?? '') ? value as SteelPhaseGroup : 'assembly';
