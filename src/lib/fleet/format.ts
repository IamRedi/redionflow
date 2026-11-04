/** Stable 24-hour clocks, including in browsers without Albanian Intl data. */
export function fleetTime(
  value: string,
  zone = 'Europe/Berlin',
  seconds = false,
) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}${seconds ? `:${get('second')}` : ''}`;
}
