import { rejectCrossOriginMutation } from "@/lib/auth/same-origin";
import { NextResponse } from "next/server";
import { stepCountIs, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { assistantLanguagePromptLabel, type AssistantLanguageCode, languageForTurn } from "@/lib/assistant/language";
import { getRequesterContext } from "@/lib/assistant/requester";
import { getWorkerAssistantContext } from "@/lib/assistant/worker-context";
import { ensureLoginAllowed, getClientIp, registerFailedLogin } from "@/lib/auth/login-guard";

export const runtime = "nodejs";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
});

function workerOnlyError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return "Nuk ka akses: ky ndihmes eshte vetem per worker-at e loguar ne Workzone.";
  if (lang === "EN") return "No access: this assistant is only available to signed-in Workzone workers.";
  if (lang === "IT") return "Accesso negato: questo assistente e disponibile solo per i worker collegati in Workzone.";
  if (lang === "RO") return "Fara acces: acest asistent este disponibil doar pentru workerii conectati in Workzone.";
  if (lang === "PL") return "Brak dostepu: ten asystent jest dostepny tylko dla zalogowanych workerow w Workzone.";
  return "Kein Zugriff: Dieser Helfer ist nur fuer eingeloggte Worker in der Workzone.";
}

function missingApiKeyError(lang: AssistantLanguageCode) {
  if (lang === "SQ") return 'Mungon OPENAI_API_KEY. Vendose ne `.env` dhe rinis dev-serverin.';
  if (lang === "EN") return 'OPENAI_API_KEY is missing. Set it in `.env` and restart the dev server.';
  if (lang === "IT") return 'OPENAI_API_KEY mancante. Impostala in `.env` e riavvia il dev server.';
  if (lang === "RO") return 'OPENAI_API_KEY lipseste. Seteaz-o in `.env` si reporneste dev serverul.';
  if (lang === "PL") return 'Brakuje OPENAI_API_KEY. Ustaw go w `.env` i uruchom ponownie dev server.';
  return 'OPENAI_API_KEY fehlt. Bitte in `.env` setzen und den Dev-Server neu starten.';
}

function rateLimitedError(lang: AssistantLanguageCode, retryAfterSeconds: number) {
  const s = retryAfterSeconds;
  if (lang === "SQ") return `Shume kerkesa. Provo perseri pas ${s}s.`;
  if (lang === "EN") return `Too many requests. Try again in ${s}s.`;
  if (lang === "IT") return `Troppe richieste. Riprova tra ${s}s.`;
  if (lang === "RO") return `Prea multe cereri. Reincearca in ${s}s.`;
  if (lang === "PL") return `Za duzo zapytan. Sprobuj za ${s}s.`;
  return `Zu viele Anfragen. Bitte in ${s}s erneut versuchen.`;
}

export async function POST(req: Request) {
  const originDenied = rejectCrossOriginMutation(req);
  if (originDenied) return originDenied;
  const requester = await getRequesterContext();
  const fallbackLanguage = requester.preferredLanguage;
  if (requester.kind !== "worker") {
    return NextResponse.json(
      { error: workerOnlyError(fallbackLanguage) },
      { status: 403 },
    );
  }

  // BDF-P8-007: same rate-limit ceiling as the admin assistant so a
  // compromised worker session cannot run up OpenAI cost either.
  const clientIp = getClientIp(req.headers);
  const access = await ensureLoginAllowed("assistant", clientIp);
  if (!access.ok) {
    return NextResponse.json(
      { error: rateLimitedError(fallbackLanguage, access.retryAfterSeconds) },
      { status: 429, headers: { "Retry-After": String(access.retryAfterSeconds) } },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: missingApiKeyError(fallbackLanguage) },
      { status: 500 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    await registerFailedLogin("assistant", clientIp);
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const lastUser = [...parsed.data.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const turnLanguage = languageForTurn(requester, lastUser);
  const docs = await getWorkerAssistantContext();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    stopWhen: stepCountIs(8),
    system: `Du bist der Worker Assistant fuer die Workzone.

Du hilfst nur eingeloggten Workern.
Du bist read-only.
Du fuehrst keine Schreibaktionen aus.
Du behauptest nie, etwas gespeichert, geaendert, gestartet, gestoppt, hochgeladen oder geloescht zu haben.
Du erklaerst nur, was der Worker in der sichtbaren Workzone-UI tun kann.
Du bleibst strikt innerhalb der Worker-Permissions.
Du erklaerst keine Admin-Funktionen.
Du gibst keine Hinweise, wie man Worker-Scope oder Rechte umgeht.
Wenn etwas nicht im Worker-Guide steht oder nach Admin klingt, sag klar, dass es nicht Teil der Worker-Oberflaeche ist.

Antwortstil:
- kurz
- freundlich
- konkret
- schrittweise, wenn nach Navigation oder Bedienung gefragt wird
- keine technischen Erklaerungen
- keine Tool-Listen

Antwortsprache:
- Antworte auf ${assistantLanguagePromptLabel(turnLanguage)}.

Kontext aus der Workzone-Dokumentation:

--- WORKER_ASSISTANT ---
${docs.assistantGuide}

--- WORKER_UI_MAP ---
${docs.uiMap}

--- WORKER_PERMISSION_MATRIX ---
${docs.permissionMatrix}
`,
    messages: parsed.data.messages,
  });

  return result.toTextStreamResponse();
}
