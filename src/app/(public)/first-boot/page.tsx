// BDF-P1-002: the first-boot admin setup page is intentionally
// English-only and never localised. It targets an operator running a
// one-time bootstrap on a dedicated deployment; adding it to the i18n
// catalogue would spread the setup vocabulary across worker-facing
// languages without benefit. Suppressing the repo-wide rule scoped to
// this file only.
/* eslint-disable i18n/no-hardcoded-jsx-text */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { readFirstBootSetupConfig } from "@/lib/auth/first-boot-setup";
import { hasBlockingAdmin } from "@/lib/auth/first-boot-setup-service";

import { firstBootSetupAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * BDF-P1-002 first-boot page. Renders the form only when both conditions
 * hold:
 *
 *   1. `readFirstBootSetupConfig()` reports the env gate is open;
 *   2. the database has no administrator identity row.
 *
 * Otherwise the route returns 404 via `notFound()` — deliberately
 * non-disclosing so the presence of the endpoint does not leak the
 * internal setup state.
 */
export default async function FirstBootPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const config = readFirstBootSetupConfig();
  if (!config.enabled) notFound();
  if (await hasBlockingAdmin()) notFound();

  const params = await searchParams;
  const denied = params.error === "denied";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5 py-10">
      <div className="w-full rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-xl font-semibold">First-boot admin setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This endpoint is available only on a fresh dedicated deployment
          with an explicit operator activation. It creates exactly one
          initial administrator and then becomes permanently unavailable.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Once you have signed in, unset <code>FIRST_BOOT_SETUP_ENABLED</code>{" "}
          and <code>FIRST_BOOT_SETUP_TOKEN</code> and rotate any transport
          that carried the token.
        </p>

        {denied ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Setup denied. Verify the setup token and your input, or check
            operational logs.
          </p>
        ) : null}

        <form method="post" action={firstBootSetupAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="token" className="block text-sm font-medium">
              Setup token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              required
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              Administrator email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium">
              Display name (optional)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={120}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              Password (at least 12 characters)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmation" className="block text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create administrator
          </button>
        </form>
      </div>
    </main>
  );
}
