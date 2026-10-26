"use client";

import { useEffect } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/**
 * Workzone error boundary. Keeps the worker on the Workzone shell
 * (with retry) instead of falling through to the root global-error
 * boundary, which loses the language context. Never surfaces the raw
 * error message to the worker — engineering-visible details go to
 * console + `error.digest`.
 */
export default function WorkzoneError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { currentLang } = useLanguage();

  useEffect(() => {
    console.error("[workzone-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.appErrorTitle", currentLang)}</CardTitle>
          <CardDescription>{t("admin.appErrorDescription", currentLang)}</CardDescription>
          {error.digest ? (
            // eslint-disable-next-line i18n/no-hardcoded-jsx-text -- reference tag rendered verbatim on all locales
            <p className="mt-1 text-xs text-muted-foreground">Ref: <code>{error.digest}</code></p>
          ) : null}
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => reset()}>
            {t("admin.retry", currentLang)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
