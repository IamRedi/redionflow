"use client";

import { useSyncExternalStore } from "react";
import { createWorkshopDemo } from "@/lib/workshop/demo-data";
import { emptyDirectory, snapshotSchema, WORKSHOP_API, WORKSHOP_FILES_API, type publicWorkshopCommand, type WorkshopSnapshot } from "@/lib/workshop/shared-contract";
import type { z } from "zod";
import { demoOffice } from "@/lib/workshop/custody-schema";
import type { MediaCommand } from "@/lib/workshop/media";
export type DemoInventoryCommand = z.infer<typeof publicWorkshopCommand>;

type View = WorkshopSnapshot & { status: "loading" | "ready" | "connection"; hydrated: boolean; pending: boolean; generating: string[]; imageErrors: Record<string,string> };
const serverSnapshot: View = { state: createWorkshopDemo(), actor: demoOffice, revision: -1, updatedAt: "", photos: [], directory: emptyDirectory, status: "loading", hydrated: false, pending: false, generating: [], imageErrors: {} };
let etag: string | null = null;
let cached = serverSnapshot;
const listeners = new Set<() => void>();
const imageRequests = new Map<string, string>();
let actorEpoch = 0;
let reading: Promise<void> | null = null;
let cleanup: (() => void) | null = null;
function emit(change: Partial<View>) { cached = { ...cached, ...change }; listeners.forEach(listener => listener()); }
function accept(value: unknown) {
  const snapshot = snapshotSchema.parse(value);
  if (snapshot.revision >= cached.revision) emit({ ...snapshot, status: "ready", hydrated: true });
}
async function refresh() {
  if (reading) return reading;
  const epoch = actorEpoch;
  reading = (async () => {
    try {
      const response = await fetch(WORKSHOP_API, { cache: "no-store", headers: etag ? { "If-None-Match": etag } : {} });
      if (epoch !== actorEpoch) return;
      if (response.status === 304) { emit({ status: "ready" }); return; }
      if (!response.ok) throw new Error("connection");
      const value = await response.json();
      if (epoch !== actorEpoch) return;
      accept(value);
      etag = response.headers.get("etag");
    } catch { emit({ status: "connection" }); }
    finally { reading = null; }
  })();
  return reading;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(visible, 8000);
    window.addEventListener("focus", visible); window.addEventListener("online", visible); document.addEventListener("visibilitychange", visible);
    cleanup = () => { window.clearInterval(timer); window.removeEventListener("focus", visible); window.removeEventListener("online", visible); document.removeEventListener("visibilitychange", visible); };
  }
  return () => { listeners.delete(listener); if (!listeners.size) { cleanup?.(); cleanup = null; } };
}
type Intent = { key: string; url: string; body: BodyInit; headers?: HeadersInit };
let unconfirmed: Intent | null = null;
// Keep an uncertain receipt across retries, including a connection lost after
// response headers. A manual retry must not book an already committed part twice.
async function deliver(intent: Intent) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(intent.url, { method: "POST", body: intent.body, headers: intent.headers });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) unconfirmed = null;
        if (response.status === 409) await refresh();
        throw new Error(typeof result.error === "string" ? result.error : "connection");
      }
      accept(result.actor ? result : { ...result, actor: cached.actor }); unconfirmed = null; return;
    } catch (error) {
      if (attempt === 0 && (error instanceof TypeError || error instanceof SyntaxError)) continue;
      throw error;
    }
  }
}
async function send(url: string, key: string, body: () => BodyInit, headers?: HeadersInit) {
  if (unconfirmed && unconfirmed.key !== key) await deliver(unconfirmed);
  const intent = unconfirmed ?? { key, url, body: body(), headers };
  unconfirmed = intent;
  await deliver(intent);
}
async function change(operation: () => Promise<void>) {
  if (cached.pending || !cached.hydrated || cached.status !== "ready") throw new Error("connection");
  emit({ pending: true });
  try { await operation(); }
  catch (error) { if (error instanceof TypeError) { emit({ status: "connection" }); throw new Error("connection"); } throw error; }
  finally { emit({ pending: false }); }
}
export function useWorkshopDemo() {
  const data = useSyncExternalStore(subscribe, () => cached, () => serverSnapshot);
  async function dispatch(command: DemoInventoryCommand) {
    await change(() => send(WORKSHOP_API, JSON.stringify(command), () => JSON.stringify({ requestId: crypto.randomUUID(), revision: cached.revision, command }), { "Content-Type": "application/json" }));
  }
  async function upload(file: File, target: { kind: "asset" | "site" | "document"; target: string; jobId?: string }) {
    await change(() => send(WORKSHOP_FILES_API, JSON.stringify([target, file.name, file.size, file.lastModified]), () => {
      const form = new FormData(); form.set("requestId", crypto.randomUUID()); form.set("revision", String(cached.revision)); form.set("kind", target.kind); form.set("target", target.target); form.set("file", file); if (target.jobId) form.set("jobId", target.jobId);
      return form;
    }));
  }
  async function switchActor(key: string) {
    if (cached.pending || unconfirmed) throw new Error("pending");
    emit({pending: true}); actorEpoch++;
    try {
    const response = await fetch("/api/demo/baumdienst/actor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    if (!response.ok) throw new Error("connection");
    etag = null; if (reading) await reading; await refresh();
    } finally { emit({pending: false}); }
  }
  async function manageMedia(command:MediaCommand) {
    await change(()=>send("/api/demo/baumdienst/media",JSON.stringify(["media",command]),()=>JSON.stringify({requestId:crypto.randomUUID(),revision:cached.revision,command}),{"Content-Type":"application/json"}));
  }
  async function generateImage(assetId: string,kind:"asset"|"site"|"brand"="asset") {
    if (cached.generating.includes(assetId)) return;
    emit({ generating: [...cached.generating, assetId], imageErrors: { ...cached.imageErrors, [assetId]: "" } });
    const requestId = imageRequests.get(assetId) || crypto.randomUUID(); imageRequests.set(assetId, requestId);
    try {
      const response = await fetch("/api/demo/baumdienst/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId, requestId, kind }) });
      const result = await response.json();
      imageRequests.delete(assetId);
      if (!response.ok || result.status === "error") throw new Error(result.error || "aiFailed");
    } catch (error) {
      emit({ imageErrors: { ...cached.imageErrors, [assetId]: error instanceof Error ? error.message : "aiFailed" } });
      throw error;
    } finally { emit({ generating: cached.generating.filter(id => id !== assetId) }); etag = null; if (reading) await reading; await refresh(); }
  }
  return { ...data, actor: data.actor || demoOffice, dispatch, upload, refresh, switchActor, generateImage, manageMedia };
}
