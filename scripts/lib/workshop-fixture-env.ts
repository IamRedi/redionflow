/** Seed only the dedicated disposable fixture accepted by the unchanged tests. */
export function assertWorkshopSeedEnv(env: { DATABASE_URL?: string; APP_ENV?: string; SAAS_MODE?: string }): void {
  let u: URL;
  try { u = new URL(env.DATABASE_URL ?? ""); } catch { throw new Error("Disposable workshop fixture required"); }
  if (u.protocol !== "postgresql:" || u.hostname !== "127.0.0.1" || u.port !== "55435" ||
      u.pathname !== "/baumdemo_test" || u.username !== "int" || !u.password || u.hash ||
      [...u.searchParams].some(([key,value]) => key !== "schema" || value !== "public") ||
      env.APP_ENV !== "demo" || env.SAAS_MODE !== "false") throw new Error("Disposable workshop fixture required");
}
