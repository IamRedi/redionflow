"use client";

import { useSyncExternalStore } from "react";
import { createWorkshopDemo } from "@/lib/workshop/demo-data";
import { applyWorkshopCommand, workshopSchema, WORKSHOP_STORAGE_KEY, type WorkshopCommand } from "@/lib/workshop/demo-model";

const initial = { state: createWorkshopDemo(), status: "ready" as "ready" | "storage" | "corrupt", hydrated: true };
const serverSnapshot = { ...initial, hydrated: false };
let cached = initial;
let lastRaw: string | null | undefined;
function snapshot() {
  try {
    const raw = localStorage.getItem(WORKSHOP_STORAGE_KEY);
    if (raw !== lastRaw) {
      lastRaw = raw;
      if (!raw) cached = initial;
      else {
        let value: unknown;
        try { value = JSON.parse(raw); } catch { value = null; }
        const parsed = workshopSchema.safeParse(value);
        cached = parsed.success ? { state: parsed.data, status: "ready", hydrated: true } : { state: initial.state, status: "corrupt", hydrated: true };
      }
    }
  } catch { if (cached.status !== "storage") cached = { state: cached.state, status: "storage", hydrated: true }; }
  return cached;
}
function subscribe(listener: () => void) {
  const changed = (event: StorageEvent) => { if (event.key === WORKSHOP_STORAGE_KEY || event.key === null) listener(); };
  window.addEventListener("storage", changed); window.addEventListener("workshop-demo-change", listener);
  return () => { window.removeEventListener("storage", changed); window.removeEventListener("workshop-demo-change", listener); };
}
export function useWorkshopDemo() {
  const data = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
  function dispatch(command: WorkshopCommand) {
    const current = snapshot();
    if (current.status !== "ready") throw new Error(current.status);
    const next = applyWorkshopCommand(current.state, command, new Date().toISOString(), crypto.randomUUID());
    try { localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(next)); } catch { throw new Error("storage"); }
    window.dispatchEvent(new Event("workshop-demo-change"));
  }
  function reset() {
    localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(createWorkshopDemo()));
    window.dispatchEvent(new Event("workshop-demo-change"));
  }
  return { ...data, dispatch, reset };
}
