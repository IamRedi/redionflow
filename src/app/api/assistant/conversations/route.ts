import { assistantHistoryPage, assistantHistoryRead } from '@/lib/assistant/history-api';
import { listConversations } from '@/lib/assistant/history';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return assistantHistoryRead(async requester => {
    const page = await listConversations(requester, assistantHistoryPage(request, 10));
    return { ...page, conversations: page.conversations.map(row => ({ id: row.id, title: row.title, updatedAt: row.lastRunAt, createdAt: row.createdAt, runCount: row.runCount })) };
  });
}
