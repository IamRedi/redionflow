"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { officeSnapshot } from "@/lib/workshop/offices/store";
import type { officeCommand, OfficeRole } from "@/lib/workshop/offices/model";
import type { z } from "zod";
export type OfficeSnapshot = Awaited<ReturnType<typeof officeSnapshot>>;
type Intent = { path: string; key: string; body: string | FormData; headers?: HeadersInit };
export function useOffice(room?: OfficeRole, month?: string) {
  const [data, setData] = useState<OfficeSnapshot | null>(null), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const generation = useRef(0), uncertain = useRef<Intent | null>(null), revision = useRef(0), busy = useRef(false);
  const refresh = useCallback(async () => {
    const epoch = generation.current;
    const q = new URLSearchParams({ ...(room ? { room } : {}), ...(month ? { month } : {}) });
    try { const r = await fetch(`/api/demo/baumdienst/offices?${q}`, { cache: "no-store" }); if (!r.ok) { const e = await r.json(); throw new Error(e.error || "error"); } const next: OfficeSnapshot = await r.json(); if (generation.current !== epoch || next.revision < revision.current) return; revision.current = next.revision; setData(previous => previous && previous.actor === next.actor && previous.revision > next.revision ? previous : next); setError(""); }
    catch (e) { if (generation.current === epoch) setError(e instanceof Error ? e.message : "error"); }
  }, [room, month]);
  useEffect(() => { generation.current++; void refresh(); const visible = () => { if (document.visibilityState === "visible" && !busy.current) void refresh(); }; const timer = window.setInterval(visible, 30000); window.addEventListener("focus", visible); return () => { generation.current++; window.clearInterval(timer); window.removeEventListener("focus", visible); }; }, [refresh]);
  async function deliver(intent: Intent) {
    const r = await fetch(intent.path, { method: "POST", headers: intent.headers, body: intent.body });
    const result = await r.json();
    if (!r.ok) { if (r.status < 500) uncertain.current = null; if (r.status === 409) await refresh(); throw new Error(result.error || "error"); }
    uncertain.current = null; await refresh(); return result;
  }
  async function send(key: string, create: () => Intent) {
    if (!data || busy.current) throw new Error("busy"); busy.current = true; setPending(true); setError("");
    try { if (uncertain.current && uncertain.current.key !== key) await deliver(uncertain.current); const intent = uncertain.current ?? create(); uncertain.current = intent; return await deliver(intent); }
    catch (e) { setError(e instanceof Error ? e.message : "error"); throw e; }
    finally { busy.current = false; setPending(false); }
  }
  const command = (value: z.infer<typeof officeCommand>) => send(JSON.stringify(value), () => ({ key: JSON.stringify(value), path: "/api/demo/baumdienst/offices", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), revision: revision.current, command: value }) }));
  async function upload(file: File, folderId?: string, shared = false) { const key = JSON.stringify(["upload", file.name, file.size, file.lastModified, folderId, shared]); return send(key, () => { const f = new FormData(); f.set("requestId", crypto.randomUUID()); f.set("revision", String(revision.current)); f.set("file", file); f.set("shared", String(shared)); if (folderId) f.set("folderId", folderId); return { key, path: "/api/demo/baumdienst/offices/files", body: f }; }); }
  const ask = (message: string, lang: string) => { const key = JSON.stringify(["assistant", message, lang]); return send(key, () => ({ key, path: "/api/demo/baumdienst/offices/assistant", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), revision: revision.current, message, lang }) })); };
  async function switchRole(role: OfficeRole) { if (busy.current || uncertain.current) throw new Error("busy"); busy.current = true; setPending(true); try { const r = await fetch("/api/demo/baumdienst/offices/actor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }); if (!r.ok) throw new Error("permission"); generation.current++; revision.current = 0; setData(null); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "error"); throw e; } finally { busy.current = false; setPending(false); } }
  return { data, error, pending, refresh, command, upload, ask, switchRole };
}
export type OfficeController = ReturnType<typeof useOffice>;
