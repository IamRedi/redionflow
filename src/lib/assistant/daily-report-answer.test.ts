import { expect, it } from 'vitest';
import { createCanonicalDailyReportAnswer, resolveDailyReportIntent } from './daily-report-answer';
import { assistantTurnContext } from './turn-context';
import type { AssistantMessage } from './limits';
const messages = (question = 'Me jep nje raport per dje'): AssistantMessage[] => [{ role: 'user', content: question }];
const turn = assistantTurnContext(messages(), { timeZone: 'Europe/Tirane', now: new Date('2026-11-14T08:00Z') });
function source() {
  return { ok: true, date: '2026-11-13', worker: null, source: { readOnly: true, snapshot: 'repeatable-read' },
    attendance: { recordedWorkers: 3, sessionRows: 3, closedRows: 3, openRows: 0, totalHours: 23.5, complete: true, workersComplete: true, workers: [{ worker: 'Checker Demo', hours: 6.25 }] },
    production: { checks: 3, projectCount: 1, projectsComplete: true, projects: [{ id: 'site-demo', name: 'Demo Steel', checks: 3 }], processCount: 3, processesComplete: true,
      processes: [{ list: 'part', stage: 'cutting', label: 'Cutting', metric: { kg: 50, pieces: 5, checks: 1, legacyPieces: 5, missingPieces: 0 } }, { list: 'assembly', stage: 'assembly', label: 'Assembly', metric: { kg: 100, pieces: 1, checks: 1, legacyPieces: 0, missingPieces: 0 } }, { list: 'assembly', stage: 'welding', label: 'Welding', metric: { kg: 100, pieces: 1, checks: 1, legacyPieces: 0, missingPieces: 0 } }] }, selectedPhasesConfirmed: 4 };
}
function guard(question = 'Me jep nje raport per dje') { return createCanonicalDailyReportAnswer({ intent: resolveDailyReportIntent(messages(question)), language: 'SQ', turn }); }
it.each(['Me jep nje raport per dje', 'Raporti ditor sot', 'Give me a daily report for yesterday', 'Tagesbericht gestern', 'Rapporto giornaliero ieri', 'Raport zilnic azi', 'Raport dzienny wczoraj', 'Raport për 2026-11-13'])('recognizes a company daily report: %s', q => expect(resolveDailyReportIntent(messages(q))).not.toBeNull());
it.each(['Raport per Agron Hoxha dje', 'Raport per Hrisen dje', 'Raport per dokumentet dje', 'Raport per naften dje', 'Raport per javen e kaluar', 'How many workers are working now?', 'Raport per druret dje'])('does not override a specific or unsupported question: %s', q => expect(resolveDailyReportIntent(messages(q))).toBeNull());
it('inherits only a user daily-report topic for a details follow-up', () => {
  expect(resolveDailyReportIntent([...messages(), { role: 'assistant', content: 'A previous answer is not evidence' }, { role: 'user', content: 'Me jep detaje' }])).toEqual({ details: true });
  expect(resolveDailyReportIntent([{ role: 'assistant', content: 'Raport dje' }, { role: 'user', content: 'Me jep detaje' }])).toBeNull();
});
it('replaces the screenshot error with the complete company total and steel processes, never a checker tree count', () => {
  const g = guard(); g.observe({ toolName: 'adminGetSteelDailyReport', status: 'ok', result: source() });
  const answer = g.transformAnswer('3 workers; 6.25 hours; 4 trees; 250kg total');
  expect(answer).toContain('23,5'); expect(answer).toContain('3'); expect(answer).toContain('Faza të shënuara përfunduar: 4'); expect(answer).toContain('≈ 50 kg'); expect(answer).toContain('100 kg');
  expect(answer).not.toMatch(/trees|drur|6[.,]25|250|\*\*/u); expect(g.diagnostics.canonicalDailyReportVerified).toBe(true);
});
it('fails closed after a missing, rejected, failed, narrowed or wrong-date source', () => {
  for (const result of [null, { ok: false }, { ...source(), date: '2026-11-12' }, { ...source(), worker: { id: 'worker-demo' } }, { ...source(), attendance: { ...source().attendance, totalHours: null } }]) {
    const g = guard(); g.observe({ toolName: 'adminGetSteelDailyReport', status: 'ok', result }); expect(g.transformAnswer('invented trees 999')).toContain('Nuk mund ta konfirmoj');
  }
  const g = guard(); g.observe({ toolName: 'adminGetTeamDailyReport', status: 'ok', result: source() }); expect(g.transformAnswer('old report')).toContain('Nuk mund ta konfirmoj');
});
it('never calls historical unclosed hours zero or a known total', () => {
  const r = source(); r.attendance.complete = false; r.attendance.openRows = 1; r.attendance.closedRows = 2; r.attendance.totalHours = null as unknown as number;
  const g = guard(); g.observe({ toolName: 'adminGetSteelDailyReport', status: 'ok', result: r }); expect(g.transformAnswer('0 hours')).toContain('pa mbyllje'); expect(g.transformAnswer('0 hours')).not.toContain('Gjithsej orë: 0');
});
it('keeps entirely missing weights unknown rather than showing 0kg', () => {
  const r = source(); r.production.processes[0].metric = { kg: 0, pieces: 5, checks: 1, legacyPieces: 0, missingPieces: 5 };
  const g = guard(); g.observe({ toolName: 'adminGetSteelDailyReport', status: 'ok', result: r }); const answer = g.transformAnswer('0kg'); expect(answer).toContain('peshë e panjohur për 5 copë'); expect(answer).not.toMatch(/\b0 kg\b/u);
});
it('does not transform unrelated answers', () => expect(guard('Cilat makina jane ne riparim?').transformAnswer('unchanged')).toBe('unchanged'));
it('refuses an impossible explicit date even if the tool returns today', () => {
  const m = messages('Raport per 30.02.2026');
  const g = createCanonicalDailyReportAnswer({ intent: resolveDailyReportIntent(m), language: 'SQ', turn: assistantTurnContext(m, { timeZone: 'Europe/Tirane', now: new Date('2026-11-13T08:00Z') }) });
  g.observe({ toolName: 'adminGetSteelDailyReport', status: 'ok', result: source() });
  expect(g.transformAnswer('today report')).toContain('Nuk mund ta konfirmoj');
});
