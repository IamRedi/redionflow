import { expect, it } from 'vitest';
import { createDocumentResolution, DOCUMENT_RECEIPTS_TOOL } from './document-resolution';
import type { AssistantToolObservation } from './grounding';

const id = '60000000-0000-4000-8000-000000000001';
const second = '60000000-0000-4000-8000-000000000002';
function event(result: unknown, status: AssistantToolObservation['status'] = 'ok', toolName = 'adminGetSitePhaseDocuments'): AssistantToolObservation {
  return { result, status, toolName, toolCallId: 'synthetic', input: {}, evidence: {}, startedAt: new Date(), durationMs: 0 };
}
it('hides receipt lookup before discovery and after an empty, failed or rejected read', () => {
  const resolution = createDocumentResolution(), names = ['adminGetSitePhaseDocuments', DOCUMENT_RECEIPTS_TOOL];
  expect(resolution.activeTools(names)).toEqual(['adminGetSitePhaseDocuments']);
  for (const observation of [event({ ok: true, documents: [] }), event({ ok: false, documents: [{ id }] }), event({ ok: true, documents: [{ id }] }, 'rejected'), event({ ok: true, documents: [{ id }] }, 'error'), event({ ok: true, documents: [{ id }] }, 'ok', 'adminSearchSteelProjects')]) {
    resolution.observe(observation);
    expect(resolution.has(id)).toBe(false);
    expect(resolution.activeTools(names)).not.toContain(DOCUMENT_RECEIPTS_TOOL);
  }
});
it('accepts only exact document version IDs from fresh successful pages, never project/cursor/supersedes IDs', () => {
  const resolution = createDocumentResolution();
  resolution.observe(event({ ok: true, project: { id: second }, nextCursor: second, documents: [{ id, supersedesId: second }, { id: 'not-a-uuid' }] }));
  expect(resolution.has(id)).toBe(true);
  expect(resolution.has(second)).toBe(false);
  expect(resolution.has('not-a-uuid')).toBe(false);
  expect(resolution.activeTools([DOCUMENT_RECEIPTS_TOOL])).toEqual([DOCUMENT_RECEIPTS_TOOL]);
  resolution.observe(event({ ok: true, documents: [{ id: second }] }));
  expect(resolution.has(second)).toBe(true);
  expect(createDocumentResolution().has(id)).toBe(false);
});
