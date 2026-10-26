"use client";

import { useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { t } from "@/lib/i18n";

import { loginAction } from "./actions";

export function LoginForm() {
  const { currentLang } = useLanguage();
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    startTransition(async () => {
      const result = await loginAction({ email, password, lang: currentLang });
      if (result && !result.ok) setMessage(result.message);
    });
  }

  return (
    <form method="post" className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("common.email", currentLang)}</label>
        <Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.password", currentLang)}</label>
        <Input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <Button type="submit" disabled={!hydrated || isPending} className="w-full">
        {isPending ? t("public.loginPending", currentLang) : t("public.loginTitle", currentLang)}
      </Button>
    </form>
  );
}
