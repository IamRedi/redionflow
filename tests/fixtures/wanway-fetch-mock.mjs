// Explicit local E2E preload, never imported by application code. This fixture
// intercepts the documented host; production has no configurable API base URL.
if (process.env.WANWAY_E2E_MOCK === 'true') {
  const db = new URL(process.env.DATABASE_URL ?? 'invalid:');
  if (
    db.hostname !== '127.0.0.1' ||
    db.pathname !== '/baumkalk_e2e' ||
    db.username !== 'e2e'
  )
    throw new Error('WanWay mock requires the disposable E2E database');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'open.iopgps.com') return realFetch(input, init);
    const now = Math.floor(Date.now() / 1000) - 30;
    const imei = '000000000000001';
    let body;
    if (url.pathname === '/api/auth' && init?.method === 'POST')
      body = {
        code: 0,
        accessToken: 'synthetic-e2e-token',
        expiresIn: 7200000,
      };
    else if (url.pathname === '/api/device' && init?.method === 'GET')
      body = {
        code: 0,
        data: [
          { imei, deviceName: 'Synthetic GPS [ZZ 123 YY]', deviceType: 'GS900-Wired' },
        ],
        page: { currentPage: 1, pageSize: 100, count: 1 },
      };
    else if (url.pathname === '/api/device/status')
      body = {
        code: 0,
        data: [
          {
            imei,
            lat: '41.2',
            lng: '19.7',
            gpsTime: now,
            signalTime: now,
            status: 'offline',
            speed: 0,
            extVoltage: 123,
          },
        ],
      };
    else if (url.pathname === '/api/device/miles')
      body = { code: 0, miles: 15 };
    else if (url.pathname === '/api/device/track/history')
      body = {
        code: 0,
        data: [
          { lat: '41.2', lng: '19.7', gpsTime: now - 60 },
          { lat: '41.201', lng: '19.701', gpsTime: now },
        ],
      };
    else throw new Error('Forbidden WanWay request in E2E');
    return new Response(JSON.stringify(body));
  };
}
