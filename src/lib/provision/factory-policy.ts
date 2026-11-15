import { sideOfStage } from '@/lib/elements/stages';
import { effectiveTaskProcessLink } from '@/lib/steel-work/task-process-link';

/** Includes legacy workshop phases and linked site tasks, not just kind=factory. */
export function isFactoryDefinition(definition: { kind: string; key?: string; label?: string; phaseGroup?: string | null; linkedProcessKey?: string | null; linkedList?: string | null; linkedKind?: string | null }) {
  return definition.kind === 'factory' || definition.phaseGroup === 'production'
    || ['steel-cutting', 'steel-drilling', 'steel-welding', 'steel-coating'].includes(definition.key ?? '')
    || sideOfStage(effectiveTaskProcessLink(definition).linkedProcessKey ?? '') === 'factory';
}
