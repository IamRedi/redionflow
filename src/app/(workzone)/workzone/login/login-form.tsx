"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { loginWorkerAction } from "../hr-actions";

export function WorkerLoginForm() {
  const { currentLang } = useLanguage();
  const [state, formAction, isPending] = useActionState(loginWorkerAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("form.name", currentLang)}</Label>
        <Input id="name" name="name" autoComplete="given-name" placeholder={t("form.workerNamePlaceholder", currentLang)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loginCode">{t("form.loginCodePlaceholder", currentLang)}</Label>
        <Input id="loginCode" name="loginCode" inputMode="numeric" maxLength={6} placeholder={t("form.loginCodeExample", currentLang)} />
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        <LogIn className="size-4" />
        {isPending ? t("form.loginPending", currentLang) : t("form.loginToProfile", currentLang)}
      </Button>
    </form>
  );
}
