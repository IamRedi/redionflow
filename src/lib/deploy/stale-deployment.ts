import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * After a new deployment, a page that was already open still calls the old
 * server action ids; the server answers "Server Action ... was not found" and
 * the button does nothing. The mounted coordinator defers refreshing until
 * current work is safe. The minimal root-error fallback below is used only
 * when that coordinator is not mounted, with its existing 30-second guard.
 */
const KEY = "bk-stale-deploy-reload-at";
const WINDOW_MS = 30_000;
let safeHandler: (() => void) | null = null;

/** The mounted app owns when it is safe to leave the current page. */
export function handleStaleDeploymentSafely(handler: () => void) {
  safeHandler = handler;
  return () => { if (safeHandler === handler) safeHandler = null; };
}

export function isStaleDeploymentError(error: unknown) {
  if (unstable_isUnrecognizedActionError(error)) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "UnrecognizedActionError" || /Server Action ".*" was not found on the server/.test(error.message);
}

export function reloadOnStaleDeployment(error: unknown, now = Date.now(), win: Pick<Window, "sessionStorage" | "location"> = window) {
  if (!isStaleDeploymentError(error)) return false;
  if (safeHandler && typeof window !== 'undefined' && win === window) {
    safeHandler();
    return true;
  }
  try {
    const last = Number(win.sessionStorage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    win.sessionStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked (private mode): still reload once; the page then has the new ids.
  }
  win.location.reload();
  return true;
}
