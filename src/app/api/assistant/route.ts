import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { rejectCrossOriginMutation } from '@/lib/auth/same-origin';
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from '@/lib/auth/login-guard';
import { withTenantContext } from '@/lib/db/tenant-context';
import { isSteelCompany } from '@/lib/dashboard/steel-access';
import { getRequesterContext } from '@/lib/assistant/requester';
import { readAssistantBody } from '@/lib/assistant/request-body';
import { reserveAssistantQuota, assistantQuotaResponse } from '@/lib/assistant/quota';
import { assistantGeneration } from '@/lib/assistant/generation';
import { languageForTurn, type AssistantLanguageCode } from '@/lib/assistant/language';
import { extractAddressedName, resolveIdentityTargetResult } from '@/lib/assistant/identity';
import { assistantTurnContext } from '@/lib/assistant/turn-context';
import { adminAssistantPrompt } from '@/lib/assistant/admin-prompt';
import { assistantMetaQuestion, groundedStep, groundedTools } from '@/lib/assistant/grounding';
import { legacyAssistantTools } from '@/lib/assistant/legacy-tools';
import { companyAssistantTools, steelAssistantTools } from '@/lib/assistant/business-tools';

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

/** Preserve the text-stream client while keeping raw provider errors private. */
function safeStream(response: Response, fallback: string, incomplete: () => boolean) {
  const reader = response.body?.getReader();
  if (!reader) return response;
  const encoder = new TextEncoder();
  let cancelled = false;
  let bytes = 0;
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (!cancelled) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          controller.enqueue(chunk.value);
        }
        if (!cancelled && (bytes === 0 || incomplete())) controller.enqueue(encoder.encode(`\n\n${fallback}`));
      } catch {
        if (!cancelled) controller.enqueue(encoder.encode(`\n\n${fallback}`));
      } finally {
        if (!cancelled) controller.close();
        reader.releaseLock();
      }
    },
    async cancel(reason) { cancelled = true; await reader.cancel(reason); },
  }), { status: response.status, headers: { ...Object.fromEntries(response.headers), 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const denied = rejectCrossOriginMutation(req);
  if (denied) return denied;
  let errorLanguage: AssistantLanguageCode = 'DE';
  try {
  const authenticated = await getRequesterContext();
  errorLanguage = authenticated.preferredLanguage;
  if (authenticated.kind !== 'admin') return NextResponse.json({ error: message(authenticated.preferredLanguage, 'admin') }, { status: 403 });
  const clientIp = getClientIp(req.headers);
  const access = await ensureLoginAllowed('assistant', clientIp);
  if (!access.ok) return assistantQuotaResponse({ ok: false, status: 429, reason: 'rate', retryAfterSeconds: access.retryAfterSeconds }, authenticated.preferredLanguage);
  const parsed = await readAssistantBody(req);
  if (!parsed.ok) {
    await registerFailedLogin('assistant', clientIp);
    return NextResponse.json({ error: message(authenticated.preferredLanguage, 'invalid') }, { status: parsed.status });
  }
  const question = parsed.data.messages.at(-1)!.content;
  const language = languageForTurn(authenticated, question);
  errorLanguage = language;
  const requester = { ...authenticated, preferredLanguage: language };
  if (!process.env.OPENAI_API_KEY?.trim()) return NextResponse.json({ error: message(language, 'disabled') }, { status: 503 });

  const turn = assistantTurnContext(parsed.data.messages, { timeZone: requester.timeZone ?? 'Europe/Berlin' });
  if (turn.invalidDates.length) return new Response(message(language, 'date'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    const company = await withTenantContext(requester.companyId, tx => tx.companyProfile.findUnique({ where: { id: requester.companyId }, select: { mode: true } }));
    if (!company) return NextResponse.json({ error: message(language, 'admin') }, { status: 403 });
    const steel = company.mode === 'bau' && await isSteelCompany(requester.companyId);
    const identity = await resolveIdentityTargetResult({ companyId: requester.companyId, addressedName: extractAddressedName(question) });
    if (identity.status === 'ambiguous') return new Response(`${message(language, 'ambiguous')}\n${identity.candidates.map(c => c.displayName).join(' · ')}`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    const quota = await reserveAssistantQuota(requester);
    if (!quota.ok) return assistantQuotaResponse(quota, language);
    const metaQuestion = assistantMetaQuestion(question);
    const registry = { ...legacyAssistantTools(requester, turn, steel), ...companyAssistantTools(requester, steel), ...(steel ? steelAssistantTools(requester, turn) : {}) };
    if (!metaQuestion) delete registry.getAssistantCapabilities;
    else for (const name of Object.keys(registry)) if (name !== 'getAssistantCapabilities') delete registry[name];
    const tools = groundedTools(registry, turn.timeZone);
    const generation = assistantGeneration(req, 'admin', quota.settle);
    let incomplete = false;
    const result = streamText({
      ...generation,
      temperature: 0,
      system: adminAssistantPrompt({ requester, turn, steel, target: identity.status === 'found' ? identity.target : null }),
      messages: parsed.data.messages,
      tools,
      prepareStep: step => groundedStep(step, metaQuestion),
      onFinish: async event => { incomplete = event.finishReason === 'length'; await generation.onFinish(event); },
    });
    return safeStream(result.toTextStreamResponse(), message(language, 'unavailable'), () => incomplete);
  } catch {
    return NextResponse.json({ error: message(errorLanguage, 'unavailable') }, { status: 503 });
  }
}
