/** "Ask your boss" text shown instead of the AI chat (safe for client code). */
const NO_ACCESS: Record<string, string> = {
  SQ: "Nuk keni akses në AI. Aksesin jua hap shefi.",
  DE: "Sie haben keinen Zugang zur KI. Den Zugang schaltet Ihr Chef frei.",
  EN: "You don't have access to the AI. Your boss can turn it on for you.",
  IT: "Non hai accesso all'IA. L'accesso te lo attiva il capo.",
  PL: "Nie masz dostępu do AI. Dostęp włącza szef.",
  RO: "Nu aveți acces la AI. Accesul vi-l deschide șeful.",
};

export function assistantNoAccessText(language: string | null | undefined) {
  return NO_ACCESS[String(language ?? "").toUpperCase()] ?? NO_ACCESS.DE;
}


const TOGGLE: Record<string, { title: string; on: string; off: string; grant: string; revoke: string }> = {
  SQ: { title: "Asistenti AI", on: "Ka akses në AI.", off: "Nuk ka akses në AI.", grant: "Hap aksesin", revoke: "Mbyll aksesin" },
  DE: { title: "KI-Assistent", on: "Hat Zugang zur KI.", off: "Kein Zugang zur KI.", grant: "Zugang freigeben", revoke: "Zugang sperren" },
  EN: { title: "AI assistant", on: "Has access to the AI.", off: "No access to the AI.", grant: "Turn on access", revoke: "Turn off access" },
  IT: { title: "Assistente IA", on: "Ha accesso all'IA.", off: "Nessun accesso all'IA.", grant: "Attiva accesso", revoke: "Disattiva accesso" },
  PL: { title: "Asystent AI", on: "Ma dostęp do AI.", off: "Brak dostępu do AI.", grant: "Włącz dostęp", revoke: "Wyłącz dostęp" },
  RO: { title: "Asistent AI", on: "Are acces la AI.", off: "Nu are acces la AI.", grant: "Deschide accesul", revoke: "Închide accesul" },
};

/** Labels for the boss's on/off control on a person's profile. */
export function assistantAccessToggleText(language: string | null | undefined) {
  return TOGGLE[String(language ?? "").toUpperCase()] ?? TOGGLE.EN;
}
