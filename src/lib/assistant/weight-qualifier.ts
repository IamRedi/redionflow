import type { AssistantToolObservation } from './grounding';

type Observation = Pick<AssistantToolObservation, 'toolName' | 'input' | 'result' | 'status'>;
type Turn = { singleDate: string | null; currentMonthRequested: boolean };
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const kg = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const rounded = new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parse displayed kg without changing its spelling. Three-digit groups are thousands. */
function displayedKg(text: string): number | null {
  let numeric = text.replace(/[ '’\u00a0\u202f]/g, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(numeric)) return null;
  const separators = [...numeric.matchAll(/[.,]/g)];
  if (separators.length) {
    const last = separators.at(-1)!, index = last.index!, fraction = numeric.slice(index + 1);
    const mixed = numeric.includes('.') && numeric.includes(',');
    if (mixed || (separators.length === 1 && fraction.length !== 3)) {
      const whole = numeric.slice(0, index);
      if (/[.,]/.test(whole) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(whole)) return null;
      numeric = `${whole.replace(/[.,]/g, '')}.${fraction}`;
    } else {
      if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(numeric)) return null;
      numeric = numeric.replace(/[.,]/g, '');
    }
  }
  const value = Number(numeric);
  return kg(value) ? value : null;
}

/** Only canonical, successfully delivered tool facts may qualify a matching kg quote. */
export function createLegacyWeightQualifier(turn: Turn) {
  const values = new Set<string>();
  let qualifiersAdded = 0;
  const add = (value: unknown) => { if (kg(value)) values.add(rounded.format(value)); };
  const metric = (value: unknown) => {
    const item = record(value);
    if (item && typeof item.legacyPieces === 'number' && item.legacyPieces > 0
      && !(item.kg === 0 && typeof item.missingPieces === 'number' && item.missingPieces > 0)) add(item.kg);
  };
  const metrics = (value: unknown) => {
    const item = record(value);
    if (item) for (const key of ['cutParts', 'cutAssemblies', 'assembled']) metric(item[key]);
  };
  return {
    observe(event: Observation) {
      const result = record(event.result), input = record(event.input);
      if (event.status !== 'ok' || result?.ok !== true) return;
      if (event.toolName === 'adminGetSteelProductionSummary') {
        const monthScope = !turn.singleDate && !input?.date && (!!input?.month || turn.currentMonthRequested);
        if (monthScope) {
          metrics(result.monthlyProduction);
          for (const project of rows(result.projects)) metrics(record(project)?.monthlyProduction);
        } else {
          for (const day of rows(result.dailyProduction)) {
            const item = record(day);
            if (item && item.key === result.selectedDate) metrics(item.metrics);
          }
        }
      } else if (event.toolName === 'adminGetSteelProductionEvidence') {
        for (const group of rows(result.aggregates)) metric(record(group)?.metric);
        const confirmations = rows(result.confirmations);
        const groups = new Map<string, { kg: number; legacy: boolean; known: boolean }>();
        for (const raw of confirmations) {
          const item = record(raw);
          if (!item) continue;
          if (item.legacy === true) add(item.kg);
          const projectId = record(item.project)?.id;
          if (typeof projectId !== 'string' || typeof item.list !== 'string' || typeof item.stage !== 'string') continue;
          const key = JSON.stringify([projectId, item.list, item.stage]);
          const group = groups.get(key) ?? { kg: 0, legacy: false, known: true };
          group.known &&= kg(item.kg);
          if (kg(item.kg)) group.kg = Math.round((group.kg + item.kg) * 1e6) / 1e6;
          group.legacy ||= item.legacy === true;
          groups.set(key, group);
        }
        // A last cursor page is not a complete project breakdown.
        if (result.pageComplete === true && !input?.cursor && result.totalMatchingConfirmations === confirmations.length) {
          for (const group of groups.values()) if (group.legacy && group.known) add(group.kg);
        }
      }
    },
    transformAnswer(text: string) {
      if (!values.size) return text;
      return text.replace(/(?<![\p{L}\p{N}.,+\-])(\d+(?:[.,]\d+|[ '’\u00a0\u202f]\d{3}(?!\d))*)((?:[ \t\u00a0\u202f]|[*_]){0,12}kg\b)(?!\s*\/)/giu, (match: string, numeric: string, unit: string, offset: number) => {
        const value = displayedKg(numeric);
        const prefix = text.slice(Math.max(0, offset - 24), offset).replace(/[\s*_`]/g, '');
        if (value === null || !values.has(rounded.format(value)) || /[≈~∼]$/.test(prefix)) return match;
        qualifiersAdded++;
        return `≈${numeric}${unit}`;
      });
    },
    snapshot() { return { legacyValuesSeen: values.size, qualifiersAdded }; },
  };
}
