import { describe, expect, it } from 'vitest';
import { archiveMessages, canonicalAnswer, conversationContentNotice, conversationCopy, conversationList, conversationPage, conversationStatus, mergeConversations, withPartialAnswer } from './conversation-client';
const run = { id: 'run-a', clientMessageId: 'dc1313e1-6f96-4329-8ca9-6d96e6798833', question: 'Sa kantiere kanë filluar?', answer: 'Dy kantiere.', status: 'completed', createdAt: '2026-11-05T12:00:00Z' };

describe('bounded admin archive client', () => {
  it('accepts the owner-scoped list and chronological run protocol without using a browser storage API', () => {
    expect(conversationList({ conversations: [{ id: 'conv-a', title: 'Kantieret', updatedAt: run.createdAt }], nextCursor: 'conv-b' })).toMatchObject({ nextCursor: 'conv-b', conversations: [{ id: 'conv-a' }] });
    const page = conversationPage({ conversation: { id: 'conv-a', title: 'Kantieret' }, runs: [run], nextCursor: 'older-run' });
    expect(page.nextCursor).toBe('older-run');
    expect(archiveMessages(page.runs, 'Pa përgjigje')).toEqual([{ id: 'run-a:question', role: 'user', content: run.question }, { id: 'run-a:answer', role: 'assistant', content: run.answer, status: 'completed' }]);
  });
  it('rejects unbounded/malformed archive responses instead of rendering an unlimited or invalid cache', () => {
    expect(() => conversationList({ conversations: Array.from({ length: 11 }, () => ({ id: 'x', title: 'x', updatedAt: 'x' })) })).toThrow();
    expect(() => conversationPage({ conversation: { id: 'a', title: 'a' }, runs: Array.from({ length: 51 }, () => run) })).toThrow();
    expect(() => conversationPage({ conversation: { id: 'a', title: 'a' }, runs: [{ ...run, answer: { injected: 'object' } }] })).toThrow();
    expect(() => conversationPage({ conversation: { id: 'a', title: 'a' }, runs: [{ ...run, answer: 'x'.repeat(131_073) }] })).toThrow();
    expect(() => conversationList({ conversations: [], nextCursor: 'bad/cursor' })).toThrow();
  });
  it('accepts historical null client IDs, opaque archive cursors and explicit protection/truncation flags', () => {
    const opaqueCursor = 'e'.repeat(240);
    expect(conversationList({ conversations: [], nextCursor: opaqueCursor }).nextCursor).toBe(opaqueCursor);
    const page = conversationPage({ conversation: { id: 'a', title: 'a' }, runs: [{ ...run, clientMessageId: null, answer: 'x'.repeat(25_000), redacted: true, truncated: true }], nextCursor: opaqueCursor });
    expect(page.runs[0].clientMessageId).toBeNull();
    const message = archiveMessages(page.runs, 'Empty')[1];
    expect(message).toMatchObject({ redacted: true, truncated: true });
    expect(conversationContentNotice(message, 'en')).toBe('Protected content omitted · Content shortened');
    expect(conversationContentNotice({ redacted: true }, 'sq')).toBe('Përmbajtje e mbrojtur e lënë jashtë');
  });
  it('preserves received partial text after cancellation or network failure and avoids repeated fallbacks', () => {
    expect(withPartialAnswer('Dy kantiere:', 'U ndal')).toBe('Dy kantiere:\n\nU ndal');
    expect(withPartialAnswer('Dy kantiere:\n\nU ndal', 'U ndal')).toBe('Dy kantiere:\n\nU ndal');
    expect(withPartialAnswer('  ', 'Provo sërish')).toBe('Provo sërish');
  });
  it('uses canonical completed answers, but never discards a longer received partial for failed storage output', () => {
    expect(canonicalAnswer('Dy', 'Dy kantiere: A dhe B.', 'COMPLETED', 'Gabim')).toBe('Dy kantiere: A dhe B.');
    expect(canonicalAnswer('Dy kantiere: A', 'Përgjigje e ndërprerë.', 'FAILED', 'Gabim')).toBe('Dy kantiere: A\n\nPërgjigje e ndërprerë.');
    expect(canonicalAnswer('Dy', 'Dy\n\nU ndërpre.', 'INTERRUPTED', 'Gabim')).toBe('Dy\n\nU ndërpre.');
    expect(canonicalAnswer('private-secret', 'Protected content omitted', 'FAILED', 'Gabim', true)).toBe('Protected content omitted');
  });
  it('does not label an empty failed run as pending or an interrupted run as successfully completed', () => {
    expect(archiveMessages([{ ...run, answer: '', status: 'FAILED' }], 'Gabim', 'Po punohet')[1]).toMatchObject({ content: 'Gabim', status: 'FAILED' });
    expect(archiveMessages([{ ...run, answer: '', status: 'RUNNING' }], 'Gabim', 'Po punohet')[1]).toMatchObject({ content: 'Po punohet', status: 'RUNNING' });
    const copy = conversationCopy('sq');
    expect(conversationStatus('COMPLETED', copy)).toBe('');
    expect(conversationStatus('FAILED', copy)).toBe(copy.interrupted);
    expect(conversationStatus('RUNNING', copy)).toBe(copy.pending);
  });
  it('merges paginated conversation summaries by ID without duplicating archives', () => {
    const summaries = mergeConversations([{ id: 'a', title: 'A', updatedAt: '2026-11-04' }], [{ id: 'a', title: 'Updated', updatedAt: '2026-11-05' }, { id: 'b', title: 'B', updatedAt: '2026-11-03' }]);
    expect(summaries.map(c => c.id)).toEqual(['a', 'b']); expect(summaries[0].title).toBe('Updated');
  });
  it('uses Albanian/German labels with an English fallback for other locales', () => {
    expect(conversationCopy('sq').newChat).toBe('Bisedë e re'); expect(conversationCopy('de').newChat).toBe('Neuer Chat'); expect(conversationCopy('it').newChat).toBe('New chat');
  });
});
