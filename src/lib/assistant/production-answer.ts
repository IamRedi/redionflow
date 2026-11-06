import type { AssistantToolObservation } from './grounding';
import type { AssistantLanguageCode } from './language';
import type { AssistantMessage } from './limits';
import type { assistantTurnContext } from './turn-context';
import { isAssistantDateKey } from './turn-context';

type Intent = { details: boolean; unsupportedScope?: boolean };
type Observation = Pick<AssistantToolObservation, 'toolName' | 'input' | 'result' | 'status'>;
type Turn = Pick<ReturnType<typeof assistantTurnContext>, 'singleDate' | 'currentMonthRequested' | 'multipleDates' | 'mixedPeriods' | 'rangeRequested'>;
const normalized = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').toLowerCase().trim();
const details = /\b(detaj\w*|holl\w*|details?|breakdown|detaill\w*|einzeln\w*|dettagl\w*|detalii\w*|szczegol\w*)\b/u;
const excluded = /\b(assistant\w*|asistent\w*|agent\w*|api|tools?|mjete|punetor\w*|workers?|employee\w*|mitarbeiter\w*|arbeiter\w*|operaio\w*|operai|angajat\w*|pracownik\w*|makin\w*|machines?|vehicles?|fahrzeug\w*|auto\w*|masin\w*|pojazd\w*|inventar\w*|inventory|stock|lager\w*|stoc\w*|magaz\w*|kost\w*|kusht\w*|cost\w*|price\w*|cmim\w*|preis\w*|prezz\w*|pret\w*|koszt\w*|euro|eur|gps|ore|hours?|stunden|fuel|karbur\w*|fatur\w*|sald\w*|weld\w*|schweiss\w*|sudur\w*|spaw\w*|paint\w*|lyer\w*|lack\w*|vernici\w*|vops\w*|malow\w*|pastri\w*|clean\w*|reinig\w*|ngark\w*|load\w*|verlad\w*|prer\w*|cut\w*|schneid\w*|tagli\w*|tai\w*|cieci\w*|asambl\w*|assembl\w*|mont(?!h)\w*)\b/u;
const factory = /\b(fabrik\w*|fabric\w*|factory|factories|workshop|werkstatt|fabbric\w*|officina|uzin\w*|fabryk\w*|zaklad\w*)\b/u;
const production = /\b(prodh\w*|produce\w*|producing|production|produzier\w*|produktion|prodotto|prodotti|produc\w*|produs\w*|wyprodu\w*|produkc\w*|bere|ber|beri|ben|made|manufactur\w*|gemacht|hergestell\w*)\b/u;
const quantity = /\b(sa|cfare|how much|how many|what|wie viel\w*|was|quanto\w*|cosa|cat\w*|ce|ile|co|show|summary|summar\w*|trego\w*|permbl\w*|ubersicht|riepilog\w*|rezumat|podsum\w*)\b/u;
const unsupportedScope = (question: string) => /\b(krahas\w*|versus|vs|compar\w*|against|gegenuber|vergleich\w*|confront\w*|rispetto|porown\w*|wzgledem|between|midis|zwischen|intre|miedzy|since|seit|prej|jav\w*|weeks?|woche\w*|settiman\w*|saptaman\w*|tydzien|tygod\w*|vit\w*|years?|jahr\w*|anno|anni|anul|ani|rok\w*)\b/u.test(question)
  || /\b(from|nga|ab|dal|din|od|de la)\b.*\b(to|deri|bis|al|do|pana)\b/u.test(question)
  || /\b(?:19|20)\d{2}\b(?!-\d{2})/u.test(question.replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/gu, '')) && !/\b(month\w*|muaj\w*|monat\w*|mes[ei]|lun[ai]|miesiac\w*|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*|janar|shkurt|prill|maj|qershor|korrik|gusht|shtator|tetor|nentor|dhjetor)\b/u.test(question);
