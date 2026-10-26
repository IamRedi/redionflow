"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type LiveRefreshListenerProps = {
  enabled?: boolean;
};

type RealtimePayload = {
  event: string;
  scope: string[];
};

function scopeMatchesRoute(scope: string, pathname: string) {
  if (scope === "announcement-bar" || scope === "worker-strip" || scope === "machine-sidebar") {
    return pathname.startsWith("/workzone") || pathname.startsWith("/app");
  }

  if (scope === "fleet-gps") {
    return pathname.startsWith("/app/fleet-gps");
  }

  if (scope === "working-badge" || scope === "baustelle-progress") {
    return pathname === "/workzone" || pathname.startsWith("/workzone/baustellen/");
  }

  if (scope === "tree-list" || scope === "safety-panel") {
    return pathname.startsWith("/workzone/baustellen/");
  }

  if (scope === "daily-plan") {
    return pathname === "/workzone" || pathname.startsWith("/workzone/plan");
  }

  if (scope === "workzone-cards" || scope === "mission-control") {
    return pathname === "/workzone" || pathname.startsWith("/workzone/baustellen/");
  }

  return false;
}

function shouldRefreshForPayload(payload: RealtimePayload, pathname: string) {
  if (payload.event === "connected") return false;
  return payload.scope.some((scope) => scopeMatchesRoute(scope, pathname));
}

export function LiveRefreshListener({ enabled = true }: LiveRefreshListenerProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource("/api/realtime/updates");
      source.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as RealtimePayload;
          if (shouldRefreshForPayload(payload, pathname)) router.refresh();
        } catch {
          // Ignore malformed realtime payloads; focus/online fallbacks still refresh.
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    const refreshOnResume = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const refreshOnOnline = () => router.refresh();
    document.addEventListener("visibilitychange", refreshOnResume);
    window.addEventListener("focus", refreshOnOnline);
    window.addEventListener("online", refreshOnOnline);

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      document.removeEventListener("visibilitychange", refreshOnResume);
      window.removeEventListener("focus", refreshOnOnline);
      window.removeEventListener("online", refreshOnOnline);
    };
  }, [enabled, pathname, router]);

  return null;
}
