import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { rejectCrossOriginMutation } from '@/lib/auth/same-origin';
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from '@/lib/auth/login-guard';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { getRequesterContext } from '@/lib/assistant/requester';
import { platformAssistantTools, reportAssistantFailure } from "@/lib/assistant/platform-tools";
import { assistantNoAccessResponse, hasAssistantAccess } from '@/lib/assistant/access';
import { readAssistantBody } from '@/lib/assistant/request-body';
import { reserveAssistantQuota, assistantQuotaResponse } from '@/lib/assistant/quota';
import { assistantGeneration } from '@/lib/assistant/generation';
import { languageForTurn, type AssistantLanguageCode } from '@/lib/assistant/language';
import { extractAddressedName, resolveIdentityTargetResult } from '@/lib/assistant/identity';
import { assistantTurnContext } from '@/lib/assistant/turn-context';
import { adminAssistantPrompt } from '@/lib/assistant/admin-prompt';
import { assistantInitialTool, assistantMetaQuestion, groundedStep, groundedTools } from '@/lib/assistant/grounding';
import { legacyAssistantTools } from '@/lib/assistant/legacy-tools';
import { companyAssistantTools, steelAssistantTools } from '@/lib/assistant/business-tools';
import { createDocumentResolution } from '@/lib/assistant/document-resolution';
import { createAssistantRunDiagnostics, categorizeAssistantFailure, type AssistantFailureCode } from '@/lib/assistant/diagnostics';
import { AssistantHistoryError, startRun, appendTrace, finishRun, checkpointRun, type AssistantTerminalStatus } from '@/lib/assistant/history';
import { assistantResponseStream } from '@/lib/assistant/response-stream';
import { createLegacyWeightQualifier } from '@/lib/assistant/weight-qualifier';
import { createCanonicalProductionAnswer, resolveCanonicalProductionIntent } from '@/lib/assistant/production-answer';
import { createCanonicalAssetAnswer, resolveCanonicalAssetIntent } from '@/lib/assistant/asset-answer';
import { createCanonicalWorkforceAnswer, resolveCanonicalWorkforceIntent } from '@/lib/assistant/workforce-answer';
import { createCanonicalDailyReportAnswer, resolveDailyReportIntent } from '@/lib/assistant/daily-report-answer';
import type { RequesterContext } from '@/lib/assistant/requester';
import { logger } from '@/lib/observability/logger';

export const runtime = 'nodejs';

function message(lang: AssistantLanguageCode, key: 'admin' | 'invalid' | 'disabled' | 'unavailable' | 'date' | 'ambiguous') {
  const text = {
    SQ: { admin: 'Asistenti është vetëm për administratorë.', invalid: 'Kërkesë e pavlefshme.', disabled: 'Asistenti AI nuk është aktivizuar ende. Administratori duhet të vendosë çelësin OpenAI në konfigurimin sekret të serverit.', unavailable: 'Nuk arrita ta përfundoj përgjigjen nga burimet e sistemit. Provo sërish; mos e trajto përgjigjen e pjesshme si të plotë.', date: 'Data nuk është e vlefshme. Cilën datë të saktë do të kontrolloj?', ambiguous: 'Ka më shumë se një person me këtë emër. Për kë e ke fjalën?' },
    EN: { admin: 'The assistant is for administrators only.', invalid: 'Invalid request.', disabled: 'The AI assistant is not activated. The administrator must set the OpenAI key in the server secret configuration.', unavailable: 'I could not finish the answer from the system sources. Please retry; do not treat a partial answer as complete.', date: 'That calendar date is invalid. Which exact date should I check?', ambiguous: 'More than one person matches that name. Which person do you mean?' },
    DE: { admin: 'Der Assistent ist nur für Administratoren.', invalid: 'Ungültige Anfrage.', disabled: 'Der KI-Assistent ist noch nicht aktiviert. Der Administrator muss den OpenAI-Schlüssel in der geheimen Serverkonfiguration hinterlegen.', unavailable: 'Die Antwort aus den Systemquellen konnte nicht abgeschlossen werden. Bitte erneut versuchen; eine Teilantwort ist nicht vollständig.', date: 'Dieses Kalenderdatum ist ungültig. Welches genaue Datum soll ich prüfen?', ambiguous: 'Mehrere Personen haben diesen Namen. Welche Person meinst du?' },
    IT: { admin: 'Assistente riservato agli amministratori.', invalid: 'Richiesta non valida.', disabled: 'Assistente AI non ancora attivato. L’amministratore deve configurare la chiave OpenAI nei segreti del server.', unavailable: 'Non è stato possibile completare la risposta dalle fonti del sistema. Riprova; una risposta parziale non è completa.', date: 'Data di calendario non valida. Quale data esatta devo verificare?', ambiguous: 'Più persone corrispondono a questo nome. Quale intendi?' },
    RO: { admin: 'Asistentul este doar pentru administratori.', invalid: 'Cerere invalidă.', disabled: 'Asistentul AI nu este activat. Administratorul trebuie să configureze cheia OpenAI în secretele serverului.', unavailable: 'Nu am putut finaliza răspunsul din sursele sistemului. Reîncearcă; un răspuns parțial nu este complet.', date: 'Data calendaristică nu este validă. Ce dată exactă să verific?', ambiguous: 'Mai multe persoane au acest nume. La cine te referi?' },
    PL: { admin: 'Asystent jest dostępny tylko dla administratorów.', invalid: 'Nieprawidłowe żądanie.', disabled: 'Asystent AI nie jest aktywowany. Administrator musi ustawić klucz OpenAI w sekretach serwera.', unavailable: 'Nie udało się dokończyć odpowiedzi na podstawie źródeł systemu. Spróbuj ponownie; częściowa odpowiedź nie jest kompletna.', date: 'Ta data jest nieprawidłowa. Którą dokładnie datę sprawdzić?', ambiguous: 'Do tego imienia pasuje kilka osób. Kogo masz na myśli?' },
  };
  return text[lang][key];
}

