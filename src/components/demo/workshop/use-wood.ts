"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WoodCommand, WoodMediaTarget, WoodSnapshot } from "@/lib/workshop/wood-model";
import { useWorkshopDemo } from "./use-workshop-demo";

const api = "/api/demo/baumdienst/wood";
type Intent = { key: string; url: string; body: BodyInit; headers?: HeadersInit };

/** Server is authoritative. An uncertain response retains its original receipt. */
export function useWood() {
  const { actor } = useWorkshopDemo();
  const [snapshot, setSnapshot] = useState<WoodSnapshot | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const latest = useRef<WoodSnapshot | null>(null);
  const inFlight = useRef(false), mounted = useRef(true), serial = useRef(0);
  const uncertain = useRef<Intent | null>(null);
  const imageRequests = useRef(new Map<string, string>());

  const accept = useCallback((data: WoodSnapshot) => {
    latest.current = data;
    if (mounted.current) setSnapshot(data);
  }, []);
  const refresh = useCallback(async () => {
    const number = ++serial.current;
    try {
      const response = await fetch(api, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "error");
      if (mounted.current && serial.current === number) { accept(data); setError(""); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "error");
    }
  }, [accept]);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => void refresh());
    const visible = () => { if (!inFlight.current && document.visibilityState === "visible") void refresh(); };
    const timer = setInterval(visible, 8000);
    window.addEventListener("focus", visible);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("focus", visible); };
  }, [refresh, actor.key]);

  async function deliver(intent: Intent): Promise<WoodSnapshot> {
    const response = await fetch(intent.url, { method: "POST", body: intent.body, headers: intent.headers });
    // A failure after headers is still uncertain: do not discard its UUID.
    const data = await response.json();
    if (!response.ok) {
      if (response.status < 500) uncertain.current = null;
      if (response.status === 409) await refresh();
      throw new Error(data.error ?? "error");
    }
    uncertain.current = null;
    accept(data);
    return data;
  }
  async function send(key: string, url: string, body: () => BodyInit, headers?: HeadersInit) {
    if (uncertain.current && uncertain.current.key !== key) await deliver(uncertain.current);
    const intent = uncertain.current ?? { key, url, body: body(), headers };
    uncertain.current = intent;
    return deliver(intent);
  }
  async function run(operation: () => Promise<WoodSnapshot>) {
    if (inFlight.current) throw new Error("busy");
    inFlight.current = true; serial.current++; setPending(true); setError("");
    try { return await operation(); }
    catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "error");
      throw cause;
    } finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  function dispatch(command: WoodCommand) {
    return run(() => send(JSON.stringify(command), api, () => JSON.stringify({
      requestId: crypto.randomUUID(), revision: latest.current?.revision ?? 0, command,
    }), { "Content-Type": "application/json" }));
  }
  function upload(target: Omit<WoodMediaTarget, "requestId" | "revision">, file: File) {
    return run(async () => {
      if (!file.size || file.size > 12_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("photoError");
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
      return send(JSON.stringify([target.kind, target.target, file.name, hash]), `${api}/files`, () => {
        const form = new FormData();
        form.set("requestId", crypto.randomUUID()); form.set("revision", String(latest.current?.revision ?? 0));
        form.set("kind", target.kind); form.set("target", target.target); form.set("file", file);
        return form;
      });
    });
  }
  async function generate(phaseId: string) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    const requestId = imageRequests.current.get(phaseId) ?? crypto.randomUUID();
    imageRequests.current.set(phaseId, requestId);
    try {
      const response = await fetch(`${api}/images`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, phaseId }) });
      const data = await response.json();
      if (response.ok && data.status !== "pending") imageRequests.current.delete(phaseId);
      if (!response.ok || data.status === "error") throw new Error(data.error ?? "error");
      await refresh();
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "error"); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  }
  return { snapshot, error, pending, dispatch, upload, generate, refresh };
}
export type WoodController = ReturnType<typeof useWood>;
