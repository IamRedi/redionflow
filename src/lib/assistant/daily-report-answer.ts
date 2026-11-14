import type { AssistantMessage } from './limits';
import type { AssistantToolObservation } from './grounding';
import type { AssistantLanguageCode } from './language';
import type { assistantTurnContext } from './turn-context';
import type { SteelDailyReport } from './daily-report';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').toLowerCase().trim();
type Intent = { details: boolean };
const detail = /\b(detaj\w*|holl\w*|details?|breakdown|detaill\w*|dettagl\w*|detalii\w*|szczegol\w*)\b/u;
/** A narrow company-wide daily report, never a named employee/project, asset,
 * document or comparison. Other questions keep their specialized sources. */
export function resolveDailyReportIntent(messages: AssistantMessage[]): Intent | null {
  let intent: Intent | null = null;
  for (const m of messages.filter(m => m.role === 'user')) {
    const text = fold(m.content);
    const residue = text.replace(/\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/gu, '')
      .replace(/\b(me|mi|jep|nje|trego|te|lutem|dua|per|e|ne|i|sot|dje|neser|ditor|diten|dites|punes|kompanise|firmes|shkurt|raport\w*|report\w*|daily|day|today|yesterday|tomorrow|give|show|please|a|the|for|company|work|briefly|short|bericht\w*|tagesbericht\w*|heute|gestern|morgen|gib|zeig|mir|bitte|fur|firma|arbeit|kurz|rapporto|giornaliero|ieri|oggi|domani|dammi|mostra|un|il|di|lavoro|azi|astazi|ieri|maine|zilnic|arata|pentru|firma|raportul|raportu|dzienny|dzisiaj|wczoraj|jutro|pokaz|za|pracy|detaj\w*|holl\w*|details?|breakdown|detaill\w*|dettagl\w*|detalii\w*|szczegol\w*)\b/gu, '').replace(/[\s?.!,;:–—-]/gu, '');
    if (text.length > 300 || residue) { intent = null; continue; }
    if (/\b(raport\w*|reports?|bericht\w*|tagesbericht\w*|rapporto)\b/u.test(text)) intent = { details: detail.test(text) };
    else if (intent && detail.test(text)) intent = { details: true };
    else intent = null;
  }
  return intent;
}

const copy = {
  SQ: ['sq-AL','Raporti ditor','Punonjës me regjistrim pune','Gjithsej orë','Konfirmime procesesh','kantiere','Faza të shënuara përfunduar','Prerje pjesësh','Prerje asamblesh','Asambluar','copë','peshë e panjohur për','Orët mbeten të pakonfirmuara: ka regjistrime pa mbyllje.','emra të shfaqur','procese të shfaqura','Sasitë e proceseve nuk mblidhen si prodhim unik.','Nuk mund ta konfirmoj raportin e plotë. Zgjidh një ditë dhe provo sërish.'],
  EN: ['en-GB','Daily report','Workers with recorded sessions','Total hours','Process confirmations','sites','Phases marked complete','Parts cut','Assemblies cut','Assembled','pieces','unknown weight for','Hours remain unconfirmed: some sessions are unclosed.','names shown','processes shown','Process quantities are not added as unique output.','I cannot confirm the complete report. Select one day and retry.'],
  DE: ['de-DE','Tagesbericht','Personen mit Arbeitszeitbuchung','Stunden gesamt','Prozessbestätigungen','Baustellen','Als fertig markierte Phasen','Teile zugeschnitten','Baugruppen zugeschnitten','Montiert','Stück','Gewicht unbekannt für','Stunden unbestätigt: Arbeitszeiten sind noch offen.','Namen angezeigt','Prozesse angezeigt','Prozessmengen sind keine addierbare Gesamtproduktion.','Der vollständige Bericht ist nicht bestätigt. Wähle einen Tag und versuche es erneut.'],
  IT: ['it-IT','Rapporto giornaliero','Persone con orari registrati','Ore totali','Conferme di processo','cantieri','Fasi segnate completate','Pezzi tagliati','Assiemi tagliati','Assemblati','pezzi','peso sconosciuto per','Ore non confermate: ci sono registrazioni aperte.','nomi mostrati','processi mostrati','Le quantità delle fasi non si sommano come produzione unica.','Non posso confermare il rapporto completo. Scegli un giorno e riprova.'],
  RO: ['ro-RO','Raport zilnic','Persoane cu timp înregistrat','Ore totale','Confirmări de proces','șantiere','Faze marcate finalizate','Piese tăiate','Ansambluri tăiate','Asamblate','bucăți','greutate necunoscută pentru','Ore neconfirmate: există sesiuni neînchise.','nume afișate','procese afișate','Cantitățile proceselor nu se adună ca producție unică.','Nu pot confirma raportul complet. Alege o zi și reîncearcă.'],
  PL: ['pl-PL','Raport dzienny','Osoby z zapisanym czasem pracy','Godziny razem','Potwierdzenia procesów','budowy','Etapy oznaczone jako zakończone','Wycięte części','Wycięte zespoły','Zmontowane','szt.','nieznana masa dla','Godziny niepotwierdzone: są niezamknięte sesje.','pokazane osoby','pokazane procesy','Ilości procesów nie sumuje się jako unikalnej produkcji.','Nie mogę potwierdzić pełnego raportu. Wybierz dzień i spróbuj ponownie.'],
} satisfies Record<AssistantLanguageCode, string[]>;
const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 70);

