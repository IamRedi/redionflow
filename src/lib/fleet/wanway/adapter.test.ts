import { describe, expect, it, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { WanwayAdapter, freshness, signature, telemetry } from './adapter';

const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
afterEach(() => vi.useRealTimers());

describe('WanWay read-only transport', () => {
  it('signs UTF-8 with the official nested lowercase MD5 formula', () => {
    const md5 = (s: string) => createHash('md5').update(s).digest('hex');
    expect(signature('synthetic-only-key', 1793690000)).toBe(
      md5(md5('synthetic-only-key') + '1793690000'),
    );
  });
  it('authenticates in the POST body and caps the cached token to 90min', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T15:00:00Z'));
    const f = vi.fn<typeof fetch>(async () =>
      response({ code: 0, accessToken: 'synthetic-token', expiresIn: 7200000 }),
    );
    const before = Date.now();
    const result = await new WanwayAdapter(f, async () => {}).authenticate(
      'synthetic-app',
      'synthetic-key',
    );
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://open.iopgps.com/api/auth');
    expect(init?.method).toBe('POST');
    expect(String(url)).not.toContain('synthetic');
    expect(init?.body).not.toContain('synthetic-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      appid: 'synthetic-app',
    });
    expect(result.expiresAt.getTime() - before).toBeLessThanOrEqual(5400100);
  });
  it('uses accessToken only in headers, follows every device page and strips SIM', async () => {
    const f = vi.fn<typeof fetch>(async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('currentPage'));
      return response({
        code: 0,
        data: [
          {
            imei: `00000000000000${page}`,
            mobile: 'private-sim',
            deviceName: 'Synthetic GPS',
          },
        ],
        page: { currentPage: page, count: 2, pageSize: 100 },
      });
    });
    const devices = await new WanwayAdapter(f, async () => {}).devices(
      'synthetic-token',
    );
    expect(devices).toHaveLength(2);
    expect(JSON.stringify(devices)).not.toContain('private-sim');
    for (const [url, init] of f.mock.calls) {
      expect(String(url)).not.toContain('synthetic-token');
      expect(new Headers(init?.headers).get('accessToken')).toBe(
        'synthetic-token',
      );
      expect(init?.redirect).toBe('error');
      expect(init?.cache).toBe('no-store');
      expect(init?.method).toBe('GET');
    }
  });
  it('rejects repeated pages, malformed data and incomplete pagination', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      response({
        code: 0,
        data: [],
        page: { count: 10, currentPage: 1, pageSize: 100 },
      }),
    );
    await expect(
      new WanwayAdapter(f, async () => {}).devices('t'),
    ).rejects.toThrow('WANWAY_FORMAT');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('bounds pagination and never commits a truncated discovery', async () => {
    let page = 0;
    const f = vi.fn<typeof fetch>(async () => {
      page++;
      return response({
        code: 0,
        data: [{ imei: String(100000000000000 + page) }],
        page: { count: 99999, currentPage: page, pageSize: 100 },
      });
    });
    await expect(
      new WanwayAdapter(f, async () => {}).devices('t'),
    ).rejects.toThrow('WANWAY_LIMIT');
    expect(f).toHaveBeenCalledTimes(20);
  });
  it('returns the real numeric provider error without echoing private response text', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      response({ code: 987, result: 'secret-key=must-never-echo' }),
    );
    await expect(
      new WanwayAdapter(f, async () => {}).devices('t'),
    ).rejects.toThrow(/^WANWAY_PROVIDER_987$/);
  });
  it('does not retry authentication, including HTTP 429', async () => {
    const f = vi.fn<typeof fetch>(async () => response({}, 429));
    await expect(
      new WanwayAdapter(f, async () => {}).authenticate('app', 'key'),
    ).rejects.toThrow('WANWAY_HTTP_429');
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('backs off for functional requests but respects long Retry-After without retrying', async () => {
    const pause = vi.fn<(ms: number) => Promise<void>>(async () => {});
    let calls = 0;
    const f = vi.fn<typeof fetch>(async () =>
      ++calls === 1 ? response({}, 503) : response({ code: 0, data: [] }),
    );
    await new WanwayAdapter(f, pause).statuses('t', 'app');
    expect(f).toHaveBeenCalledTimes(2);
    expect(pause.mock.calls.some((c) => Number(c[0]) >= 500)).toBe(true);
    const limited = vi.fn<typeof fetch>(async () =>
      response({}, 429, { 'retry-after': '60' }),
    );
    await expect(
      new WanwayAdapter(limited, pause).statuses('t', 'app'),
    ).rejects.toThrow('WANWAY_HTTP_429');
    expect(limited).toHaveBeenCalledTimes(1);
  });
  it('sanitizes timeouts, invalid JSON, oversized bodies and invalid coordinates', async () => {
    for (const f of [
      async () => {
        throw new Error('private request URL');
      },
      async () => new Response('bad-json'),
      async () => new Response('a'.repeat(2000001)),
      async () =>
        response({
          code: 0,
          data: [{ imei: '000000000000001', lat: '999', lng: '1' }],
        }),
    ]) {
      await expect(
        new WanwayAdapter(f as typeof fetch, async () => {}).statuses(
          't',
          'app',
        ),
      ).rejects.toThrow(/^WANWAY_(TIMEOUT|FORMAT|LIMIT)$/);
    }
  });
  it('converts seconds to UTC and tenths of volts; omitted values stay null', () => {
    const d = new Date(1793690000000);
    expect(
      telemetry({ imei: '000000000000001', gpsTime: d, extVoltage: 124 }),
    ).toMatchObject({
      reportedAt: d,
      voltage: 12.4,
      speedKmh: null,
      lat: null,
    });
    expect(
      telemetry({
        imei: '000000000000001',
        gpsTime: new Date(Date.now() + 3600000),
      }).reportedAt,
    ).toBeNull();
  });
  it('never presents offline, unknown or stale positions as online', () => {
    const now = Date.now();
    const fresh = new Date(now - 60000);
    const old = new Date(now - 3600000);
    expect(freshness('driving', fresh, fresh, now)).toEqual({
      online: true,
      stale: false,
    });
    for (const state of ['offline', 'sleeping', 'not enabled', 'unknown'])
      expect(freshness(state, fresh, fresh, now).online).toBe(false);
    expect(freshness('driving', fresh, old, now)).toEqual({
      online: false,
      stale: true,
    });
    expect(freshness('stationary', old, fresh, now).online).toBe(false);
  });
  it('requests bounded read-only history and labels mileage as interval statistics', async () => {
    const f = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('/miles')
        ? response({ code: 0, miles: 12.5 })
        : response({
            code: 0,
            data: [{ lat: '41', lng: '19', gpsTime: 1793690000 }],
          }),
    );
    const api = new WanwayAdapter(f, async () => {});
    expect(await api.mileage('t', '000000000000001')).toBe(12.5);
    expect(await api.history('t', '000000000000001')).toEqual([
      { lat: 41, lng: 19, recordedAt: new Date(1793690000000).toISOString() },
    ]);
    for (const [url] of f.mock.calls) {
      const u = new URL(String(url));
      expect(
        Number(u.searchParams.get('endTime')) -
          Number(u.searchParams.get('startTime')),
      ).toBe(86400);
    }
  });
});

it('respects HTTP-date Retry-After without retrying early', async () => {
  const f = vi.fn<typeof fetch>(async () =>
    response({}, 429, {
      'retry-after': new Date(Date.now() + 120000).toUTCString(),
    }),
  );
  try {
    await new WanwayAdapter(f, async () => {}).statuses('t', 'app');
    throw new Error('expected rejection');
  } catch (e) {
    expect(e).toMatchObject({ kind: 'HTTP', code: 429 });
    expect((e as { retryAt: number }).retryAt).toBeGreaterThan(
      Date.now() + 110000,
    );
  }
  expect(f).toHaveBeenCalledTimes(1);
});
