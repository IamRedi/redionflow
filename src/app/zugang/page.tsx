import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MonitorPlay, Shield, UserRound } from "lucide-react";

import { getTranslator } from "@/lib/i18n";
import { resolveRequestLanguage } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Interner Zugang",
  robots: {
    index: false,
    follow: false,
  },
};

function AccessCard({
  href,
  title,
  text,
  icon: Icon,
}: {
  href: string;
  title: string;
  text: string;
  icon: typeof Shield;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-border/80 bg-background/85 p-5 shadow-sm shadow-emerald-950/5 transition hover:border-emerald-500/20 hover:bg-background"
    >
      <span className="inline-flex rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-5" />
      </span>
      <div className="mt-4 text-lg font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </Link>
  );
}

export default async function AccessPage() {
  const currentLang = await resolveRequestLanguage();
  const t = getTranslator(currentLang);

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-5 py-12 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("admin.internalAccess")}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("admin.testLoginTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("admin.testLoginDescription")}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("common.back")}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <AccessCard
          href="/admin-login"
          title={t("admin.adminAccessCardTitle")}
          text={t("admin.adminAccessCardText")}
          icon={Shield}
        />
        <AccessCard
          href="/workzone/login"
          title={t("admin.workzoneAccessCardTitle")}
          text={t("admin.workzoneAccessCardText")}
          icon={UserRound}
        />
        <AccessCard
          href="/display-login"
          title={t("admin.displayAccessCardTitle")}
          text={t("admin.displayAccessCardText")}
          icon={MonitorPlay}
        />
      </div>
    </main>
  );
}
