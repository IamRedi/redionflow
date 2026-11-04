/** Deterministic office formats: identical in server/monitor runtimes and all six languages. */
const months = {
    sq: 'janar|shkurt|mars|prill|maj|qershor|korrik|gusht|shtator|tetor|nëntor|dhjetor',
    en: 'January|February|March|April|May|June|July|August|September|October|November|December',
    de: 'Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember',
    it: 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre',
    pl: 'stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia',
    ro: 'ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie',
};
const weekdays = {
    sq: 'e diel|e hënë|e martë|e mërkurë|e enjte|e premte|e shtunë',
    en: 'Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday',
    de: 'Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag',
    it: 'domenica|lunedì|martedì|mercoledì|giovedì|venerdì|sabato',
    pl: 'niedziela|poniedziałek|wtorek|środa|czwartek|piątek|sobota',
    ro: 'duminică|luni|marți|miercuri|joi|vineri|sâmbătă',
};
const shortDays = { sq: 'Die|Hën|Mar|Mër|Enj|Pre|Sht', en: 'Sun|Mon|Tue|Wed|Thu|Fri|Sat', de: 'So|Mo|Di|Mi|Do|Fr|Sa', it: 'dom|lun|mar|mer|gio|ven|sab', pl: 'ndz|pon|wt|śr|czw|pt|sob', ro: 'dum|lun|mar|mie|joi|vin|sâm' };
export function productionDate(key: string, lang: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
    const l = lang in months ? lang as keyof typeof months : 'en', [year, month, day] = key.split('-').map(Number), weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (opts.weekday === 'short')
        return shortDays[l].split('|')[weekday];
    const text = `${opts.day ? `${day} ` : ''}${months[l].split('|')[month - 1]}${opts.year ? ` ${year}` : ''}`;
    return opts.weekday ? `${weekdays[l].split('|')[weekday]}, ${text}` : text;
}
export function productionNumber(value: number, lang: string, digits = 2) {
    if (!Number.isFinite(value))
        return '—';
    const [integer, raw = ''] = value.toFixed(digits).split('.'), decimals = raw.replace(/0+$/, '');
    const separator = lang === 'en' ? ',' : lang === 'pl' || lang === 'ro' ? '\u202f' : '.';
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator) + (decimals ? `${lang === 'en' ? '.' : ','}${decimals}` : '');
}
