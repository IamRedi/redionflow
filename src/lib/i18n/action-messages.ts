import { t } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export function formatActionMessage(template: string, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export async function getActionTranslator(scope = "workzone") {
  const lang = await resolveRequestLanguage();
  return (key: string, replacements?: Record<string, string | number>) =>
    formatActionMessage(t(`${scope}.${key}`, lang), replacements);
}