function explicitProject(question: string) {
  const withoutGlobalBreakdown = question.replace(/\b(sipas (?:cdo )?projektit|by (?:each )?projects?|nach (?:jedem )?projekt|per (?:ogni )?progetto|pe (?:fiecare )?proiect|wedlug projektu)\b(?=\s*(?:$|[?.!,;]|(?:per |for |fur )?(?:dje|sot|yesterday|today|gestern|heute|ieri|oggi|azi|wczoraj|\d{4}-\d{2}-\d{2})\b))/gu, '');
  if (/\b(projekt\w*|projects?|progett\w*|proiect\w*|kantier\w*|sites?|baustell\w*|cantiere|santier\w*)\b/u.test(withoutGlobalBreakdown)) return true;
  for (const match of withoutGlobalBreakdown.matchAll(/\b(?:per|for|fur|pro|pe|dla|pentru)\s+(?:(?:a|an|the|nje|one|ein\w*|un|una|o|il|lo)\s+)?([\p{L}\d][\p{L}\d./-]*)/gu)) {
    if (!/^(?:\d{1,4}(?:[./-]\d{1,4})*|dje|sot|neser|yesterday|today|tomorrow|gestern|heute|morgen|ieri|oggi|domani|azi|astazi|maine|wczoraj|dzisiaj|jutro|this|last|previous|current|kete|diesen|letzten|vorigen|questo|scorso|acest\w*|ultim\w*|ten|poprzed\w*|muaj\w*|month\w*|monat\w*|mes[ei]|lun[ai]|miesiac\w*|date|data|daten|sentence|fjali\w*|word\w*|brief|short|shkurt|january|february|march|april|may|june|july|august|september|october|november|december|janar|mars|prill|maj|qershor|korrik|gusht|shtator|tetor|nentor|dhjetor)$/u.test(match[1].replace(/[./-]+$/g, ''))) return true;
  }
  return false;
}
function detailFollowUp(question: string) {
  if (!details.test(question) || question.length > 200) return false;
  // A qualifier-only follow-up can inherit the topic; a new unknown noun cannot.
  return !question.replace(/\b(me|mi|jep|trego|te|lutem|please|show|give|gib|zeig|mir|bitte|dammi|mostrami|arata|da|pokaz|podaj|detaj\w*|details?|breakdown|detaill\w*|dettagl\w*|detalii\w*|szczegol\w*|sipas|cdo|per|ne|e|by|for|each|the|nach|je|fur|pro|di|ogni|dupa|pe|fiecare|wedlug|dla|kazd\w*|projekt\w*|projects?|progett\w*|proiect\w*|dje|sot|yesterday|today|gestern|heute|ieri|oggi|azi|astazi|wczoraj|dzisiaj|muaj\w*|month\w*|monat\w*|mese|luna|miesiac\w*|kete|this|current|diesen|questo|acest\w*|tym|w)\b|\d+/gu, '').replace(/[\s?.!,;:/-]/g, '');
}

/** Deliberately narrow: unrelated or process-specific questions retain normal tools. */
export function resolveCanonicalProductionIntent(messages: AssistantMessage[]): Intent | null {
  const questions = messages.filter(message => message.role === 'user').map(message => normalized(message.content));
  let inherited: Intent | null = null;
  for (const question of questions) {
    // The repair workshop and company assets are separate from steel throughput,
    // even when a short question uses "bërë" (made/done) and "officina".
    if (/\b(oficin\w*|officin\w*|repair\w*|reparatur\w*|ripar\w*|defekt\w*|vegl\w*|vegel\w*|pajis\w*|pais\w*|mjet\w*)\b/u.test(question)) { inherited = null; continue; }
    if (question.length > 500 || excluded.test(question)) { inherited = null; continue; }
    if (factory.test(question) && production.test(question) && quantity.test(question) && !explicitProject(question)) inherited = { details: details.test(question), ...(unsupportedScope(question) ? { unsupportedScope: true } : {}) };
    else if (inherited && detailFollowUp(question)) inherited = { ...(inherited as Intent), details: true };
    else inherited = null;
  }
  return inherited;
}

