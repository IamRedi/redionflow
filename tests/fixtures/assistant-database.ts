/** Refuse hosted/non-disposable databases before assistant integration fixtures write. */
export function assertAssistantTestDatabase() {
  let system: URL | undefined;
  for (const raw of [process.env.DATABASE_URL, process.env.DIRECT_URL ?? process.env.DATABASE_URL]) {
    let url: URL;
    try { url = new URL(raw ?? ''); } catch { throw new Error('Disposable loopback assistant database required.'); }
    const query = [...url.searchParams];
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !['/baumkalk_integration/int', '/baumkalk_e2e/e2e', '/baumkalk_ci/postgres'].includes(`${url.pathname}/${url.username}`) || url.hash ||
      !(query.length === 0 || query.length === 1 && query[0][0] === 'schema' && query[0][1] === 'public')) throw new Error('Disposable loopback assistant database required.');
    if (system && (url.hostname !== system.hostname || url.port !== system.port || url.pathname !== system.pathname)) throw new Error('Assistant fixture database targets do not match.');
    system = url;
  }
  if (process.env.TENANT_DATABASE_URL) {
    const tenant = new URL(process.env.TENANT_DATABASE_URL), query = [...tenant.searchParams];
    if (!['postgres:', 'postgresql:'].includes(tenant.protocol) || tenant.hostname !== system!.hostname || tenant.port !== system!.port || tenant.pathname !== system!.pathname || tenant.username !== 'bk_saas_pilot_runtime' || tenant.hash ||
      !(query.length === 0 || query.length === 1 && query[0][0] === 'schema' && query[0][1] === 'public')) throw new Error('Disposable assistant tenant database required.');
  }
}
