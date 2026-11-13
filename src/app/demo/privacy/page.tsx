import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Database, Globe, Image, Server, ShieldCheck, Sparkles } from "lucide-react";
import { resolveRequestLanguage } from "@/lib/i18n/server";
import { demoAIPrivacyCopy, demoPrivacyCopy, demoWoodPrivacyCopy, demoOfficePrivacyCopy } from "@/lib/workshop/privacy-copy";
import { requireWorkshopDemo, SharedWorkshopError } from "@/lib/workshop/shared-store";

export const metadata = { title: "Demo · Datenschutz / Privacy · BaumdienstFlow", robots: { index: false, follow: false } };
const reviewLabel = "13.11.2026 · BaumdienstFlow Demo";
export default async function DemoPrivacyPage() {
  try { await requireWorkshopDemo(); } catch (error) { if (error instanceof SharedWorkshopError && error.status === 404) notFound(); throw error; }
  const lang = await resolveRequestLanguage(), c = demoPrivacyCopy(lang);
  return <article className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 sm:p-8"><Link href="/demo/workshop" className="inline-flex min-h-11 items-center gap-2 rounded text-sm text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />{c.back}</Link><h1 className="mt-4 text-2xl font-semibold tracking-tight">{c.title}</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.scope}</p><p className="mt-2 text-xs text-muted-foreground">{reviewLabel}</p><div className="mt-7 space-y-6">{([ [Globe, c.public], [Database, c.storage], [Image, c.photos], [Server, c.services], [Sparkles, demoAIPrivacyCopy(lang)], [Database, demoWoodPrivacyCopy(lang)], [ShieldCheck, demoOfficePrivacyCopy(lang)], [ShieldCheck, c.contact] ] as const).map(([Icon, text], i) => <div key={i} className="flex gap-3"><Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm leading-relaxed">{text}</p></div>)}</div><a href="https://www.baumdienstflow.de/impressum" className="mt-5 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">{c.legal}</a></article>;
}
