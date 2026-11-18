export const VERSION_POLL_MS = 60_000;
export const VERSION_PROBE_GAP_MS = 10_000;
export const UPDATE_IDLE_MS = 5_000;
export const UPDATE_RELOAD_WINDOW_MS = 5 * 60_000;
export const UPDATE_RELOAD_KEY = 'bk-app-update-reload';

export function validBuildVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
}

/** A rolling/reverting host must agree twice before a clean page can reload. */
export function observeBuildVersion(current: string, candidate: string | null, observed: unknown) {
  if (!validBuildVersion(observed) || observed === current) return { candidate: null, ready: false };
  return { candidate: observed, ready: candidate === observed };
}

export function isMutationRequest(input: RequestInfo | URL, init: RequestInit | undefined, origin: string) {
  try {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), origin);
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    return url.origin === origin && !['GET', 'HEAD', 'OPTIONS'].includes(method);
  } catch { return false; }
}

export function updateReloadAllowed(raw: string | null, target: string, now: number) {
  if (!validBuildVersion(target)) return false;
  if (!raw) return true;
  try {
    const last = JSON.parse(raw) as { version?: unknown; at?: unknown };
    // Bound repeated reloads across old/new hosts, including a rollback.
    return typeof last.at !== 'number' || !Number.isFinite(last.at) || now - last.at >= UPDATE_RELOAD_WINDOW_MS;
  } catch { return true; }
}
