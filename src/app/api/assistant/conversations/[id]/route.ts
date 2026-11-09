import { assistantHistoryPage, assistantHistoryRead } from '@/lib/assistant/history-api';
import { deleteConversation, getConversation } from '@/lib/assistant/history';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return assistantHistoryRead(async requester => {
    const { id } = await context.params;
    const page = await getConversation(requester, id, assistantHistoryPage(request, 50));
    return { conversation: { id: page.conversation.id, title: page.conversation.title },
      runs: [...page.runs].reverse().map(row => ({ id: row.id, clientMessageId: row.clientMessageId, question: row.question, answer: row.answer, status: row.status, createdAt: row.startedAt, completedAt: row.finishedAt, errorCode: row.errorCode, finishReason: row.finishReason, diagnostics: row.diagnostics, interrupted: row.interrupted,
        questionRedacted: row.questionRedacted, answerRedacted: row.answerRedacted, answerTruncated: row.answerTruncated, diagnosticsRedacted: row.diagnosticsRedacted, diagnosticsTruncated: row.diagnosticsTruncated, traceTruncated: row.traceTruncated })),
      hasMore: page.hasMore, nextCursor: page.nextCursor, order: 'oldest-first' };
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return assistantHistoryRead(async requester => {
    const { id } = await context.params;
    return deleteConversation(requester, id);
  });
}
