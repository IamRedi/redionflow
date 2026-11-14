import { dayKey, midnight, nextDay } from '@/lib/dashboard/steel-metrics';
import type { AssistantMessage } from './limits';

/** Strict Gregorian key: never let JS normalise 30 February into another day. */
export function isAssistantDateKey(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Half-open company-calendar bounds, shared with steel dashboard accounting. */
export function assistantDayBounds(key: string, timeZone: string) {
  if (!isAssistantDateKey(key)) return null;
  try {
    return { start: midnight(key, timeZone), end: midnight(nextDay(key), timeZone) };
  } catch {
    return null;
  }
}

function shiftDay(key: string, offset: number) {
  return new Date(Date.parse(`${key}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

const relativePatterns = [
  { offset: -1, pattern: /\b(dje|gestern|yesterday|ieri|wczoraj)\b/iu },
  { offset: 0, pattern: /\b(sot|heute|today|oggi|ast[aă]zi|dzisiaj|dzi[sś]|aktualisht|aktuell|jetzt|now)\b/iu },
  { offset: 1, pattern: /\b(nes[eë]r|morgen|tomorrow|domani|m[aâ]ine|jutro)\b/iu },
] as const;

function shortFollowUp(value: string) {
  const text = value.normalize('NFD').replace(/\p{M}/gu, '').trim();
  if (!text || text.length > 80) return false;
  if (/^(?:(?:me jep|trego|dua|give me|show|more|mehr|dammi|mostra|arata|pokaz)\s+)?(?:detaje(?:t)?|hollësi|hollesi|details?|breakdown|dettagli|detalii|szczegoly)(?:\s+please)?[\s?!.]*$/iu.test(text)) return true;
  return /^(po|edhe|dhe|p[eë]r|te|tek|kurse|nd[eë]rsa|und|auch|f[uü]r|and|also|what about|e|anche|ma|per|[sș]i|dar|pentru|a|i|tak)\b/iu.test(text)
    || /^(sot|dje|nes[eë]r|heute|gestern|morgen|today|yesterday|tomorrow|oggi|ieri|domani|ast[aă]zi|m[aâ]ine|dzisiaj|wczoraj|jutro)[\s?!.]*$/iu.test(text);
}

function datesInQuestion(text: string, today: string) {
  const dates = new Set<string>();
  const invalidDates = new Set<string>();
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const key = match[0];
    if (isAssistantDateKey(key)) dates.add(key);
    else invalidDates.add(key);
  }
  for (const match of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const key = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    if (isAssistantDateKey(key)) dates.add(key);
    else invalidDates.add(key);
  }
  const normalized = text.normalize('NFD').replace(/\p{M}/gu, '');
  for (const { offset, pattern } of relativePatterns) {
    if (pattern.test(normalized)) dates.add(shiftDay(today, offset));
  }
  return { dates: [...dates], invalidDates: [...invalidDates] };
}

function periodText(value: string) {
  // Albanian "shkurt" also means "briefly". A response-style instruction
  // must not turn yesterday's question into a February/day comparison.
  return value.normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\b(pergjigju|pergjigje|thuaj|shpjego|trego|kthe|shkruaj)\s+(?:(?:me|sa|te|nje)\s+){0,2}shkurt\b/giu, '');
}

function otherTimeScope(value: string) {
  const text = periodText(value);
  return /\b(\d{4}|muaj\w*|month\w*|monat\w*|mese|luna|miesiac\w*|jave\w*|week\w*|woche\w*|vit\w*|year\w*|jahr\w*|janar|shkurt|mars|prill|maj|qershor|korrik|gusht|shtator|tetor|nentor|dhjetor)\b/iu.test(text);
}

function otherPeriodScope(value: string) {
  // Remove whole day dates before looking for a standalone year/month so a
  // historical date such as 2025-11-01 remains a single-day instruction.
  const text = periodText(value)
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, '')
    .replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g, '');
  return /\b(muaj\w*|month\w*|monat\w*|mes[ei]|lun[ai]|miesiac\w*|jav\w*|week\w*|woche\w*|settimana|saptamana|tydzien|vit\w*|year\w*|jahr\w*|anno|anul|rok\w*|janar|shkurt|mars|prill|maj|qershor|korrik|gusht|shtator|tetor|nentor|dhjetor|(?:19|20)\d{2})\b/iu.test(text);
}

function rangeScope(value: string) {
  const text = value.normalize('NFD').replace(/\p{M}/gu, '');
  return /\b(since|seit|prej)\b|\b(from|nga|ab|da|dal|dalla|din|od|de la)\s+(?:(?:data|dates|date|the)\s+)?(?:\d{1,4}|sot|dje|neser|today|yesterday|tomorrow|heute|gestern|morgen|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/iu.test(text);
}

export function assistantTurnContext(messages: AssistantMessage[], options: { timeZone: string; now?: Date }) {
  const questions = messages.filter(message => message.role === 'user').map(message => message.content.trim());
  const question = questions.at(-1) ?? '';
  const previousQuestion = questions.at(-2) ?? '';
  const isFollowUp = shortFollowUp(question);
  const asksCurrentMonth = (value: string) => /\b(aktueller monat|current month|this month|diesen monat|k[eë]t[eë] muaj|muaji aktual|questo mese|luna aceasta|w tym miesi[aą]cu)\b/iu.test(value);
  let currentMonthRequested = asksCurrentMonth(question);
  const today = dayKey(options.now ?? new Date(), options.timeZone);
  let dates = datesInQuestion(question, today);
  let dateSource = question;
  // A qualifier-only follow-up may inherit the last requested date; a new date
  // replaces the old one. Never collect unrelated historical dates into a turn.
  if (isFollowUp && !otherTimeScope(question) && !dates.dates.length && !dates.invalidDates.length) {
    for (const previous of questions.slice(0, -1).reverse()) {
      const candidate = datesInQuestion(previous, today);
      if (candidate.dates.length || candidate.invalidDates.length) { dates = candidate; dateSource = previous; break; }
      if (otherTimeScope(previous)) { currentMonthRequested = asksCurrentMonth(previous); break; }
      if (!shortFollowUp(previous)) break;
    }
  }
  let anchor = questions.length - 2;
  while (anchor > 0 && shortFollowUp(questions[anchor])) anchor -= 1;
  const rangeRequested = rangeScope(dateSource);
  const mixedPeriods = dates.dates.length > 0 && (otherPeriodScope(dateSource) || rangeRequested);
  return {
    question,
    previousQuestion,
    effectiveQuestion: isFollowUp && previousQuestion ? questions.slice(Math.max(0, anchor)).join('\nFollow-up: ') : question,
    shortFollowUp: isFollowUp,
    timeZone: options.timeZone,
    today,
    yesterday: shiftDay(today, -1),
    tomorrow: shiftDay(today, 1),
    currentMonth: today.slice(0, 7),
    currentMonthRequested,
    singleDate: dates.dates.length === 1 && !dates.invalidDates.length && !mixedPeriods ? dates.dates[0] : null,
    multipleDates: dates.dates.length > 1,
    mixedPeriods,
    rangeRequested,
    invalidDates: dates.invalidDates,
  };
}

/** Comparisons retain each tool's supplied date instead of a global override. */
export function assistantToolDate(context: ReturnType<typeof assistantTurnContext>, supplied?: string) {
  return context.singleDate ?? supplied;
}
