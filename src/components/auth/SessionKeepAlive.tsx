'use client';

import { useEffect } from 'react';

/** No credentials in browser storage; the server renews its HttpOnly cookie. */
export function SessionKeepAlive() {
  useEffect(() => {
    let lastAttempt = 0;
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastAttempt < 6 * 60 * 60 * 1000) return;
      lastAttempt = Date.now();
      void fetch('/api/session/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 6 * 60 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return null;
}
