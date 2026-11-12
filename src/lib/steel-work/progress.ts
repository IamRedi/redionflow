import { pieces, sideOfStage, stagePieces, stagesFor, type ElementState } from '@/lib/elements/stages';
import { readSteelPhaseMeta, steelPhaseKeyFromTreeId } from '@/lib/workzone/steel-phases';
import { effectiveTaskProcessLink } from './task-process-link';

type TaskDefinition = { id: string; key?:string; label?:string; phaseGroup?:string|null; archivedAt?: Date | string | null; linkedProcessKey?: string | null; linkedList?: string | null; linkedKind?: string | null };
export type TaskRow = {
  id: string; treeId?: string; status: string; notes?: string | null;
  steelTask?: { enabled: boolean; definition: TaskDefinition } | null;
};
export type TaskElement = ElementState & { kind?: string | null };
export type ProjectedTask<T> = T & { definitionId?: string; linkedProcessKey?:string; automatic: boolean; percent: number | null; completedPieces: number; requiredPieces: number };

/** Current applicability only. Stored confirmations/status/audit are untouched. */
export function projectSteelTasks<T extends TaskRow>(rows: T[], elements: TaskElement[]) {
  return rows.flatMap<ProjectedTask<T>>(row => {
    // Imported generic rows are not phases on the steel board. Preserve their
    // history, but do not count them as another selected steel process.
    if (row.treeId !== undefined && !steelPhaseKeyFromTreeId(row.treeId)) return [];
    const assignment = row.steelTask;
    if (!assignment) return [{ ...row, automatic: false, percent: row.status === 'done' ? 100 : 0, completedPieces: 0, requiredPieces: 0 }];
    if (!assignment.enabled || assignment.definition.archivedAt) return [];
    const definition = effectiveTaskProcessLink(assignment.definition), stage = definition.linkedProcessKey;
    if (!stage) return [{ ...row, definitionId: assignment.definition.id, automatic: false, percent: row.status === 'done' ? 100 : 0, completedPieces: 0, requiredPieces: 0 }];
    const side = sideOfStage(stage);
    const applicable = side ? elements.filter(element =>
      (!definition.linkedList || element.list === definition.linkedList)
      && (!definition.linkedKind || element.kind?.toLocaleLowerCase() === definition.linkedKind.toLocaleLowerCase())
      && stagesFor(side, element.list, element.processRoutes).includes(stage)) : [];
    // Include required assemblies still in the factory: a partial delivery must
    // not turn the first completed shipment into 100% of the site's task.
    const requiredPieces = applicable.reduce((sum, element) => sum + pieces(element), 0);
    const completedPieces = applicable.reduce((sum, element) => sum + stagePieces(element, stage), 0);
    const percent = requiredPieces ? Math.min(100, Math.floor(completedPieces / requiredPieces * 100)) : null;
    const status = requiredPieces > 0 && completedPieces >= requiredPieces ? 'done'
      : readSteelPhaseMeta(row.notes).material ? 'blocked' : 'todo';
    return [{ ...row, definitionId: assignment.definition.id, linkedProcessKey:stage, status, automatic: true, percent, completedPieces, requiredPieces }];
  });
}

export function steelTaskTotals(rows: Array<{ status: string; percent?: number | null }>) {
  const total = rows.length, done = rows.filter(row => row.status === 'done').length;
  const pct = total ? Math.floor(rows.reduce((sum, row) => sum + (row.percent ?? (row.status === 'done' ? 100 : 0)), 0) / total) : 0;
  return { total, done, pct, blocked: rows.filter(row => row.status === 'blocked').length };
}
