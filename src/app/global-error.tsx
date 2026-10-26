"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Wraps everything (including the root layout).
 * When this triggers, the app has failed catastrophically — most
 * commonly during initial cookie/language resolution or a rendering
 * bug in the shell. We keep the markup deliberately minimal because
 * the LanguageProvider itself might not have mounted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
        {/* eslint-disable i18n/no-hardcoded-jsx-text -- root fallback runs before LanguageProvider mounts */}
        <main style={{ maxWidth: 480, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#475569", margin: "0 0 1.5rem" }}>
            An unexpected error occurred while loading the application. Please try again. If the problem continues, contact support.
          </p>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 1.5rem" }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "white",
              backgroundColor: "#0f172a",
              border: 0,
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </main>
        {/* eslint-enable i18n/no-hardcoded-jsx-text */}
      </body>
    </html>
  );
}
