import type { RequesterContext } from "./requester";

export const ASSISTANT_LANGUAGE_OPTIONS = [
  { code: "DE", label: "Deutsch", promptLabel: "Deutsch" },
  { code: "EN", label: "English", promptLabel: "Englisch" },
  { code: "SQ", label: "Shqip", promptLabel: "Albanisch" },
  { code: "IT", label: "Italiano", promptLabel: "Italienisch" },
  { code: "PL", label: "Polski", promptLabel: "Polnisch" },
  { code: "RO", label: "Romana", promptLabel: "Rumaenisch" },
] as const;

export const ASSISTANT_LANGUAGE_CODES = ["DE", "EN", "SQ", "IT", "PL", "RO"] as const;

export type AssistantLanguageCode = (typeof ASSISTANT_LANGUAGE_CODES)[number];

const ASSISTANT_LANGUAGE_CODE_SET = new Set<string>(ASSISTANT_LANGUAGE_CODES);

export function normalizeAssistantLanguage(value: FormDataEntryValue | string | null | undefined): AssistantLanguageCode {
  const code = String(value ?? "").trim().toUpperCase();
  return ASSISTANT_LANGUAGE_CODE_SET.has(code) ? (code as AssistantLanguageCode) : "DE";
}

export function assistantLanguageLabel(value: string) {
  return ASSISTANT_LANGUAGE_OPTIONS.find((option) => option.code === value)?.label ?? "Deutsch";
}

export function assistantLanguagePromptLabel(value: string) {
  return ASSISTANT_LANGUAGE_OPTIONS.find((option) => option.code === value)?.promptLabel ?? "Deutsch";
}

export function detectLanguageFromText(text: string): AssistantLanguageCode | null {
  const t = (text ?? "").trim();
  if (!t) return null;

  // Polish diacritics
  if (/[ąćęłńóśżź]/i.test(t)) return "PL";

  // Albanian diacritics + common words
  if (/[ëç]/i.test(t)) return "SQ";
  if (/\b(shume|shumë|pune|punë|punuan|punetoret|punëtorët|përshëndetje|pershendetje|ku|jam|te|pema|baustelle|tabelat|ore|orë)\b/i.test(t)) return "SQ";

  // Italian diacritics + common words.
  if (/[àèéìòù]/i.test(t)) return "IT";
  if (/\b(ciao|grazie|oggi|domani|ieri|cantiere|macchina|lavoro)\b/i.test(t)) return "IT";

  // Romanian diacritics + common words.
  if (/[ăâîșşțţ]/i.test(t)) return "RO";
  if (/\b(salut|multumesc|mulțumesc|azi|maine|mâine|ieri|santier|șantier|masina|mașina)\b/i.test(t)) return "RO";

  // English common words.
  if (/\b(hello|thanks|please|today|tomorrow|yesterday|where|when|worker|machine|hours|site)\b/i.test(t)) return "EN";

  // German heuristics
  if (/[äöüß]/i.test(t)) return "DE";
  if (/\b(hallo|bitte|danke|baustelle|maschine|schilder|einsammeln|setzen|anfordern)\b/i.test(t)) return "DE";

  return null;
}

export function languageForTurn(requester: RequesterContext, lastUserMessage: string): AssistantLanguageCode {
  return detectLanguageFromText(lastUserMessage) ?? normalizeAssistantLanguage(requester.preferredLanguage);
}
