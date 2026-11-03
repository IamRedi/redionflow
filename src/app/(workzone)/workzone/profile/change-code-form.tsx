"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

import { changeOwnLoginCodeAction } from "../hr-actions";

/** The worker's own code: current code, new code twice. Shown only to the worker. */
export function ChangeCodeForm({ currentLang }: { currentLang: string }) {
  const [state, action, pending] = useActionState(changeOwnLoginCodeAction, null);
  const field = (name: string, label: string) => (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Input name={name} type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" required className="h-11 text-base tracking-[0.3em]" />
    </label>
  );
  return (
    <details className="rounded-md border bg-muted/20 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
        <span>{t("workzone.changeCodeTitle", currentLang)}</span>
        <KeyRound className="size-4 text-muted-foreground" />
      </summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
        <p className="text-xs text-muted-foreground sm:col-span-3">{t("workzone.changeCodeHint", currentLang)}</p>
        {field("currentCode", t("workzone.changeCodeCurrent", currentLang))}
        {field("newCode", t("workzone.changeCodeNew", currentLang))}
        {field("repeatCode", t("workzone.changeCodeRepeat", currentLang))}
        <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-3">
          {state ? (
            <span role="status" className={state.ok ? "text-sm font-medium text-green-700 dark:text-green-300" : "text-sm font-medium text-amber-700 dark:text-amber-300"}>
              {state.message}
            </span>
          ) : null}
          <Button type="submit" size="sm" disabled={pending} className="h-10">
            {t("workzone.changeCodeSave", currentLang)}
          </Button>
        </div>
      </form>
    </details>
  );
}
