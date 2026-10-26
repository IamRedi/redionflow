# Content-Security-Policy rollout

BDF-P8-007 ships a `Content-Security-Policy-Report-Only` header in
`next.config.mjs`. It costs nothing at runtime (browsers apply the
policy in report-only mode without blocking anything) and gives the
operator a two-week window to widen the policy before flipping to
enforcement.

## Where each piece lives

- **Policy header** — `next.config.mjs` → `SECURITY_HEADERS` →
  `Content-Security-Policy-Report-Only`. Directives sit in
  `CSP_REPORT_ONLY` with a comment justifying each one.
- **Report collector** — `src/app/api/csp-report/route.ts`. Accepts
  both legacy (`application/csp-report`) and modern (Reporting API)
  payloads, normalises them into a single shape, and forwards them
  through the structured logger as `csp.report_only.violation`.

## What to do during the two-week window

1. Deploy this PR to the staging environment.
2. Have the QA / product team drive every user-facing flow: login,
   dashboard, calculation, project export, workzone, Firebase push
   opt-in, Leaflet map, offer PDF print.
3. Grep the log aggregator for `csp.report_only.violation`.
4. For each unique `violatedDirective` + `blockedUri` pair, decide:
    - It's a legitimate resource → widen the directive.
    - It's an inline script we can nonce → do the nonce refactor.
    - It's a browser extension → ignore (usually a `chrome-extension:`
      or `moz-extension:` blocked URI).
5. Once staging is silent for a week, swap
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
   in `next.config.mjs`.

## Why we start permissive on `img-src` / `connect-src`

The initial policy allows:

```
img-src 'self' data: blob: https:
connect-src 'self' https: wss:
```

That's much wider than we want long-term. During report-only, though,
a *too-narrow* policy that blocks Leaflet tiles, Supabase-hosted
worker photos, or a live Firebase FCM connection would generate
thousands of noise reports and drown out the real violations. Once
the target hostnames are stable per environment, replace the wildcard
`https:` sources with explicit hostnames:

```
img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org
connect-src 'self' https://*.googleapis.com https://api.openai.com wss://*.firebase.io
```

## `'unsafe-inline'` in `script-src` / `style-src`

Kept for now because Next.js still emits a couple of bootstrap inline
scripts and Tailwind emits inline styles for arbitrary values. The
clean fix is adopting the Next.js
[nonce API](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).
That's a separate follow-up because it needs a middleware that
generates a nonce per request and wires it into `_document`.

## Testing the collector

Four unit tests in `src/app/api/csp-report/route.test.ts` cover:
- legacy `csp-report` payload logs and returns 204
- modern Reporting API payload logs and returns 204
- malformed JSON returns 204 without logging
- empty payload returns 204 without logging

All 148 project tests pass with the collector in place.
