"use client";

import { useWorkzoneSync } from "@/lib/workzone/offline/use-sync";

/**
 * Invisible component that mounts the outbox sync runner in the workzone layout.
 * Triggers a flush whenever the device comes back online.
 */
export function WorkzoneSyncRunner() {
  useWorkzoneSync();
  return null;
}
