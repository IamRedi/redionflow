"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { loginAdminAction } from "./actions";

export function AdminLoginForm() {
  const { currentLang } = useLanguage();
  const [state, formAction, isPending] = useActionState(loginAdminAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("admin.adminEmail", currentLang)}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" placeholder={t("admin.adminEmailPlaceholder", currentLang)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("admin.adminPassword", currentLang)}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" maxLength={200} />
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" disabled={isPending} className="w-full">
        <ShieldCheck className="size-4" />
        {isPending ? t("admin.loginChecking", currentLang) : t("admin.adminLoginSubmit", currentLang)}
      </Button>
    </form>
  );
}
