import { createHash } from 'node:crypto';
import { z } from 'zod';

// Verified against WanWay's public IOP Swagger, 2026-11-03. Closed allowlist:
// even GET commands (including relay/engine stop) cannot reach this transport.
const paths = [
  '/api/auth',
  '/api/device',
  '/api/device/status',
  '/api/device/miles',
  '/api/device/track/history',
] as const;
type Path = (typeof paths)[number];
const base = 'https://open.iopgps.com';
const text = z.string().max(200);
const coordinate = z
  .union([z.string().min(1), z.number()])
  .transform(Number)
  .pipe(z.number().finite());
const timestamp = z
  .number()
  .int()
  .positive()
  .max(4102444800)
  .transform((s) => new Date(s * 1000));
const device = z.object({
  imei: z.string().regex(/^\d{8,20}$/),
  deviceName: text.optional(),
  deviceType: text.optional(),
});
const point = z.object({
  lat: coordinate.pipe(z.number().min(-90).max(90)).optional(),
  lng: coordinate.pipe(z.number().min(-180).max(180)).optional(),
  gpsTime: timestamp.optional(),
  speed: z.number().nonnegative().max(500).optional(),
});
const status = point.extend({
  imei: device.shape.imei,
  status: text.optional(),
  signalTime: timestamp.optional(),
  licenseNumber: text.optional(),
  extVoltage: z.number().nonnegative().max(10000).optional(),
});
export type Device = z.infer<typeof device>;
export type Status = z.infer<typeof status>;
export type TrackPoint = { lat: number; lng: number; recordedAt: string };

export class WanwayError extends Error {
  constructor(
    public readonly kind: 'HTTP' | 'PROVIDER' | 'TIMEOUT' | 'FORMAT' | 'LIMIT',
    public readonly code?: number,
    public readonly retryAt?: number,
  ) {
    // Never include request/response bodies, URLs, headers, account or IMEI.
    super(`WANWAY_${kind}${code === undefined ? '' : `_${code}`}`);
  }
}

export function signature(key: string, seconds: number) {
  const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
  return md5(md5(key) + seconds);
}

