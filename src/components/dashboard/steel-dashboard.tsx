'use client';
import Link from 'next/link';
import { useEffect, useId, useState, useTransition, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Copy, Factory, Info, Maximize2, Monitor, RefreshCw, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import type { SteelDashboardData } from '@/lib/dashboard/steel-data';
import { SERIES, shiftMonth, type Metric, type Series } from '@/lib/dashboard/steel-metrics';
import { steelCopy } from '@/lib/dashboard/steel-copy';
import { t } from '@/lib/i18n';
import { reportLocale } from '@/lib/workzone/date-utils';
import { productionDate, productionNumber } from '@/lib/dashboard/steel-format';
import styles from './steel-dashboard.module.css';
const kgUnit = 'kg';
const section = (n: number) => `${String(n).padStart(2, '0')} /`;
const colors: Record<Series, string> = { cutParts: 'var(--cut-parts)', cutAssemblies: 'var(--cut-assemblies)', assembled: 'var(--assembled)' };
export function SteelDashboard({ data: d, lang }: {
    data: SteelDashboardData;
    lang: string;
}) {
    const c = steelCopy(lang), locale = reportLocale(lang), router = useRouter(), path = usePathname();
    const [pending, start] = useTransition(), [copied, setCopied] = useState(false), [notice, setNotice] = useState('');
    const [visible, setVisible] = useState<Series[]>([...SERIES]);
    const graphId = useId();
    const n = (value: number, digits = 2) => productionNumber(value, lang, digits);
    const calendarN = (value: number) => value >= 10000 ? `${n(value / 1000, 1)}k` : n(value, value < 10 ? 1 : 0);
    const metricText = (m: Metric) => m.pieces > 0 && m.missingPieces === m.pieces ? '—' : `${m.legacyPieces ? '≈ ' : ''}${n(m.kg)}`;
    const date = (key: string, opts?: Intl.DateTimeFormatOptions) => productionDate(key, lang, opts);
    const clock = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: d.zone }).format(new Date(iso));
    function href(overrides: Record<string, string | null> = {}, monitor = false) {
        const p = new URLSearchParams({ month: d.month, day: d.day });
        if (d.selectedProject)
            p.set('project', d.selectedProject);
        for (const [k, v] of Object.entries(overrides)) {
            if (v)
                p.set(k, v);
            else
                p.delete(k);
        }
        if (monitor && d.month === d.today.slice(0, 7) && d.day === d.today) {
            p.delete('month');
            p.delete('day');
        }
        return `${monitor ? '/display/dashboard' : path}?${p}`;
    }
    function move(overrides: Record<string, string | null>) { start(() => router.push(href({ cursor: null, ...overrides }), { scroll: false })); }
    useEffect(() => {
        if (!d.readOnly)
            return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                start(() => router.refresh());
        }, 60000);
        return () => window.clearInterval(timer);
    }, [d.readOnly, router]);
    const selected = d.days.find(day => day.key === d.day)!;
    const totalChecks = d.days.reduce((a, b) => a + b.checks, 0), activeDays = d.days.filter(day => day.checks > 0).length;
    const missing = SERIES.reduce((a, s) => a + d.totals[s].missingPieces, 0), legacy = SERIES.reduce((a, s) => a + d.totals[s].legacyPieces, 0);
    const offset = (new Date(`${d.month}-01T12:00Z`).getUTCDay() + 6) % 7;
    const readyPct = d.totalProgress.totalPieces ? Math.round(100 * d.totalProgress.readyPieces / d.totalProgress.totalPieces) : 0;
    const stageName = (stage: string) => t(`${['received', 'mounted', 'bolted', 'touchup'].includes(stage) ? 'elements.fieldStages' : 'factory.steps'}.${stage}`, lang);
    const badge = (m: Metric) => <span className={styles.micro}>{n(m.pieces, 0)} {c.pieces}{m.missingPieces > 0 ? ` · ${n(m.missingPieces, 0)} ${c.missing}` : ''}</span>;
    const trendDays = d.days.filter(day => day.key <= d.today), max = Math.max(1, ...trendDays.flatMap(day => visible.map(s => day.metrics[s].kg)));
    const x = (i: number) => 50 + i / Math.max(1, trendDays.length - 1) * 650;
    const y = (value: number) => 205 - value / max * 165;
    const projectsSection = (<section className={styles.projectsSection} aria-labelledby="production-projects-title"><div className={styles.sectionHead}><div><span className={styles.sectionIndex}>{section(3)} {c.project}</span><h2 id="production-projects-title">{c.projects}</h2><p>{c.projectsHint}</p></div><span>{d.projectRows.length.toString().padStart(2, '0')}</span></div>
        <div className={styles.projectGrid}>{d.projectRows.map(p => {
            const pct = p.progress.totalPieces ? Math.round(100 * p.progress.readyPieces / p.progress.totalPieces) : 0;
            return <article key={p.id} className={styles.projectCard} data-testid={`production-project-${p.id}`}>
            <div className={styles.projectTop}><div><span className={styles.projectOverline}>{c.project}</span><h3>{p.name}</h3><span className={styles.micro}>{n(p.progress.kg)} {kgUnit} · {n(p.progress.totalPieces, 0)} {c.pieces} · {c.planned}</span></div><div className={styles.ring} role="img" aria-label={`${pct}% ${c.percentHint}`} style={{ background: `conic-gradient(var(--green) ${pct}%, var(--track) 0)` }}><span>{pct}<small>%</small></span></div></div>
            <div className={styles.projectSummary}><span>{c.completed}<strong>{n(p.progress.readyKg)} {kgUnit}</strong></span><span>{c.mounted}<strong>{n(p.progress.mountedKg)} {kgUnit}</strong></span></div>
            <div className={styles.stageGroup} data-side="factory"><span>{c.factory}</span><div>{['cutting', 'assembly', 'welding', 'cleaning', 'coating', 'loading'].map(key => <div key={key} className={styles.stage}><span>{stageName(key)}</span><strong>{n(p.progress.stages[key].kg)}<small>{` ${kgUnit}`}</small></strong><div><i style={{ width: `${p.progress.totalPieces ? p.progress.stages[key].pieces / p.progress.totalPieces * 100 : 0}%` }}/></div><small>{n(p.progress.stages[key].pieces, 0)} {c.pieces}</small></div>)}</div></div>
            <div className={styles.stageGroup}><span>{c.field}</span><div>{['received', 'mounted', 'bolted', 'touchup'].map(key => <div key={key} className={styles.stage}><span>{stageName(key)}</span><strong>{n(p.progress.stages[key].kg)}<small>{` ${kgUnit}`}</small></strong><div><i style={{ width: `${p.progress.totalPieces ? p.progress.stages[key].pieces / p.progress.totalPieces * 100 : 0}%` }}/></div><small>{n(p.progress.stages[key].pieces, 0)} {c.pieces}</small></div>)}</div></div>
            {p.progress.missingPieces > 0 && <p className={styles.qualityInline}>{n(p.progress.missingPieces, 0)} {c.missing}</p>}
            {!d.readOnly && <Link className={styles.projectLink} href={`/workzone/baustellen/${p.id}`}>{c.openList}<ArrowUpRight size={14}/></Link>}
          </article>;
        })}</div>
        {d.projectRows.length === 0 && <div className={styles.emptyState}><Factory size={30}/><h3>{c.noProjects}</h3><p>{c.emptyHint}</p></div>}
      </section>);
    return (<div className={`${styles.root} ${d.readOnly ? styles.monitor : ''}`} aria-busy={pending} data-testid="steel-dashboard">
      <header className={styles.hero}>
        <div><div className={styles.eyebrow}><span className={styles.liveDot}/>{c.eyebrow}<span className={styles.company}>{d.companyName}</span></div>
          <h1>{c.title}</h1><p>{c.subtitle}</p>
        </div>
        <div className={styles.actions}>
          <span className={styles.updated}><ShieldCheck size={13}/>{d.readOnly ? c.readOnly : c.refreshed} · <time dateTime={d.generatedAt}>{clock(d.generatedAt)}</time></span>
          <div className={styles.actionRow}>
            <button type="button" className={styles.iconButton} disabled={pending} aria-label={c.refresh} title={c.refresh} onClick={() => start(() => router.refresh())}><RefreshCw size={16} className={pending ? 'animate-spin' : ''}/></button>
            {d.readOnly ? <button type="button" className={styles.iconButton} aria-label={c.fullScreen} title={c.fullScreen} onClick={async () => {
                try {
                    if (document.fullscreenElement)
                        await document.exitFullscreen();
                    else
                        await document.documentElement.requestFullscreen();
                }
                catch {
                    setNotice(c.fullScreen);
                }
            }}><Maximize2 size={16}/></button> : <>
              <Link className={styles.primaryButton} href={href({}, true)} target="_blank" rel="noopener noreferrer"><Monitor size={15}/>{c.monitor}<ArrowUpRight size={14}/></Link>
              <button type="button" className={styles.iconButton} aria-label={copied ? c.copied : c.copyLink} title={copied ? c.copied : c.copyLink} onClick={async () => {
                const url = new URL(href({}, true), window.location.origin).href;
                try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setNotice(c.copied);
                }
                catch {
                    setNotice(url);
                }
            }}><Copy size={15}/></button>
            </>}
          </div>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterFields}>
          <label><CalendarDays size={15}/><span className="sr-only">{c.month}</span><input aria-label={c.month} type="month" value={d.month} min="2000-01" max={d.today.slice(0, 7)} onChange={e => e.target.value && move({ month: e.target.value, day: `${e.target.value}-01` })}/></label>
          <label><Factory size={15}/><span className="sr-only">{c.project}</span><select aria-label={c.project} value={d.selectedProject} onChange={e => move({ project: e.target.value || null })}><option value="">{c.all}</option>{d.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        </div>
        <div className={styles.filterMeta}><span>{n(totalChecks, 0)} {c.checks}</span><span className={styles.dot}>·</span><span>{activeDays} {c.activeDays}</span><span className={styles.zone}>{d.zone}</span></div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">{pending ? c.loading : notice}</div>
      {notice && <p className={styles.notice}>{notice}</p>}

      <section className={styles.kpis} aria-label={c.month}>
        {SERIES.map((s, i) => <article className={styles.kpi} key={s} style={{ '--accent': colors[s] } as CSSProperties}>
          <div className={styles.kpiTop}><span>{c[s]}</span>{i < 2 ? <Scissors size={17}/> : <CheckCheck size={18}/>}</div>
          <div className={styles.kpiNumber} data-testid={`metric-${s}`}>{metricText(d.totals[s])}<small>{kgUnit}</small></div>
          {badge(d.totals[s])}<div className={styles.spark} aria-hidden="true">{d.days.map(day => <i key={day.key} style={{ height: `${Math.max(3, day.metrics[s].kg / Math.max(1, ...d.days.map(x => x.metrics[s].kg)) * 30)}px` }}/>)}</div>
        </article>)}
        <article className={`${styles.kpi} ${styles.readyKpi}`}><div className={styles.kpiTop}><span>{c.ready}</span><Factory size={17}/></div><div className={styles.kpiNumber}>{n(d.totalProgress.readyKg)}<small>{kgUnit}</small></div><span className={styles.micro}>{n(d.totalProgress.readyPieces, 0)} / {n(d.totalProgress.totalPieces, 0)} {c.pieces} · {c.knowledge}</span><div className={styles.progressTrack}><span style={{ width: `${readyPct}%` }}/></div><div className={styles.readyFoot}>{readyPct}% · {c.percentHint}</div></article>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.panel} aria-labelledby="production-calendar-title">
          <div className={styles.panelHead}><div><span className={styles.sectionIndex}>{section(1)} {c.month}</span><h2 id="production-calendar-title">{c.calendar}</h2><p>{c.calendarHint}</p></div><CalendarDays className={styles.panelIcon} size={22}/></div>
          <div className={styles.calendarNav}><strong>{date(`${d.month}-01`, { month: 'long', year: 'numeric' })}</strong><div>
            <button className={styles.iconButton} type="button" aria-label={date(`${shiftMonth(d.month, -1)}-01`, { month: 'long', year: 'numeric' })} onClick={() => move({ month: shiftMonth(d.month, -1), day: `${shiftMonth(d.month, -1)}-01` })}><ChevronLeft size={17}/></button>
            <button type="button" className={styles.textButton} onClick={() => move({ month: d.readOnly ? null : d.today.slice(0, 7), day: d.readOnly ? null : d.today })}>{c.today}</button>
            <button className={styles.iconButton} type="button" disabled={shiftMonth(d.month, 1) > d.today.slice(0, 7)} aria-label={date(`${shiftMonth(d.month, 1)}-01`, { month: 'long', year: 'numeric' })} onClick={() => move({ month: shiftMonth(d.month, 1), day: `${shiftMonth(d.month, 1)}-01` })}><ChevronRight size={17}/></button>
          </div></div>
          <div className={styles.legend} aria-label={c.legend}>{SERIES.map(s => <span key={s}><i style={{ background: colors[s] }}/>{c[s]}</span>)}<small>{kgUnit}</small></div>
          <div className={styles.calendar}>
            {Array.from({ length: 7 }, (_, i) => <span key={`weekday-${i}`} className={styles.weekday}>{date(`2026-11-${String(2 + i).padStart(2, '0')}`, { weekday: 'short' })}</span>)}
            {Array.from({ length: offset }, (_, i) => <div key={`blank-${i}`} className={styles.blankDay} aria-hidden="true"/>)}
            {d.days.map(day => <button key={day.key} data-testid={`production-day-${day.key}`} type="button" className={`${styles.day} ${day.key === d.day ? styles.selectedDay : ''} ${day.key === d.today ? styles.today : ''}`} aria-pressed={day.key === d.day} aria-label={`${date(day.key)}; ${SERIES.map(s => `${c[s]}: ${metricText(day.metrics[s])} kg; ${day.metrics[s].missingPieces} ${c.missing}`).join('; ')}; ${day.checks} ${c.checks}`} disabled={day.key > d.today} onClick={() => move({ day: day.key })}>
              <span className={styles.dayNumber}>{Number(day.key.slice(-2))}{day.checks > 0 && <i className={styles.activityDot}/>}</span>
              <span className={styles.dayValues}>{SERIES.map(s => <span key={s} style={{ color: colors[s] }}>{day.metrics[s].pieces > 0 ? <><i style={{ background: colors[s] }}/>{day.metrics[s].missingPieces === day.metrics[s].pieces ? '—' : `${day.metrics[s].legacyPieces ? '≈' : ''}${calendarN(day.metrics[s].kg)}`}</> : <span className={styles.zero}>·</span>}</span>)}</span>
            </button>)}
          </div>
          <p className={styles.calendarFooter}><Info size={13}/>{c.basis}</p>
        </section>

        <div className={styles.sideStack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><span className={styles.sectionIndex}>{section(2)} {kgUnit}</span><h2>{c.trend}</h2><p>{c.trendHint}</p></div><Sparkles className={styles.panelIcon} size={21}/></div>
            <div className={styles.chartLegend}>{SERIES.map(s => <button key={s} type="button" aria-pressed={visible.includes(s)} style={{ '--accent': colors[s] } as CSSProperties} onClick={() => setVisible(v => v.includes(s) ? v.length > 1 ? v.filter(k => k !== s) : v : [...v, s])}><i style={{ background: colors[s] }}/>{c[s]}</button>)}</div>
            <svg className={styles.chart} viewBox="0 0 730 245" role="img" aria-labelledby={`${graphId}-title ${graphId}-desc`}>
              <title id={`${graphId}-title`}>{c.trend}</title><desc id={`${graphId}-desc`}>{c.trendHint}. {SERIES.map(s => `${c[s]}: ${metricText(d.totals[s])} kg`).join('; ')}. {c.knowledge}.</desc>
              {[0, 1, 2, 3].map(i => <g key={i}><line x1="50" x2="700" y1={y(max * i / 3)} y2={y(max * i / 3)} stroke="var(--chart-grid)"/><text x="39" y={y(max * i / 3) + 4} textAnchor="end" fill="var(--chart-label)" fontSize="11">{calendarN(max * i / 3)}</text></g>)}
              {trendDays.length > 0 && visible.map(s => <path key={s} d={trendDays.map((day, i) => `${i ? 'L' : 'M'}${x(i)},${y(day.metrics[s].kg)}`).join(' ')} fill="none" stroke={colors[s]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}
              {trendDays.filter((_, i) => i % 7 === 0 || i === trendDays.length - 1).map(day => <text key={day.key} x={x(trendDays.indexOf(day))} y="233" fill="var(--chart-label)" fontSize="12" textAnchor="middle">{Number(day.key.slice(-2))}</text>)}
            </svg>
          </section>
          <section className={styles.dayPanel} aria-labelledby="production-selected-day">
            <div className={styles.dayHeading}><span className={styles.selectedLabel}>{c.selection}</span><span>{selected.checks} {c.checks}</span></div><h2 id="production-selected-day">{date(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <div className={styles.dayMetrics}>{SERIES.map(s => <div key={s}><span style={{ color: colors[s] }}>{c[s]}</span><strong>{metricText(selected.metrics[s])}<small>{` ${kgUnit}`}</small></strong>{badge(selected.metrics[s])}</div>)}</div>
            <h3 className={styles.smallHeading}>{c.byProject}</h3>
            <div className={styles.dayProjects} data-testid="production-day-projects">{d.dayProjects.filter(p => p.checks > 0).map(p => <div key={p.id}><strong>{p.name}</strong><span>{SERIES.map(s => <span key={s} style={{ color: colors[s] }}>{metricText(p.metrics[s])}<small>{` ${kgUnit}`}</small></span>)}</span>{p.operations.length > 0 && <span className={styles.otherOperations}>{p.operations.map(op => <span key={op.stage}>{stageName(op.stage)}: {metricText(op.metric)} {kgUnit} · {op.metric.pieces} {c.pieces}</span>)}</span>}</div>)}{d.dayChecks === 0 && <p className={styles.empty}>{c.noActivity}</p>}</div>
          </section>
          {d.readOnly && projectsSection}
        </div>
      </div>

      {!d.readOnly && projectsSection}

      {!d.readOnly && <section className={styles.panel} aria-labelledby="production-evidence-title"><div className={styles.panelHead}><div><span className={styles.sectionIndex}>{section(4)} {c.checks}</span><h2 id="production-evidence-title">{c.evidence}</h2><p>{c.evidenceHint} · {date(d.day)} · {d.zone}</p></div><ClipboardCheck size={23} className={styles.panelIcon}/></div>
        <details className={styles.evidenceDisclosure}><summary data-testid="production-evidence-toggle"><ClipboardCheck size={16}/><span>{d.dayChecks} {c.checks}</span><ChevronRight size={16}/></summary>
        <div className={styles.evidenceList}>{d.evidence.map(e => <article key={e.id} className={styles.evidenceRow}><div className={styles.mark}><span>{e.mark}</span><small>{e.list === 'part' ? 'Lista parti' : 'Lista assemblaggi'}</small></div><div className={styles.evidenceMain}><strong>{d.projects.find(p => p.id === e.projectId)?.name}</strong><span>{stageName(e.stage)} · {n(e.pieces, 0)} {c.pieces} × {e.unitWeightKg === null ? '—' : n(e.unitWeightKg)} {kgUnit}</span><small>{c.workers}: {e.workerNames || '—'}</small><small>{c.confirmedBy}: {e.checkedByName} · <time dateTime={e.checkedAt}>{clock(e.checkedAt)}</time></small></div><div className={styles.evidenceWeight}><strong>{e.kg === null ? '—' : `${e.legacy ? '≈ ' : ''}${n(e.kg)}`}<small>{` ${kgUnit}`}</small></strong><span className={e.legacy ? styles.legacyTag : styles.originalTag}>{e.kg === null ? c.noWeight : e.legacy ? c.legacy : c.original}</span></div></article>)}</div>
        {d.evidence.length === 0 && <p className={styles.empty}>{c.noActivity}</p>}
        <div className={styles.evidencePagination}>{d.nextCursor && <Link href={href({ cursor: d.nextCursor })}>{c.more}<ChevronRight size={14}/></Link>}{d.evidence.length > 0 && <Link href={href({ cursor: null })}>{c.first}</Link>}</div>
        </details>
        <p className={styles.evidenceBasis}><Info size={15}/>{c.evidenceBasis}</p>
      </section>}

      <footer className={styles.quality}><ShieldCheck size={18}/><div><strong>{c.quality}</strong><p>{c.basis}</p>{(missing > 0 || legacy > 0) && <p className={styles.qualityInline}>{missing > 0 ? `${c.noWeight}. ` : ''}{legacy > 0 ? c.legacy : ''}</p>}<p>{d.readOnly ? `${c.evidenceBasis} ${c.monitorHint}` : c.monitorHint}</p></div></footer>
    </div>);
}
