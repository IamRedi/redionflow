import { readAssemblyParts } from './material-groups';

export type RemainderMaterial = {
  id: string; list: string; mark: string; quantity: number; isManual?: boolean;
  assemblyParts?: unknown; remainderOfId?: string | null;
};
export type RemainderPlan = {
  status: 'ready' | 'missingLists' | 'missingComposition' | 'missingPart' | 'overallocated';
  marks: string[];
  rows: Array<{ sourceId: string; mark: string; total: number; used: number; remaining: number }>;
};

/** Megi, 17 Nov 2026: BOM component quantities are PER ONE assembly. */
export function planRemainders(items: readonly RemainderMaterial[]): RemainderPlan {
  const assemblies = items.filter(e => e.list === 'assembly' && !e.isManual && !e.remainderOfId);
  const parts = items.filter(e => e.list === 'part');
  const blocked = (status: RemainderPlan['status'], marks: string[]): RemainderPlan => ({ status, marks, rows: [] });
  if (!assemblies.length || !parts.length) return blocked('missingLists', []);
  const missing = assemblies.filter(e => !readAssemblyParts(e.assemblyParts)?.parts.length);
  if (missing.length) return blocked('missingComposition', missing.map(e => e.mark));
  const byMark = new Map(parts.map(e => [e.mark, e]));
  const used = new Map<string, number>(), absent = new Set<string>();
  for (const assembly of assemblies) {
    for (const part of readAssemblyParts(assembly.assemblyParts)!.parts) {
      if (!byMark.has(part.mark)) absent.add(part.mark);
      const n = (used.get(part.mark) ?? 0) + part.quantity * assembly.quantity;
      if (!Number.isSafeInteger(n) || n < 0) return blocked('overallocated', [part.mark]);
      used.set(part.mark, n);
    }
  }
  if (absent.size) return blocked('missingPart', [...absent]);
  const rows = parts.map(part => ({ sourceId: part.id, mark: part.mark, total: part.quantity,
    used: used.get(part.mark) ?? 0, remaining: part.quantity - (used.get(part.mark) ?? 0) }));
  const excess = rows.filter(row => row.remaining < 0);
  return excess.length ? blocked('overallocated', excess.map(row => row.mark)) : { status: 'ready', marks: [], rows };
}
