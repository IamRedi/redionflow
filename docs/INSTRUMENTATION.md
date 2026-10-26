# Instrumentation & error correlation

BDF-P8-007 wires a lightweight instrumentation hook in
`instrumentation.ts` at the repo root. Next.js runs it once at server
startup and once per unhandled server-side error. Its whole job is
to give operators a **single, reliable correlation point** between the
`error.digest` a user sees in an error boundary and the log line
holding the full stack trace.

## What you get for free today

Every startup emits:

```json
{"level":"info","time":"…","event":"server.startup","nodeVersion":"v22.…","nodeEnv":"production","appEnv":"saas","saas":true}
```

Every unhandled server render / API / server-action error emits:

```json
{
  "level": "error",
  "time": "…",
  "event": "request.unhandled_error",
  "path": "/app/dashboard",
  "method": "GET",
  "routePath": "/app/dashboard",
  "routeType": "render",
  "routerKind": "App Router",
  "digest": "abc123",
  "message": "unhandled server error",
  "error": { "name": "…", "message": "…", "stack": "…" }
}
```

`digest` matches the `Ref: {error.digest}` the user is shown in
`error.tsx` / `global-error.tsx`, so a support conversation quoting the
ref can be traced end-to-end.

## Wiring Sentry / Rollbar / whatever

The hook is deliberately dependency-free. When the deployment picks a
crash tracker, add exactly one line inside `onRequestError`:

```ts
export async function onRequestError(err, request, errorContext) {
  logger.error({ event: "request.unhandled_error", ...ctx }, "…", err);

  // Add this after wiring:
  //   Sentry.captureException(err, {
  //     extra: { path: request.path, digest: err.digest },
  //     tags: { routePath: errorContext.routePath, routeType: errorContext.routeType },
  //   });
}
```

Doing it here (not in each boundary) means every code path benefits
automatically, and the `digest` becomes the correlation key between
your log aggregator and Sentry issue view.

## Silencing during tests

`vitest.config.ts` sets `BDF_LOGGER_SILENT=1` globally, so unit tests
don't see startup or request-error logs. The instrumentation tests
themselves opt back in for their own scope.
