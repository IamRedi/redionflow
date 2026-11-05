import type { ToolExecutionOptions, ToolSet } from 'ai';
import { assistantSteps } from './limits';
import { isAssistantDateKey } from './turn-context';

/** Evidence is read afresh each turn; a transcript is never an operational source. */
export function groundedStep({ stepNumber }: { stepNumber: number }, metaQuestion = false) {
  if (stepNumber === 0 && metaQuestion) return { toolChoice: { type: 'tool' as const, toolName: 'getAssistantCapabilities' } };
  if (metaQuestion) return { toolChoice: 'none' as const };
  return { toolChoice: stepNumber === 0 ? 'required' as const : stepNumber >= assistantSteps('admin') - 1 ? 'none' as const : 'auto' as const };
}

export function assistantMetaQuestion(text: string) {
  return /^(?:(?:hej|hi|hello|hey|hallo|p[eë]rsh[eë]ndetje|ciao|salut|cze[sś][cć]|faleminderit|thanks|thank you|danke|grazie|mul[tț]umesc|dzi[eę]kuj[eę])[\s!.?]*|(?:[cç]far[eë] mund (?:t[eë] )?b[eë]sh|what can you do|was kannst du|cosa puoi fare|ce po[tț]i face|co potrafisz)[\s?.!]*)$/iu.test(text.trim());
}

function invalidDateInput(input: unknown) {
  if (!input || typeof input !== 'object') return false;
  return Object.entries(input).some(([key, value]) => {
    if (value == null) return false;
    if (['date', 'referenceDate', 'rangeFrom', 'rangeTo', 'from', 'to'].includes(key)) return typeof value !== 'string' || !isAssistantDateKey(value);
    if (['month', 'yearMonth'].includes(key)) return typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
    return false;
  });
}

/** All registered tools are local read-only functions, never provider-defined tools. */
export function groundedTools<T extends ToolSet>(tools: T, timeZone: string, now: () => Date = () => new Date()): T {
  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => {
    const execute = tool.execute as ((input: unknown, options: ToolExecutionOptions) => unknown) | undefined;
    if (!execute) return [name, tool];
    return [name, { ...tool, execute: async (input: unknown, options: ToolExecutionOptions) => {
      const evidence = { source: name, retrievedAt: now().toISOString(), timeZone, scope: 'authenticated_company', readOnly: true, untrustedText: true };
      if (invalidDateInput(input)) return { ok: false, code: 'INVALID_DATE', evidence, message: 'Invalid calendar date/month. Ask for a valid date; never substitute today.' };
      try {
        const result = await execute(input, options);
        // Do not send unbounded reports back into the next paid model request.
        // Reject explicitly, rather than truncate rows and mislabel them a total.
        if (Buffer.byteLength(JSON.stringify(result) ?? '', 'utf8') > 24 * 1024) return { ok: false, code: 'RESULT_TOO_LARGE', evidence, message: 'This result is too large. Narrow the period/entity or use a smaller paginated query; no complete answer is available from this result.' };
        return { evidence, result };
      } catch {
        // SQL/provider exception text can contain secrets or private internals.
        return { ok: false, code: 'READ_UNAVAILABLE', evidence, message: 'The source could not be read. Say which information is unavailable; do not infer zero, no work, or a previous value.' };
      }
    } }];
  })) as T;
}
