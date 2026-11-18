export type ProcessPlacement = { beforeId: string | null; expectedOrder: string[] };
type Definition = { id: string; archivedAt: string | null };

/** Snapshot the displayed active order; retain the selected neighbour on retry. */
export function processPlacement(id: string | undefined, definitions: readonly Definition[]): ProcessPlacement {
  const active = definitions.filter(row => !row.archivedAt); // Already ordered by the server, including its tie-breaker.
  const index = active.findIndex(row => row.id === id);
  return { beforeId: index < 0 ? null : active[index + 1]?.id ?? null, expectedOrder: active.map(row => row.id) };
}

/** Presentation only: never rewrite required routes, work or completion order. */
export function orderedProcessKeys(keys: readonly string[], definitions: readonly { key: string; sortOrder?: number }[]) {
  const rank = new Map(definitions.map((row, index) => [row.key, row.sortOrder ?? index]));
  return [...keys].sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
}
