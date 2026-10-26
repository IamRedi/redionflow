/**
 * BDF-P8-007 Next.js instrumentation hook.
 *
 * Runs once per server boot before any request is served. Its job is
 * to give operators a single, reliable correlation point between the
 * `error.digest` value the user sees in an error boundary and the
 * stack trace stored in the log aggregator.
 *
 * Next.js calls `register()` at startup and `onRequestError()` for
 * every unhandled server-side render error. Both are documented at
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation.
 *
 * We deliberately keep this hook dependency-free so it works in every
 * deployment target. Wiring Sentry/Rollbar later is a two-line
 * addition inside `onRequestError`.
 */

import { logger } from "@/lib/observability/logger";

export async function register() {
  logger.info(
    {
      event: "server.startup",
      // NEXT_RUNTIME is "nodejs" or "edge"; process.version only exists in Node.
      runtime: process.env.NEXT_RUNTIME ?? "nodejs",
      nodeVersion: process.env.NEXT_RUNTIME === "edge" ? "edge" : globalThis.process.version,
      nodeEnv: process.env.NODE_ENV,
      appEnv: process.env.APP_ENV ?? null,
      saas: process.env.SAAS_MODE === "true",
    },
    "server booted",
  );
}

/**
 * Called by Next.js for every unhandled server error surfaced to a
 * user (both the App Router `error.tsx` boundaries and the API
 * route handlers).
 *
 * The `errorContext.digest` value here is exactly what
 * `error.tsx` renders as `Ref: {error.digest}`, so a support
 * conversation that quotes the ref can be traced end-to-end.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  errorContext: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
    revalidateReason?: "on-demand" | "stale" | undefined;
    renderType?: "dynamic" | "dynamic-resume";
  },
) {
  const digest = err instanceof Error ? (err as { digest?: string }).digest : undefined;
  logger.error(
    {
      event: "request.unhandled_error",
      path: request.path,
      method: request.method,
      routePath: errorContext.routePath,
      routeType: errorContext.routeType,
      routerKind: errorContext.routerKind,
      renderSource: errorContext.renderSource,
      digest: digest ?? null,
    },
    "unhandled server error",
    err,
  );
}
