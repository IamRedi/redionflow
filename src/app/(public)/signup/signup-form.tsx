"use client";

import { useState, useTransition } from "react";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/ui/use-hydrated";
import { t } from "@/lib/i18n";

import { signupAction } from "./actions";

type Mode = "baumdienst" | "bau" | "personal";

const PRODUCT_LABEL: Record<Mode, string> = {
  baumdienst: "BaumdienstFlow — Baumdienst",
  bau: "BauFlow — Bau",
  personal: "PersonalFlow — Personal",
};

export function SignupForm({ preselectedMode }: { preselectedMode: Mode }) {
  const { currentLang } = useLanguage();
  const hydrated = useHydrated();
  const [mode, setMode] = useState<Mode>(preselectedMode);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setFieldErrors({});
    startTransition(async () => {
      const result = await signupAction({
        displayName,
        legalName: legalName || displayName,
        mode,
        email,
        password,
        fullName,
      });
      if (result && !result.ok) {
        setMessage(result.message);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  function fieldError(name: string) {
    return fieldErrors[name]?.[0];
  }

  return (
    <form method="post" className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.product", currentLang)}</label>
        <select
          name="mode"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
        >
          {(Object.keys(PRODUCT_LABEL) as Mode[]).map((option) => (
            <option key={option} value={option}>
              {PRODUCT_LABEL[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.companyName", currentLang)}</label>
        <Input name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="organization" required />
        {fieldError("displayName") ? <p className="text-xs text-destructive">{fieldError("displayName")}</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.legalNameOptional", currentLang)}</label>
        <Input
          value={legalName}
          name="legalName"
          onChange={(event) => setLegalName(event.target.value)}
          placeholder={displayName || t("public.legalNamePlaceholder", currentLang)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.yourName", currentLang)}</label>
        <Input name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
        {fieldError("fullName") ? <p className="text-xs text-destructive">{fieldError("fullName")}</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("common.email", currentLang)}</label>
        <Input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        {fieldError("email") ? <p className="text-xs text-destructive">{fieldError("email")}</p> : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">{t("public.password", currentLang)}</label>
        <Input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          autoComplete="new-password"
          required
        />
        {fieldError("password") ? <p className="text-xs text-destructive">{fieldError("password")}</p> : null}
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <Button type="submit" disabled={!hydrated || isPending} className="w-full">
        {isPending ? t("public.signupPending", currentLang) : t("public.startFree", currentLang)}
      </Button>
    </form>
  );
}
