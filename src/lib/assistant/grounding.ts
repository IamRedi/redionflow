import type { ToolExecutionOptions, ToolSet } from 'ai';
import { assistantSteps } from './limits';
import { isAssistantDateKey } from './turn-context';
import { categorizeAssistantFailure, type AssistantFailure } from './diagnostics';

export type AssistantToolObservation = {
  toolCallId: string; toolName: string; input: unknown; result: unknown;
  evidence: Record<string, unknown>; status: 'ok' | 'error' | 'rejected';
  startedAt: Date; durationMs: number; failure?: AssistantFailure;
};

/** Evidence is read afresh each turn; a transcript is never an operational source. */
export function groundedStep({ stepNumber }: { stepNumber: number }, metaQuestion = false, initialTool?: string) {
  if (stepNumber === 0 && metaQuestion) return { toolChoice: { type: 'tool' as const, toolName: 'getAssistantCapabilities' } };
  if (stepNumber === 0 && initialTool) return { toolChoice: { type: 'tool' as const, toolName: initialTool } };
  if (metaQuestion) return { toolChoice: 'none' as const };
  return { toolChoice: stepNumber === 0 ? 'required' as const : stepNumber >= assistantSteps('admin') - 1 ? 'none' as const : 'auto' as const };
}

/** High-confidence short questions must not fall back to the workshop directory. */
export function assistantInitialTool(question: string, steel: boolean) {
  if (!steel) return undefined;
  const text = question.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (text.length > 160) return undefined;
  const asset = /\b(vegl\w*|vegel\w*|pajis\w*|pais\w*|makin\w*|mjet\w*|trapan\w*|vidator\w*|tools?|equipment|vehicles?|drills?|maschinen?|fahrzeug\w*|werkzeug\w*|attrezz\w*|utensil\w*|veicol\w*)\b/u.test(text);
  const workshop = /\b(oficin\w*|officin\w*|ripar\w*|defekt\w*|repair\w*|workshops?|werkstatt\w*|reparatur\w*)\b/u.test(text);
  if (/^(?:si\b|how (?:do|can) i\b|where (?:do|can) i\b|wie kann ich\b|come posso\b)/u.test(text)) return undefined;
  const worker = /\b(punetor\w*|workers?|employees?|mitarbeiter\w*|operaio\w*|angajat\w*|pracownik\w*)\b/u.test(text);
  if ((asset || workshop) && worker) return undefined;
  // A mentioned site must not redirect an asset custody/location question to
  // the site directory. Worker-specific lists still allow worker discovery first.
  if (asset && /^(?:ku|kujt|kush|where|who|wo|wem|wer|dove|chi)\b/u.test(text)) return 'adminSearchCompanyAssets';
  if (workshop && /\b(sa|cil\w*|cfare|which|how many|welche|wie viele|quali|quanti|quante)\b/u.test(text)) return 'adminGetCompanyWorkshop';
  if (asset || workshop) return undefined;
  const site = /\b(kantier\w*|kanti\w*|projekt\w*|sites?|projects?|baustellen?)\b/u.test(text);
  const started = /\b(fill\w*|nis\w*|start\w*|begonn\w*)\b/u.test(text);
  if (site && started) return 'adminGetStartedSteelProjects';
  if (site && /\b(sa|cil\w*|how many|which|wie viele|welche)\b/u.test(text)
      && !/\b(punetor\w*|ore|kg|material\w*|prer\w*|asambl\w*|mont\w*|worker\w*|hours?|cut\w*)\b/u.test(text)) return 'adminSearchSteelProjects';
  return undefined;
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
export function groundedTools<T extends ToolSet>(tools: T, timeZone: string, now: () => Date = () => new Date(), observe?: (event: AssistantToolObservation) => Promise<void>): T {
  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => {
    const execute = tool.execute as ((input: unknown, options: ToolExecutionOptions) => unknown) | undefined;
    if (!execute) return [name, tool];
    // Responses otherwise normalizes optional fields into strict required/null
    // arguments. Keep the declared Zod optional contract and its server-side
    // validation; a missing filter must never turn into an invalid null filter.
    return [name, { ...tool, strict: tool.strict ?? false, execute: async (input: unknown, options: ToolExecutionOptions) => {
      const startedAt = now();
      const evidence = { source: name, retrievedAt: startedAt.toISOString(), timeZone, scope: 'authenticated_company', readOnly: true, untrustedText: true };
      let output: unknown, recordedResult: unknown, status: AssistantToolObservation['status'] = 'ok', failure: AssistantFailure | undefined;
      if (invalidDateInput(input)) {
        status = 'rejected';
        recordedResult = output = { ok: false, code: 'INVALID_DATE', evidence, message: 'Invalid calendar date/month. Ask for a valid date; never substitute today.' };
      } else {
      try {
        const result = await execute(input, options);
        recordedResult = result;
        if (result && typeof result === 'object' && 'ok' in result && result.ok === false) status = 'error';
        // Do not send unbounded reports back into the next paid model request.
        // Reject explicitly, rather than truncate rows and mislabel them a total.
        if (Buffer.byteLength(JSON.stringify(result) ?? '', 'utf8') > 24 * 1024) {
          status = 'rejected';
          output = { ok: false, code: 'RESULT_TOO_LARGE', evidence, message: 'This result is too large. Narrow the period/entity or use a smaller paginated query; no complete answer is available from this result.' };
        } else output = { evidence, result };
      } catch (error) {
        // SQL/provider exception text can contain secrets or private internals.
        status = 'error'; failure = categorizeAssistantFailure(error, { source: 'tool' });
        recordedResult = output = { ok: false, code: 'READ_UNAVAILABLE', evidence, diagnostic: failure, message: 'The source could not be read. Say which information is unavailable; do not infer zero, no work, or a previous value.' };
      }
      }
      await observe?.({ toolCallId: options.toolCallId, toolName: name, input, result: recordedResult, evidence, status, startedAt, durationMs: Math.max(0, now().getTime() - startedAt.getTime()), ...(failure ? { failure } : {}) });
      return output;
    } }];
  })) as T;
}