function storageMessage(lang: AssistantLanguageCode) {
  const copy = { SQ: 'Historiku i bisedës nuk u ruajt. Provo sërish.', EN: 'The conversation could not be saved. Please retry.', DE: 'Der Chat konnte nicht gespeichert werden. Bitte erneut versuchen.', IT: 'La conversazione non è stata salvata. Riprova.', RO: 'Conversația nu a putut fi salvată. Reîncearcă.', PL: 'Nie udało się zapisać rozmowy. Spróbuj ponownie.' };
  return copy[lang];
}

function failureMessage(lang: AssistantLanguageCode, code: AssistantFailureCode) {
  if (lang === 'SQ') {
    if (code === 'provider_auth' || code === 'missing_key') return 'Lidhja me OpenAI nuk u autorizua. Kontrollo konfigurimin e çelësit në Railway.';
    if (code === 'provider_quota') return 'OpenAI refuzoi kërkesën për shkak të kufirit të llogarisë. Kontrollo kreditet/kufirin e saj.';
    if (code === 'rate') return 'Shumë kërkesa. Provo sërish pas pak.';
    if (code === 'timeout') return 'Kërkesa zgjati tepër dhe u ndërpre. Provo një pyetje më të kufizuar.';
    if (code === 'input_payload') return 'Kjo kërkesë tejkalon kufirin e kontekstit. Kufizo projektin ose periudhën.';
    if (code === 'cancel') return 'Përgjigjja u ndërpre.';
  }
  return message(lang, 'unavailable');
}

