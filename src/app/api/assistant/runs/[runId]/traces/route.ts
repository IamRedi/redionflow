import { assistantHistoryPage, assistantHistoryRead } from '@/lib/assistant/history-api';
import { listRunTraces } from '@/lib/assistant/history';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  return assistantHistoryRead(async requester => {
    const { runId } = await context.params;
    return listRunTraces(requester, runId, assistantHistoryPage(request, 30));
  });
}
