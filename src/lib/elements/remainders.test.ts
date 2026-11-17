import { describe, expect, it } from 'vitest';
import { planRemainders, type RemainderMaterial } from './remainders';

const part = (mark: string, quantity: number): RemainderMaterial => ({ id: `p-${mark}`, list: 'part', mark, quantity });
const assembly = (mark: string, quantity: number, parts: Array<{ mark: string; quantity: number }>): RemainderMaterial => ({ id: `a-${mark}`, list: 'assembly', mark, quantity, assemblyParts: { v: 1, parts } });
describe('standalone remainder allocation', () => {
  it('multiplies unit BOM by assembly count and aggregates a component across assemblies', () => {
    const plan = planRemainders([part('b/1', 20), part('1001', 7), part('FREE', 4), assembly('B/1', 3, [{ mark: 'b/1', quantity: 2 }, { mark: '1001', quantity: 1 }]), assembly('B/7', 2, [{ mark: 'b/1', quantity: 4 }])]);
    expect(plan.status).toBe('ready');
    expect(plan.rows).toEqual([{ sourceId: 'p-b/1', mark: 'b/1', total: 20, used: 14, remaining: 6 }, { sourceId: 'p-1001', mark: '1001', total: 7, used: 3, remaining: 4 }, { sourceId: 'p-FREE', mark: 'FREE', total: 4, used: 0, remaining: 4 }]);
  });
  it('preserves exact codes and never subtracts assembly marks from part marks', () => {
    const plan = planRemainders([part('B/1', 4), part('b/1', 2), assembly('B/1', 2, [{ mark: 'b/1', quantity: 1 }])]);
    expect(plan.rows.map(row => [row.mark, row.remaining])).toEqual([['B/1', 4], ['b/1', 0]]);
  });
  it('does not count manual or previously derived elements as assembly demand', () => {
    const plan = planRemainders([part('p', 9), assembly('B', 2, [{ mark: 'p', quantity: 2 }]), { ...assembly('manual', 50, []), isManual: true }, { ...assembly('derived', 50, []), remainderOfId: 'p-p' }]);
    expect(plan.rows[0].remaining).toBe(5);
  });
  it.each([[], [part('p', 4)], [assembly('B', 1, [{ mark: 'p', quantity: 1 }])]])('does not infer standalone stock from an absent list', (...items) => {
    expect(planRemainders(items.flat() as RemainderMaterial[]).status).toBe('missingLists');
  });
  it('fails closed for missing or empty composition and unknown component codes', () => {
    expect(planRemainders([part('p', 4), { id: 'a', mark: 'B', list: 'assembly', quantity: 1 }]).status).toBe('missingComposition');
    expect(planRemainders([part('p', 4), assembly('B', 1, [])]).status).toBe('missingComposition');
    expect(planRemainders([part('p', 4), assembly('B', 1, [{ mark: 'MISSING', quantity: 1 }])])).toMatchObject({ status: 'missingPart', marks: ['MISSING'], rows: [] });
  });
  it('rejects over-allocation instead of clamping it to zero', () => {
    expect(planRemainders([part('p', 3), assembly('B', 2, [{ mark: 'p', quantity: 2 }])])).toMatchObject({ status: 'overallocated', marks: ['p'], rows: [] });
  });
  it('sums repeated component rows without allocating the same remainder twice', () => {
    expect(planRemainders([part('p', 10), assembly('B', 2, [{ mark: 'p', quantity: 1 }, { mark: 'p', quantity: 2 }])]).rows[0].remaining).toBe(4);
  });
});
