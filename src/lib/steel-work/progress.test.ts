import { expect, it } from 'vitest';
import { projectSteelTasks, steelTaskTotals } from './progress';
import type { TaskElement } from './progress';

const task = { id: 'task-demo', status: 'done', notes: '{"doneBy":"Demo engineer"}', steelTask: { enabled: true, definition: { id: 'def-demo', linkedProcessKey: 'mounted', linkedList: 'assembly' } } };
const element = (overrides: Partial<TaskElement> = {}): TaskElement => ({ list: 'assembly', quantity: 10, factoryDoneAt: new Date(), work: [{ stage: 'cutting', pieces: 4 }, { stage: 'mounted', pieces: 4 }], ...overrides });

it('does not count disabled/archived tasks and does not mutate their historical evidence', () => {
  const disabled = { ...task, steelTask: { ...task.steelTask, enabled: false } };
  const archived = { ...task, steelTask: { ...task.steelTask, definition: { ...task.steelTask.definition, archivedAt: new Date() } } };
  expect(projectSteelTasks([disabled, archived], [element()])).toEqual([]);
  expect(disabled.status).toBe('done'); expect(disabled.notes).toContain('Demo engineer');
});
it('keeps required materials awaiting delivery in the denominator', () => {
  const projected = projectSteelTasks([task], [element()]);
  expect(projected[0]).toMatchObject({ status: 'todo', automatic: true, completedPieces: 4, requiredPieces: 10, percent: 40 });
  expect(steelTaskTotals(projected)).toMatchObject({ total: 1, done: 0, pct: 40 });
  expect(task.status).toBe('done');
});
it('requires selected applicability and explicit list/kind links, not matching task names', () => {
  const linked = { ...task, steelTask: { ...task.steelTask, definition: { ...task.steelTask.definition, linkedKind: 'COLUMN' } } };
  const projected = projectSteelTasks([linked], [element({ kind: 'BEAM' }), element({ kind: 'COLUMN', processRoutes: { v: 1, factory: null, field: ['received'] } })]);
  expect(projected[0]).toMatchObject({ status: 'todo', requiredPieces: 0, percent: null });
});
it('never auto-completes an empty source and keeps manual tasks independent', () => {
  const manual = { id: 'manual', status: 'done', notes: 'unchanged' };
  expect(projectSteelTasks([task], [])[0]).toMatchObject({ status: 'todo', percent: null });
  expect(projectSteelTasks([manual], [element()])[0]).toMatchObject({ status: 'done', automatic: false, percent: 100 });
});
it('counts the same selected phases as the steel board, without an imported generic row', () => {
  const rows = [{ id: 'selected', treeId: 'steel-task-demo', status: 'done' }, { id: 'legacy-import', treeId: '1', status: 'todo' }];
  expect(steelTaskTotals(projectSteelTasks(rows, []))).toMatchObject({ total: 1, done: 1, pct: 100 });
  expect(rows[1]).toMatchObject({ treeId: '1', status: 'todo' });
});
