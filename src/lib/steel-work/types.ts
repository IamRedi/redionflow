import type { CrewPermissions } from '@/lib/workzone/crew-roles';

export type SteelWorkKind = 'site' | 'factory' | 'field';
export type SteelWorkDefinitionView = {
  id: string; key: string; kind: SteelWorkKind; label: string; description: string; sortOrder: number; revision: number;
  archivedAt: string | null; linkedProcessKey: string | null; linkedList: 'assembly' | 'part' | null; linkedKind: string | null;
  visualUpdatedAt: string | null; visualStatus: string; enabled?: boolean; selectionPosition?: number | null; phaseItemId?: string | null; selectionRevision?: number;
};
export const canManageSteelCatalog = (can: CrewPermissions) => can.office || can.factorySteps || can.siteSteps;