export class WanwayAdapter {
  private nextCall = 0;
  private deadline: number;
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly pause = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms)),
    budgetMs = 90_000,
  ) {
    this.deadline = Date.now() + Math.min(90_000, Math.max(1000, budgetMs));
  }
  private async request(
    path: Path,
    token?: string,
    params?: Record<string, string>,
    body?: unknown,
  ) {
    if (
      !paths.includes(path) ||
      (path === '/api/auth') !== (body !== undefined)
    )
      throw new WanwayError('FORMAT');
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() > this.deadline) throw new WanwayError('TIMEOUT');
      await this.pause(Math.max(0, this.nextCall - Date.now()));
      this.nextCall = Date.now() + 150; // < 10 functional requests/sec, sequential.
      let response: Response;
      try {
        const url = new URL(path, base);
        if (params) url.search = new URLSearchParams(params).toString();
        response = await this.fetcher(url, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { accessToken: token } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(
            Math.min(8000, Math.max(1, this.deadline - Date.now())),
          ),
          cache: 'no-store',
          redirect: 'error',
        });
      } catch {
        throw new WanwayError('TIMEOUT');
      }
      if (
        (response.status === 429 || response.status >= 500) &&
        path !== '/api/auth' &&
        attempt < 2
      ) {
        const retry = retryDelay(response.headers.get('retry-after'));
        await response.body?.cancel();
        // A long Retry-After is surfaced; never retry earlier than requested.
        if (retry > 10_000)
          throw new WanwayError('HTTP', response.status, Date.now() + retry);
        await this.pause(Math.max(500 * 2 ** attempt, retry));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        const retry = retryDelay(response.headers.get('retry-after'));
        throw new WanwayError(
          'HTTP',
          response.status,
          retry || response.status === 429
            ? Date.now() + Math.max(retry, response.status === 429 ? 60_000 : 0)
            : undefined,
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new WanwayError('FORMAT');
      let size = 0;
      const chunks: Uint8Array[] = [];
      for (;;) {
        const part = await reader.read().catch(() => {
          throw new WanwayError('TIMEOUT');
        });
        if (part.done) break;
        size += part.value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new WanwayError('LIMIT');
        }
        chunks.push(part.value);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new WanwayError('FORMAT');
      }
      const envelope = z.object({ code: z.number().int() }).safeParse(raw);
      if (!envelope.success) throw new WanwayError('FORMAT');
      if (envelope.data.code !== 0)
        throw new WanwayError('PROVIDER', envelope.data.code);
      return raw;
    }
    throw new WanwayError('LIMIT');
  }
  async authenticate(appid: string, key: string) {
    const time = Math.floor(Date.now() / 1000);
    const raw = await this.request('/api/auth', undefined, undefined, {
      appid,
      time,
      signature: signature(key, time),
    });
    const parsed = z
      .object({
        accessToken: z.string().min(1).max(4096),
        expiresIn: z.number().int().positive(),
      })
      .safeParse(raw);
    if (!parsed.success) throw new WanwayError('FORMAT');
    return {
      token: parsed.data.accessToken,
      expiresAt: new Date(
        Date.now() +
          Math.min(90 * 60_000, Math.max(0, parsed.data.expiresIn - 60_000)),
      ),
    };
  }
  async devices(token: string): Promise<Device[]> {
    const found = new Map<string, Device>();
    for (let currentPage = 1; currentPage <= 20; currentPage++) {
      const raw = await this.request('/api/device', token, {
        currentPage: String(currentPage),
        pageSize: '100',
      });
      const parsed = z
        .object({
          data: z.array(device).max(100),
          page: z.object({
            count: z.number().int().nonnegative(),
            currentPage: z.number().int().positive(),
            pageSize: z.number().int().positive(),
          }),
        })
        .safeParse(raw);
      if (!parsed.success || parsed.data.page.currentPage !== currentPage)
        throw new WanwayError('FORMAT');
      for (const d of parsed.data.data) {
        if (found.has(d.imei)) throw new WanwayError('FORMAT');
        found.set(d.imei, d);
      }
      if (found.size >= parsed.data.page.count) return [...found.values()];
      if (parsed.data.data.length === 0) throw new WanwayError('FORMAT');
    }
    throw new WanwayError('LIMIT');
  }
  async statuses(token: string, appid: string) {
    const raw = await this.request('/api/device/status', token, {
      account: appid,
    });
    const parsed = z.object({ data: z.array(status).max(2000) }).safeParse(raw);
    if (!parsed.success) throw new WanwayError('FORMAT');
    return parsed.data.data;
  }
  async mileage(token: string, imei: string) {
    // Documented as mileage statistics. Explicit 24h window; never label as odometer.
    const end = Math.floor(Date.now() / 1000) - 1;
    const raw = await this.request('/api/device/miles', token, {
      imei,
      startTime: String(end - 86400),
      endTime: String(end),
    });
    const parsed = z
      .object({ miles: z.number().nonnegative().optional() })
      .safeParse(raw);
    if (!parsed.success) throw new WanwayError('FORMAT');
    return parsed.data.miles ?? null;
  }
  async history(
    token: string,
    imei: string,
    window?: { start: Date; end: Date },
  ): Promise<TrackPoint[]> {
    const end = Math.floor((window?.end.getTime() ?? Date.now()) / 1000) - 1;
    const start = window
      ? Math.floor(window.start.getTime() / 1000)
      : end - 86400;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      end > Date.now() / 1000 ||
      end - start > 31 * 86400 ||
      start < Date.now() / 1000 - 270 * 86400
    )
      throw new WanwayError('FORMAT');
    const raw = await this.request('/api/device/track/history', token, {
      imei,
      startTime: String(start),
      endTime: String(end),
      coordType: 'wgs84',
      onlyGps: '1',
      ...(window ? { noFilter: '1' } : {}),
    });
    const parsed = z.object({ data: z.array(point).max(10000) }).safeParse(raw);
    if (!parsed.success) throw new WanwayError('FORMAT');
    return parsed.data.data
      .filter(
        (p) =>
          p.lat !== undefined &&
          p.lng !== undefined &&
          p.gpsTime &&
          p.gpsTime.getTime() <= Date.now() + 60_000 &&
          (!window ||
            (p.gpsTime.getTime() >= start * 1000 &&
              p.gpsTime.getTime() <= end * 1000)),
      )
      .map((p) => ({
        lat: p.lat!,
        lng: p.lng!,
        recordedAt: p.gpsTime!.toISOString(),
      }));
  }
}

function retryDelay(raw: string | null) {
  if (!raw) return 0;
  const seconds = Number(raw);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(raw) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, Math.min(ms, 24 * 3600_000)) : 0;
}

export function telemetry(s: Status) {
  const validTime = (d?: Date) =>
    d && d.getTime() <= Date.now() + 60_000 ? d : null;
  return {
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    reportedAt: validTime(s.gpsTime),
    signalAt: validTime(s.signalTime),
    providerStatus: s.status ?? 'unknown',
    speedKmh: s.speed ?? null,
    voltage: s.extVoltage === undefined ? null : s.extVoltage / 10,
    plate: s.licenseNumber ?? null,
  };
}

export function freshness(
  status: string | null,
  reportedAt: Date | null,
  syncedAt: Date | null,
  now = Date.now(),
) {
  const stale =
    !reportedAt ||
    now - reportedAt.getTime() > 15 * 60_000 ||
    !syncedAt ||
    now - syncedAt.getTime() > 15 * 60_000;
  const online =
    ['stationary', 'driving'].includes((status ?? '').toLowerCase()) && !stale;
  return { stale, online };
}
