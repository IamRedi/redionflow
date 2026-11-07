"use client";

import { useEffect } from "react";

import { reloadOnStaleDeployment } from "@/lib/deploy/stale-deployment";

/** Mounted once in the root layout: reloads the page when a click hits an old deployment. */
export function StaleDeploymentReload() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (reloadOnStaleDeployment(event.reason)) event.preventDefault();
    };
    const onError = (event: ErrorEvent) => {
      if (reloadOnStaleDeployment(event.error)) event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
