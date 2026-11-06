import type { AssistantToolObservation } from './grounding';

export const DOCUMENT_RECEIPTS_TOOL = 'adminGetSitePhaseDocumentReceipts';

/** Request-local evidence only: previous chat text and project IDs cannot unlock receipts. */
export function createDocumentResolution() {
  const ids = new Set<string>();
  return {
    observe(event: AssistantToolObservation) {
      if (event.toolName !== 'adminGetSitePhaseDocuments' || event.status !== 'ok') return;
      const result = event.result as { ok?: boolean; documents?: Array<{ id?: unknown }> } | null;
      if (result?.ok !== true || !Array.isArray(result.documents)) return;
      for (const document of result.documents) {
        if (typeof document.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(document.id)) ids.add(document.id);
      }
    },
    activeTools(names: string[]) { return names.filter(name => name !== DOCUMENT_RECEIPTS_TOOL || ids.size > 0); },
    has(id: string) { return ids.has(id); },
  };
}
