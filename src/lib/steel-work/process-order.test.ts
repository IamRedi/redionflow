import { expect, it } from 'vitest';
import { orderedProcessKeys, processPlacement } from './process-order';

it('keeps factory and field groups together even when each has its own zero-based positions', () => {
  const route = ['assembly', 'mounted', 'cutting', 'historic-key', 'drill'];
  const definitions = [{ key: 'cutting', sortOrder: 0 }, { key: 'drill', sortOrder: 1 }, { key: 'assembly', sortOrder: 2 }, { key: 'mounted', sortOrder: 0 }];
  expect(orderedProcessKeys(route, definitions)).toEqual(['cutting', 'drill', 'assembly', 'mounted', 'historic-key']);
  expect(route).toEqual(['assembly', 'mounted', 'cutting', 'historic-key', 'drill']);
});

it('retains legacy keys in their relative order and skips archived neighbours in the edit snapshot', () => {
  expect(orderedProcessKeys(['old-b', 'cutting', 'old-a'], [{ key: 'cutting' }])).toEqual(['cutting', 'old-b', 'old-a']);
  expect(processPlacement('cut', [{ id: 'cut', archivedAt: null }, { id: 'old', archivedAt: '2026-01-01' }, { id: 'assembly', archivedAt: null }])).toEqual({ beforeId: 'assembly', expectedOrder: ['cut', 'assembly'] });
});
