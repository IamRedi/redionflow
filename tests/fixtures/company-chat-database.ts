/** Refuse non-disposable databases before chat integration fixtures write. */
export function assertCompanyChatTestDatabase() {
  let target: URL | undefined;
  for (const raw of [process.env.DATABASE_URL, process.env.DIRECT_URL ?? process.env.DATABASE_URL]) {
    const url = new URL(raw ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || !['/baumkalk_integration/int', '/baumkalk_e2e/e2e', '/baumkalk_ci/postgres'].includes(`${url.pathname}/${url.username}`)
      || url.hash || [...url.searchParams].some(([key,value]) => key !== 'schema' || value !== 'public')) throw new Error('Disposable loopback chat database required.');
    if (target && (url.hostname !== target.hostname || url.port !== target.port || url.pathname !== target.pathname)) throw new Error('Chat fixture database targets must match.');
    target = url;
  }
  if (process.env.TENANT_DATABASE_URL) {
    const tenant = new URL(process.env.TENANT_DATABASE_URL);
    if (tenant.hostname !== target!.hostname || tenant.port !== target!.port || tenant.pathname !== target!.pathname || tenant.username !== 'bk_saas_pilot_runtime') throw new Error('Disposable chat tenant database required.');
  }
}
