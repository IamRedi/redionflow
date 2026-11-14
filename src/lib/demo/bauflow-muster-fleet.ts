import { bauflowMusterConfigured, bauflowMusterPublicDemoConfigured } from './bauflow-muster';

/** Static fictional catalogue, never a lookup by a real customer's vehicle name. */
export const BAUFLOW_MUSTER_FLEET = [
  { key: 'montage-transporter', name: 'Montage-Transporter', category: 'TRUCK', plate: 'MU BF 101', hourlyRateCents: 3500 },
  { key: 'lkw-75t', name: 'LKW 7,5 t', category: 'TRUCK', plate: 'MU BF 102', hourlyRateCents: 4000 },
  { key: 'teleskopstapler', name: 'Teleskopstapler', category: 'OTHER', plate: null, hourlyRateCents: 4500 },
  { key: 'scherenbuehne', name: 'Scherenbühne 12 m', category: 'AWP', plate: null, hourlyRateCents: 5000 },
  { key: 'kran-lkw', name: 'Kran-LKW', category: 'TRUCK', plate: 'MU BF 103', hourlyRateCents: 6500 },
  { key: 'bauleiter-kombi', name: 'Bauleiter-Kombi', category: 'OTHER', plate: 'MU BF 104', hourlyRateCents: 2200 },
] as const;

export const musterFleetPhoto = (key: string) => `/bauflow-muster-v1/fleet/${key}.webp`;

/** Additive maintenance must explicitly identify the sole allowed live target. */
export function assertMusterFleetTarget(env: Readonly<Record<string, string | undefined>>) {
  if (!bauflowMusterConfigured(env) || env.BAUFLOW_MUSTER_FLEET_APPLY !== 'true') {
    throw new Error('Explicit Muster fleet maintenance approval required.');
  }
  if (env.APP_ENV === 'local') return 'local'; // Caller must also enforce assertE2ETestDatabase.
  let url: URL;
  try { url = new URL(env.DATABASE_URL ?? ''); } catch { throw new Error('Wrong Muster fleet database.'); }
  const options = [...url.searchParams];
  if (!bauflowMusterPublicDemoConfigured(env)
    || env.APP_BASE_URL !== 'https://bauflow-production-1344.up.railway.app'
    || env.APP_DOMAIN !== 'bauflow-production-1344.up.railway.app'
    || !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== 'postgres-d1t9.railway.internal'
    || url.pathname !== '/bauflow_muster' || url.username !== 'bauflow_muster'
    || !['', '5432'].includes(url.port) || url.hash
    || options.some(([key, value]) => !(key === 'schema' && value === 'public'))
  ) throw new Error('Wrong Muster fleet database.');
  return 'demo';
}