export async function POST(req: Request) {
  const denied = rejectCrossOriginMutation(req);
  if (denied) return denied;
  let errorLanguage: AssistantLanguageCode = 'DE';
  let history: Awaited<ReturnType<typeof startRun>> | null = null;
  let actor: RequesterContext | null = null;
  const headers = () => ({ 'cache-control': 'no-store', ...(history ? { 'x-assistant-conversation-id': history.conversationId, 'x-assistant-run-id': history.runId } : {}) });
  async function savedResponse(response: Response, status: AssistantTerminalStatus, code?: string) {
    if (history && actor) {
      const raw = await response.clone().text();
      let answer = raw;
      if (response.headers.get('content-type')?.includes('application/json')) {
        try { answer = JSON.parse(raw).error ?? raw; } catch { /* Keep the safe response text. */ }
      }
      if (!await finishRun(actor, { runId: history.runId, answer, status, errorCode: code, httpStatus: response.status })) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE');
    }
    for (const [key, value] of Object.entries(headers())) response.headers.set(key, value);
    return response;
  }
  try {
  const authenticated = await getRequesterContext();
  errorLanguage = authenticated.preferredLanguage;
  if (authenticated.kind !== 'admin') return NextResponse.json({ error: message(authenticated.preferredLanguage, 'admin') }, { status: 403 });
  // Not enabled by the boss: a plain message, no history, quota or provider call.
  if (!await hasAssistantAccess(authenticated)) return assistantNoAccessResponse(authenticated.preferredLanguage);
  actor = authenticated;
  const clientIp = getClientIp(req.headers);
  const access = await ensureLoginAllowed('assistant', clientIp);
  const parsed = await readAssistantBody(req);
  if (!parsed.ok) {
    await registerFailedLogin('assistant', clientIp);
    return NextResponse.json({ error: message(authenticated.preferredLanguage, 'invalid') }, { status: parsed.status });
  }
  const question = parsed.data.messages.at(-1)!.content;
  const language = languageForTurn(authenticated, question);
  errorLanguage = language;
  const requester = { ...authenticated, preferredLanguage: language };
  actor = requester;
  // Save each NEW question before quota or paid generation. Prompt history is
  // bounded separately and is never silently imported as trusted past evidence.
  history = await startRun(requester, { conversationId: parsed.data.conversationId, clientMessageId: parsed.data.clientMessageId, question });
  if (history.replayed) {
    if (history.status === 'running') return NextResponse.json({ error: language === 'SQ' ? 'Kjo pyetje po përpunohet ende. Hape sërish bisedën pas pak.' : 'This question is still being processed. Reopen the conversation shortly.' }, { status: 409, headers: headers() });
    return new Response(history.answer, { headers: { ...headers(), 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (!access.ok) return await savedResponse(assistantQuotaResponse({ ok: false, status: 429, reason: 'rate', retryAfterSeconds: access.retryAfterSeconds }, language), 'rejected', 'RATE_LIMITED');
  if (!process.env.OPENAI_API_KEY?.trim()) return await savedResponse(NextResponse.json({ error: message(language, 'disabled') }, { status: 503 }), 'rejected', 'KEY_MISSING');

  const turn = assistantTurnContext(parsed.data.messages, { timeZone: requester.timeZone ?? 'Europe/Berlin' });
  if (turn.invalidDates.length) return await savedResponse(new Response(message(language, 'date'), { headers: { 'content-type': 'text/plain; charset=utf-8' } }), 'completed', 'INVALID_DATE');
    const company = await withTenantContext(requester.companyId, tx => tx.companyProfile.findUnique({ where: { id: requester.companyId }, select: { mode: true } }));
    if (!company) return await savedResponse(NextResponse.json({ error: message(language, 'admin') }, { status: 403 }), 'rejected', 'INVALID_REQUEST');
    const steel = company.mode === 'bau' && await isSteelCompany(requester.companyId);
    const identity = await resolveIdentityTargetResult({ companyId: requester.companyId, addressedName: extractAddressedName(question) });
    if (identity.status === 'ambiguous') return await savedResponse(new Response(`${message(language, 'ambiguous')}\n${identity.candidates.map(c => c.displayName).join(' · ')}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } }), 'completed', 'AMBIGUOUS_PERSON');
    const quota = await reserveAssistantQuota(requester);
    if (!quota.ok) return await savedResponse(assistantQuotaResponse(quota, language), 'rejected', quota.status === 429 ? 'QUOTA_REJECTED' : 'QUOTA_UNAVAILABLE');
    const metaQuestion = assistantMetaQuestion(question);
    const dailyReportIntent = steel && !metaQuestion ? resolveDailyReportIntent(parsed.data.messages) : null;
    const productionIntent = steel && !metaQuestion ? resolveCanonicalProductionIntent(parsed.data.messages) : null;
    const assetIntent = steel && !metaQuestion && !productionIntent ? resolveCanonicalAssetIntent(question) : null;
    const workforceIntent = steel && !metaQuestion && !productionIntent && !assetIntent ? resolveCanonicalWorkforceIntent(question) : null;
    const documents = createDocumentResolution();
    const registry = { ...legacyAssistantTools(requester, turn, steel), ...companyAssistantTools(requester, steel, assetIntent, workforceIntent), ...(steel ? steelAssistantTools(requester, turn, documents, !!dailyReportIntent) : {}), ...platformAssistantTools(requester, { guide: steel }) };
    if (!metaQuestion) delete registry.getAssistantCapabilities;
    else for (const name of Object.keys(registry)) if (name !== 'getAssistantCapabilities') delete registry[name];
    const diagnostics = createAssistantRunDiagnostics();
    const weightQualifier = createLegacyWeightQualifier(turn);
    const productionAnswer = createCanonicalProductionAnswer({ intent: productionIntent, turn, language });
    const assetAnswer = createCanonicalAssetAnswer({ intent: assetIntent, language });
    const workforceAnswer = createCanonicalWorkforceAnswer({ intent: workforceIntent, language });
    const dailyReportAnswer = createCanonicalDailyReportAnswer({ intent: dailyReportIntent, language, turn });
    const runId = history.runId;
    const tools = groundedTools(registry, turn.timeZone, () => new Date(), async event => {
      const stored = await appendTrace(requester, { ...event, runId, evidence: { ...event.evidence, ...(event.failure ? { failure: event.failure } : {}) } });
      if (!stored) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE');
      documents.observe(event);
      weightQualifier.observe(event);
      productionAnswer.observe(event);
      assetAnswer.observe(event);
      workforceAnswer.observe(event);
      dailyReportAnswer.observe(event);
    });
    const disconnect = new AbortController();
    const generationRequest = new Request(req.url, { signal: AbortSignal.any([req.signal, disconnect.signal]) });
    const generation = assistantGeneration(generationRequest, 'admin', quota.settle, { onProviderCall: diagnostics.providerCall, onFailure: diagnostics.failure });
    let usage: Record<string, unknown> | undefined;
    const result = streamText({
      ...generation,
      temperature: 0,
      system: adminAssistantPrompt({ requester, turn, steel, target: identity.status === 'found' ? identity.target : null }),
      messages: parsed.data.messages,
      tools,
      prepareStep: step => ({ ...groundedStep(step, metaQuestion, dailyReportIntent ? 'adminGetSteelDailyReport' : productionIntent ? 'adminGetSteelProductionSummary' : assetIntent?.toolName ?? assistantInitialTool(question, steel)), activeTools: documents.activeTools(Object.keys(tools)) }),
      onFinish: async event => { usage = event.totalUsage; await generation.onFinish(event); },
    });
    return assistantResponseStream(result.fullStream, {
      diagnostics, headers: headers(), fallback: code => failureMessage(language, code), storageFailure: storageMessage(language),
      transformAnswer: text => weightQualifier.transformAnswer(dailyReportAnswer.transformAnswer(workforceAnswer.transformAnswer(assetAnswer.transformAnswer(productionAnswer.transformAnswer(text))))),
      onCancel: () => disconnect.abort(),
      onToolError: async event => {
        if (!await appendTrace(requester, { runId, toolCallId: event.toolCallId, toolName: event.toolName, input: event.input, result: { ok: false, diagnostic: event.failure }, status: 'error' })) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE');
      },
      onCheckpoint: async answer => { if (!await checkpointRun(requester, { runId, answer })) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE'); },
      onComplete: async final => {
        if (!await finishRun(requester, { runId, answer: final.answer, status: final.status, model: 'gpt-4o-mini', finishReason: final.diagnostics.finishReason ?? 'unknown', errorCode: final.diagnostics.failure?.code.toUpperCase(), diagnostics: { ...final.diagnostics, weightQualification: weightQualifier.snapshot(), canonicalProduction: productionAnswer.snapshot(), canonicalAsset: assetAnswer.snapshot(), canonicalWorkforce: workforceAnswer.snapshot(), canonicalDailyReport: dailyReportAnswer.diagnostics }, usage })) throw new AssistantHistoryError(503, 'HISTORY_UNAVAILABLE');
        const fault = final.diagnostics.failure ?? (final.diagnostics.lastToolFailure?.code === 'db' ? final.diagnostics.lastToolFailure : undefined);
        void reportAssistantFailure(requester, fault ?? undefined).catch(() => {});
        logger.info({ event: 'assistant.run', runId, status: final.status, failure: final.diagnostics.failure, lastToolFailure: final.diagnostics.lastToolFailure, steps: final.diagnostics.steps, providerCalls: final.diagnostics.providerCalls, failedToolResults: final.diagnostics.failedToolResults }, 'Assistant request completed');
      },
    });
  } catch (error) {
    if (error instanceof AssistantHistoryError) {
      const text = error.code === 'RUNNING'
        ? errorLanguage === 'SQ' ? 'Përgjigjja e mëparshme po përpunohet ende. Rifresko bisedën pas pak.' : 'The previous answer is still processing. Refresh this conversation shortly.'
        : error.code === 'HISTORY_NOT_FOUND' ? errorLanguage === 'SQ' ? 'Biseda nuk u gjet.' : 'Conversation not found.' : storageMessage(errorLanguage);
      return NextResponse.json({ error: text, code: error.code }, { status: error.status, headers: headers() });
    }
    const failure = categorizeAssistantFailure(error);
    if (actor) void reportAssistantFailure(actor, failure).catch(() => {});
    const response = NextResponse.json({ error: failureMessage(errorLanguage, failure.code) }, { status: 503, headers: headers() });
    try { return await savedResponse(response, 'error', failure.code.toUpperCase()); } catch { return NextResponse.json({ error: storageMessage(errorLanguage) }, { status: 503, headers: headers() }); }
  }
}
