import type { Metadata } from "next";

import { formatActionMessage } from "@/lib/i18n/action-messages";
import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function resolveMessage(error: string | undefined, retry: string | undefined, t: (path: string) => string) {
  if (error === "locked") {
    const seconds = Number(retry ?? "0");
    const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : null;
    return minutes ? formatActionMessage(t("admin.loginLockedMinutes"), { minutes }) : t("admin.loginLockedLater");
  }
  if (error === "db") return t("admin.loginUnavailable");
  if (error === "invalid") return t("admin.loginInvalid");
  return null;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>;
}) {
  const [params, currentLang] = await Promise.all([searchParams, resolveRequestLanguage()]);
  const t = getTranslator(currentLang);
  const message = resolveMessage(params.error, params.retry, t);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5 py-10">
      <div className="w-full rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{t("admin.adminLoginTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("admin.adminLoginDescription")}
        </p>
        <form method="post" action="/api/admin-login" className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              {t("admin.adminEmail")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder={t("admin.loginEmailPlaceholder")}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-sm font-medium">
              {t("form.loginCodePlaceholder")}
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder={t("admin.loginCodePlaceholder")}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          {message ? <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</p> : null}
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("admin.adminLoginSubmit")}
          </button>
        </form>
        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("admin.adminLoginHint")}
        </div>
      </div>
    </main>
  );
}