const copy = {
  SQ: { locale: 'sq-AL', scope: 'Konfirmime prerjeje/asamblimi', labels: ['Prerje pjesësh', 'Prerje asamblesh', 'Asambluar'], pieces: 'copë', known: 'të njohura', missing: 'peshë e panjohur për', zero: 'Nuk ka konfirmime prerjeje/asamblimi', partial: 'projekte të shfaqura', more: 'ka më shumë' },
  EN: { locale: 'en-GB', scope: 'Cutting/assembly confirmations', labels: ['Parts cut', 'Assemblies cut', 'Assembled'], pieces: 'pieces', known: 'known', missing: 'unknown weight for', zero: 'No cutting/assembly confirmations', partial: 'projects shown', more: 'more remain' },
  DE: { locale: 'de-DE', scope: 'Bestätigte Zuschnitte/Montage', labels: ['Teile zugeschnitten', 'Baugruppen zugeschnitten', 'Montiert'], pieces: 'Stück', known: 'bekannt', missing: 'Gewicht unbekannt für', zero: 'Keine Zuschnitt-/Montagebestätigungen', partial: 'Projekte angezeigt', more: 'weitere vorhanden' },
  IT: { locale: 'it-IT', scope: 'Conferme taglio/assemblaggio', labels: ['Parti tagliate', 'Assiemi tagliati', 'Assemblati'], pieces: 'pezzi', known: 'noti', missing: 'peso sconosciuto per', zero: 'Nessuna conferma di taglio/assemblaggio', partial: 'progetti mostrati', more: 'altri disponibili' },
  RO: { locale: 'ro-RO', scope: 'Confirmări tăiere/asamblare', labels: ['Piese tăiate', 'Ansambluri tăiate', 'Asamblate'], pieces: 'bucăți', known: 'cunoscute', missing: 'greutate necunoscută pentru', zero: 'Nicio confirmare de tăiere/asamblare', partial: 'proiecte afișate', more: 'mai există' },
  PL: { locale: 'pl-PL', scope: 'Potwierdzenia cięcia/montażu', labels: ['Wycięte części', 'Wycięte zespoły', 'Zmontowane'], pieces: 'szt.', known: 'znane', missing: 'nieznana masa dla', zero: 'Brak potwierdzeń cięcia/montażu', partial: 'projekty pokazane', more: 'pozostały kolejne' },
} satisfies Record<AssistantLanguageCode, unknown>;
const unavailable = {
  SQ: 'Nuk kam konfirmime të plota për këtë përgjigje. Zgjidh një datë ose muaj.',
  EN: 'I do not have complete confirmations for this answer. Choose one date or month.',
  DE: 'Für diese Antwort fehlen vollständige Bestätigungen. Wähle ein Datum oder einen Monat.',
  IT: 'Non ho conferme complete per questa risposta. Scegli una data o un mese.',
  RO: 'Nu am confirmări complete pentru acest răspuns. Alege o dată sau o lună.',
  PL: 'Brakuje pełnych potwierdzeń dla tej odpowiedzi. Wybierz jedną datę lub miesiąc.',
};
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
type Metric = { kg: number | null; pieces: number; legacyPieces: number; missingPieces: number };
function readMetrics(value: unknown): Metric[] | null {
  const source = record(value), output: Metric[] = [];
  if (!source) return null;
  for (const key of ['cutParts', 'cutAssemblies', 'assembled']) {
    const item = record(source[key]);
    if (!item || !count(item.pieces) || !count(item.legacyPieces) || !count(item.missingPieces)
      || item.legacyPieces > item.pieces || item.missingPieces > item.pieces
      || !(typeof item.kg === 'number' && Number.isFinite(item.kg) && item.kg >= 0 || item.kg === null && item.missingPieces > 0)) return null;
    output.push(item as Metric);
  }
  return output;
}
const quotedName = (value: unknown) => typeof value === 'string' && value.trim() ? JSON.stringify(value) : null;

