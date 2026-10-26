import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { isSaasMode } from "@/lib/saas-config";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "RediOnFlow - Sign up",
  description: "Start a 14-day trial of RediOnFlow. Pick a product and create your workspace.",
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (!isSaasMode) notFound();
  return <SignupPageAsync searchParams={searchParams} />;
}

async function SignupPageAsync({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const currentLang = await resolveRequestLanguage();
  const t = getTranslator(currentLang);
  const preselectedMode =
    params.mode === "bau" ? params.mode : "baumdienst";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("public.masterBrand")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("public.signupTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("public.signupDescription")}
        </p>
      </header>
      <SignupForm preselectedMode={preselectedMode} />
      <p className="text-xs text-muted-foreground">
        {t("public.signupTerms")}
      </p>
    </main>
  );
}