export function createCanonicalDailyReportAnswer({ intent, language, turn }: { intent: Intent | null; language: AssistantLanguageCode; turn: ReturnType<typeof assistantTurnContext> }) {
  const c = copy[language], date = turn.singleDate ?? turn.today;
  let answer: string | null = null, applied = false;
  return {
    observe(event: Pick<AssistantToolObservation, 'toolName' | 'status' | 'result'>) {
      if (!intent || event.toolName !== 'adminGetSteelDailyReport') return;
      answer = null;
      if (event.status !== 'ok' || !event.result || typeof event.result !== 'object' || turn.invalidDates.length || turn.multipleDates || turn.mixedPeriods || turn.rangeRequested || turn.currentMonthRequested) return;
      const r = event.result as SteelDailyReport;
      if (!r.ok || r.date !== date || r.worker || r.source.snapshot !== 'repeatable-read' || !r.source.readOnly) return;
      const a = r.attendance, p = r.production;
      if (![a.recordedWorkers,a.sessionRows,a.closedRows,a.openRows,p.checks,p.projectCount,p.processCount].every(count)
        || a.closedRows + a.openRows !== a.sessionRows || a.recordedWorkers > a.sessionRows || !p.processesComplete
        || p.processes.length !== p.processCount || p.processes.reduce((n, x) => n + x.metric.checks, 0) !== p.checks
        || a.complete && (typeof a.totalHours !== 'number' || !Number.isFinite(a.totalHours) || a.totalHours < 0)
        || !p.processes.every(x => count(x.metric.pieces) && count(x.metric.checks) && count(x.metric.legacyPieces) && count(x.metric.missingPieces) && x.metric.missingPieces <= x.metric.pieces && x.metric.legacyPieces <= x.metric.pieces && Number.isFinite(x.metric.kg) && x.metric.kg >= 0)
        || r.selectedPhasesConfirmed !== null && !count(r.selectedPhasesConfirmed)) return;
      const num = (n: number) => n.toLocaleString(c[0], { maximumFractionDigits: 2 });
      const metric = (x: typeof p.processes[number]) => x.metric.missingPieces === x.metric.pieces && x.metric.pieces > 0 ? `${c[11]} ${x.metric.pieces} ${c[10]}` : `${x.metric.legacyPieces ? '≈ ' : ''}${num(x.metric.kg)} kg · ${x.metric.pieces} ${c[10]}${x.metric.missingPieces ? ` (${c[11]} ${x.metric.missingPieces} ${c[10]})` : ''}`;
      const lines = [`${c[1]} · ${date}`, `${c[2]}: ${a.recordedWorkers} · ${a.complete ? `${c[3]}: ${num(a.totalHours!)}` : c[12]}`, `${c[4]}: ${p.checks} · ${p.projectCount} ${c[5]}.`];
      for (const [list, stage, label] of [['part','cutting',c[7]],['assembly','cutting',c[8]],['assembly','assembly',c[9]]]) {
        const x = p.processes.find(x => x.list === list && x.stage === stage);
        if (x) lines.push(`${label}: ${metric(x)}.`);
      }
      if (r.selectedPhasesConfirmed !== null) lines.push(`${c[6]}: ${r.selectedPhasesConfirmed}.`);
      const projects = p.projects.slice(0, 5).map(x => clean(x.name));
      if (projects.length) lines.push(`${c[5]}: ${projects.join(', ')}${projects.length < p.projectCount ? ` (${projects.length}/${p.projectCount})` : ''}.`);
      if (intent.details) {
        const workers = a.workers.slice(0, 10);
        lines.push(`${c[13]} ${workers.length}/${a.recordedWorkers}: ${workers.map(w => `${clean(w.worker)}${w.hours === null ? '' : ` ${num(w.hours)} h`}`).join(', ')}.`);
        const other = p.processes.filter(x => !(x.stage === 'cutting' || x.stage === 'assembly' && x.list === 'assembly')).slice(0, 10);
        if (other.length) lines.push(`${c[14]} ${other.length + p.processes.length - p.processes.filter(x => !(x.stage === 'cutting' || x.stage === 'assembly' && x.list === 'assembly')).length}/${p.processCount}: ${other.map(x => `${clean(x.label)} [${x.list}]: ${metric(x)}`).join('; ')}.`);
      }
      lines.push(c[15]);
      const rendered = lines.join('\n');
      if (new TextEncoder().encode(rendered).length <= 3500) answer = rendered;
    },
    transformAnswer(original: string) { if (!intent) return original; applied = true; return answer ?? c[16]; },
    get diagnostics() { return { canonicalDailyReportApplied: applied, canonicalDailyReportVerified: answer !== null }; },
  };
}