/** A standard production answer is rendered from source facts, never a model sum. */
export function createCanonicalProductionAnswer({ intent, turn, language }: { intent: Intent | null; turn: Turn; language: AssistantLanguageCode }) {
  const text = copy[language], number = new Intl.NumberFormat(text.locale, { maximumFractionDigits: 2 });
  let canonical: string | null = null, applied = false;
  const summary = (metrics: Metric[]) => metrics.map((metric, index) => {
    const quantity = `${number.format(metric.pieces)} ${text.pieces}`;
    const weight = metric.kg === null || metric.kg === 0 && metric.missingPieces > 0 ? '' : `${metric.legacyPieces > 0 ? '≈' : ''}${number.format(metric.kg)} kg${metric.missingPieces > 0 ? ` ${text.known}` : ''}`;
    const missing = metric.missingPieces > 0 ? `${text.missing} ${number.format(metric.missingPieces)} ${text.pieces}` : '';
    return `${text.labels[index]}: ${[quantity, weight, missing].filter(Boolean).join(', ')}`;
  }).join('; ');
  return {
    observe(event: Observation) {
      if (!intent || intent.unsupportedScope || turn.multipleDates || turn.mixedPeriods || turn.rangeRequested || event.toolName !== 'adminGetSteelProductionSummary' || event.status !== 'ok') return;
      const result = record(event.result), input = record(event.input);
      if (result?.ok !== true) return;
      const monthScope = !turn.singleDate && !input?.date && (!!input?.month || turn.currentMonthRequested);
      const period = monthScope ? result.month : result.selectedDate;
      if (typeof period !== 'string' || !(monthScope ? /^20\d{2}-(0[1-9]|1[0-2])$/.test(period) : isAssistantDateKey(period))) return;
      if (!monthScope && turn.singleDate && period !== turn.singleDate) return;
      if (!turn.singleDate && (monthScope ? input?.month && period !== input.month : input?.date && period !== input.date)) return;
      const daily = Array.isArray(result.dailyProduction) ? result.dailyProduction.map(record).find(day => day?.key === result.selectedDate) : null;
      const metrics = readMetrics(monthScope ? result.monthlyProduction : daily?.metrics);
      if (!metrics) return;
      const project = record(result.selectedProject), projectName = project && typeof project.id === 'string' ? quotedName(project.name) : null;
      const label = `${period}${projectName ? ` · ${projectName}` : ''}`;
      let answer = metrics.every(metric => metric.pieces === 0) ? `${label}: ${text.zero}.` : `${text.scope} · ${label}: ${summary(metrics)}.`;
      if (intent.details) {
        const rawProjects = monthScope ? result.projects : result.selectedDayProjects;
        const complete = monthScope ? result.projectPageComplete : result.selectedDayProjectsPageComplete;
        if (!Array.isArray(rawProjects) || typeof complete !== 'boolean' || !count(result.projectCount)) return;
        const projects: string[] = [];
        for (const raw of rawProjects) {
          const item = record(raw), name = quotedName(item?.name);
          const perProject = monthScope && item?.monthlyProduction === null
            ? [0, 1, 2].map(() => ({ kg: 0, pieces: 0, legacyPieces: 0, missingPieces: 0 }))
            : readMetrics(monthScope ? item?.monthlyProduction : item?.metrics);
          if (!item || typeof item.id !== 'string' || !name || !perProject) return;
          projects.push(`${name}: ${summary(perProject)}.`);
        }
        if (projects.length) answer += `\n${projects.join('\n')}`;
        if (!complete || input?.projectCursor || projects.length < result.projectCount) answer += `\n${projects.length}/${result.projectCount} ${text.partial}${!complete ? `; ${text.more}` : ''}.`;
      }
      canonical = answer;
    },
    transformAnswer(original: string) { if (!intent) return original; applied = true; return canonical ?? unavailable[language]; },
    snapshot() { return { applied, unavailable: applied && canonical === null }; },
  };
}
