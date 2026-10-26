"use client";

import { useSyncExternalStore } from "react";
const subscribe = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

/** Password forms must not submit before their client handler is ready. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}
