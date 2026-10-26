"use client";

import { useEffect } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDatabaseUnavailableError } from "@/lib/db/db-error";
import { t } from "@/lib/i18n";

const DATABASE_URL_KEY = "DATABASE_URL";
const ENV_FILE = ".env";
const DB_START_SCRIPT = ".\\scripts\\db-start.ps1";
const DOCKER_RUN_COMMAND = "docker run";
const DB_MIGRATE_COMMAND = "npm run db:migrate";
const DB_SEED_COMMAND = "npm run db:seed";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { currentLang } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const dbDown = isDatabaseUnavailableError(error);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{dbDown ? t("admin.dbUnavailableTitle", currentLang) : t("admin.appErrorTitle", currentLang)}</CardTitle>
          <CardDescription>
            {dbDown ? (
              <>
                {t("admin.dbUnavailableDescriptionPrefix", currentLang)} (
                <code className="rounded bg-muted px-1">{DATABASE_URL_KEY}</code> {t("admin.dbUnavailableDescriptionMiddle", currentLang)}{" "}
                <code className="rounded bg-muted px-1">{ENV_FILE}</code>).
              </>
            ) : (
              t("admin.appErrorDescription", currentLang)
            )}
          </CardDescription>
          {!dbDown && error.digest ? (
            // eslint-disable-next-line i18n/no-hardcoded-jsx-text -- reference tag rendered verbatim on all locales
            <p className="mt-1 text-xs text-muted-foreground">Ref: <code>{error.digest}</code></p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {dbDown ? (
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>{t("admin.dbStepDocker", currentLang)}</li>
              <li>
                {t("admin.dbStepPostgresPrefix", currentLang)}{" "}
                <code className="rounded bg-muted px-1">{DB_START_SCRIPT}</code> {t("admin.dbStepPostgresOr", currentLang)}{" "}
                <code className="rounded bg-muted px-1">{DOCKER_RUN_COMMAND}</code> {t("admin.dbStepPostgresSuffix", currentLang)}
              </li>
              <li>
                <code className="rounded bg-muted px-1">{DB_MIGRATE_COMMAND}</code> {t("admin.dbStepMigrateAndSeed", currentLang)}{" "}
                <code className="rounded bg-muted px-1">{DB_SEED_COMMAND}</code>
              </li>
              <li>{t("admin.dbStepReload", currentLang)}</li>
            </ol>
          ) : null}
          <Button type="button" onClick={() => reset()}>
            {t("admin.retry", currentLang)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

