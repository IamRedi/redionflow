/** Invoice clocks use the company's timezone, never the browser/server timezone. */
export const fuelTimeZone = (country: string) =>
  country === 'AL' ? 'Europe/Tirane' : 'Europe/Berlin';

export function localClock(date: Date, zone: string, seconds = false) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (key: string) => p.find((part) => part.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}${seconds ? `:${get('second')}` : ''}`;
}

export function parseFuelClock(
  clock: string,
  zone: string,
  now = new Date(),
  utcOffset?: number | null,
) {
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(clock)) return null;
  const seconds = clock.length === 19;
  const base = Date.parse(`${clock}${seconds ? '' : ':00'}Z`);
  if (!Number.isFinite(base)) return null;
  // Europe/Berlin and Europe/Tirane are UTC+1/+2. Reject gaps and ambiguous
  // autumn clocks rather than silently choosing a different fueling instant.
  const offsets = utcOffset === 1 || utcOffset === 2 ? [utcOffset] : [1, 2];
  const candidates = offsets
    .map((offset) => new Date(base - offset * 3600_000))
    .filter((date) => localClock(date, zone, seconds) === clock);
  if (candidates.length !== 1) return null;
  const date = candidates[0];
  if (
    date.getTime() > now.getTime() + 60_000 ||
    date.getTime() < now.getTime() - 270 * 86400_000
  )
    return null;
  return date;
}

export function receiptClock(text: string, zone: string, now = new Date()) {
  const clocks = new Set<string>();
  const pattern =
    /\b(?:(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}))[\sT,;]*(?:Ora|Time|Uhrzeit|Heure|Orario)?\s*[:=]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\b/gi;
  for (const m of text.slice(0, 50_000).matchAll(pattern)) {
    const pad = (s: string) => s.padStart(2, '0');
    const value = `${m[1] || m[6]}-${pad(m[2] || m[5])}-${pad(m[3] || m[4])}T${pad(m[7])}:${m[8]}${m[9] ? `:${m[9]}` : ''}`;
    if (parseFuelClock(value, zone, now)) clocks.add(value);
  }
  return clocks.size === 1 ? [...clocks][0] : null;
}
