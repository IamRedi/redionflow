'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { handleStaleDeploymentSafely, reloadOnStaleDeployment } from '@/lib/deploy/stale-deployment';
import { trackUpdateActivity } from '@/lib/deploy/update-activity';
import { isMutationRequest, observeBuildVersion, UPDATE_IDLE_MS, UPDATE_RELOAD_KEY, updateReloadAllowed, validBuildVersion, VERSION_POLL_MS, VERSION_PROBE_GAP_MS } from '@/lib/deploy/update-policy';

const copy: Record<string, string> = {
  sq: 'Përditësim gati · zbatohet automatikisht pasi të përfundosh punën e hapur.',
  en: 'Update ready · applies automatically when your open work is finished.',
  de: 'Update bereit · wird automatisch nach deiner offenen Arbeit geladen.',
  it: 'Aggiornamento pronto · si applica automaticamente dopo il lavoro aperto.',
  ro: 'Actualizare pregătită · se aplică automat după încheierea lucrului deschis.',
  pl: 'Aktualizacja gotowa · włączy się automatycznie po zakończeniu otwartej pracy.',
};

/** Replaces the old immediate error reload. No draft storage or mutation replay. */
export function StaleDeploymentReload({ version, enabled }: { version: string | null; enabled: boolean }) {
  const { currentLang } = useLanguage();
  // An RSC refresh can supply new props while the JS still belongs to this build.
  const [mountedVersion] = useState(version);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!enabled || !mountedVersion) return;
    let disposed = false, reloading = false, pending: string | null = null, candidate: string | null = null;
    let mutations = 0, lastActivity = Date.now(), lastProbe = 0, verifiedAt = 0;
    let probe: AbortController | null = null;
    const originalFetch = window.fetch;
    const activity = trackUpdateActivity(document, () => { lastActivity = Date.now(); });
    const active = () => !disposed && document.visibilityState === 'visible' && navigator.onLine;
    const apply = () => {
      if (!pending || reloading || !active() || mutations || Date.now() - lastActivity < UPDATE_IDLE_MS || activity.blocked()) return;
      // Recheck after a long edit/background pause. An old observation must not
      // send the user into an offline, failed or rolling-back release.
      if (probe || Date.now() - verifiedAt > 15_000) { void check(); return; }
      try {
        if (!updateReloadAllowed(sessionStorage.getItem(UPDATE_RELOAD_KEY), pending, Date.now())) return;
        sessionStorage.setItem(UPDATE_RELOAD_KEY, JSON.stringify({ version: pending, at: Date.now() }));
      } catch { return; } // No persistent loop guard: keep the current work intact.
      reloading = true;
      window.location.reload(); // Same URL/search/hash. No resubmission of a command.
    };
    const mark = (target: string) => { if (!disposed) { pending = target; setWaiting(true); } };
    const check = async () => {
      if (!active() || probe || Date.now() - lastProbe < VERSION_PROBE_GAP_MS) return;
      lastProbe = Date.now();
      verifiedAt = 0;
      const controller = new AbortController(); probe = controller;
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await originalFetch('/api/app-version', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok || disposed || !response.headers.get('content-type')?.includes('application/json')) return;
        const body: unknown = await response.json();
        if (disposed) return;
        const seen = body && typeof body === 'object' && 'version' in body ? body.version : null;
        const result = observeBuildVersion(mountedVersion, candidate, seen);
        candidate = result.candidate;
        if (result.ready && validBuildVersion(seen)) mark(seen);
        if (validBuildVersion(seen) && pending === seen) verifiedAt = Date.now();
        // Returning to this build cancels a version-only update during a rollout.
        if (seen === mountedVersion && pending && pending !== mountedVersion) { pending = null; setWaiting(false); }
      } catch { /* Offline, timeout, auth redirect or a bad response is not a new release. */ }
      finally { window.clearTimeout(timeout); if (probe === controller) probe = null; }
    };
    const stale = () => { mark(pending ?? mountedVersion); void check(); };
    const releaseHandler = handleStaleDeploymentSafely(stale);
    const wrappedFetch: typeof fetch = async (input, init) => {
      const mutation = isMutationRequest(input, init, window.location.origin);
      if (mutation) { mutations++; lastActivity = Date.now(); }
      let response: Response;
      try { response = await originalFetch(input, init); }
      catch (error) { if (mutation) { mutations--; lastActivity = Date.now(); } throw error; }
      if (mutation && response.headers.get('x-nextjs-action-not-found') === '1') stale();
      if (mutation) {
        // Wait through streamed action/upload responses too, without buffering or
        // inspecting their private contents. Return the original response intact.
        const finish = () => { mutations--; lastActivity = Date.now(); };
        try {
          const reader = response.clone().body?.getReader();
          if (!reader) finish();
          else void (async () => { try { while (!(await reader.read()).done) { /* discard */ } } catch { /* transport failed */ } finally { reader.releaseLock(); finish(); } })();
        } catch { finish(); }
      }
      return response;
    };
    window.fetch = wrappedFetch;
    const interact = () => { lastActivity = Date.now(); };
    const resume = () => { if (active()) void check(); };
    const rejection = (event: PromiseRejectionEvent) => { if (reloadOnStaleDeployment(event.reason)) event.preventDefault(); };
    const error = (event: ErrorEvent) => { if (reloadOnStaleDeployment(event.error)) event.preventDefault(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending && (mutations || activity.blocked())) { event.preventDefault(); event.returnValue = ''; }
    };
    const timer = window.setInterval(() => { if (candidate && !pending) void check(); apply(); }, 1_000);
    const poll = window.setInterval(() => { void check(); }, VERSION_POLL_MS);
    const initial = window.setTimeout(() => { void check(); }, 2_000);
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('pointerdown', interact, true);
    document.addEventListener('keydown', interact, true);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    window.addEventListener('unhandledrejection', rejection);
    window.addEventListener('error', error);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      disposed = true; probe?.abort(); releaseHandler(); activity.dispose();
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
      window.clearInterval(timer); window.clearInterval(poll); window.clearTimeout(initial);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('pointerdown', interact, true);
      document.removeEventListener('keydown', interact, true);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('unhandledrejection', rejection);
      window.removeEventListener('error', error);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [enabled, mountedVersion]);
  if (!enabled || !mountedVersion || !waiting) return null;
  // Background maintenance must never cover a Save/Stop/Back control or a draft.
  return <span role="status" data-testid="app-update-ready" className="sr-only pointer-events-none">{copy[currentLang] ?? copy.en}</span>;
}
