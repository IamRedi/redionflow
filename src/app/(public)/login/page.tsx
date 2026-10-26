import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { isSaasMode } from "@/lib/saas-config";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "RediOnFlow - Login",
};

export default async function LoginPage() {
  if (!isSaasMode) notFound();
  const currentLang = await resolveRequestLanguage();
  const t = getTranslator(currentLang);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("public.masterBrand")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("public.loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("public.loginDescription")}
        </p>
      </header>
      <LoginForm />
      <p className="text-xs text-muted-foreground">
        {t("public.noAccount")} <a className="underline" href="/signup">{t("public.startFree")}</a>
      </p>
    </main>
  );
}
