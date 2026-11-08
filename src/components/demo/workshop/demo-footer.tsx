import Link from "next/link";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { demoPrivacyCopy } from "@/lib/workshop/privacy-copy";

export function BaumdienstDemoFooter({ lang, onDark = false }: { lang: string; onDark?: boolean }) {
  const c = demoPrivacyCopy(lang);
  return <div className={`w-full border-t ${onDark ? "border-white/10 bg-[#10141d] text-[#aeb7c9]" : "bg-card text-muted-foreground"}`} data-testid="baumdienst-demo-footer"><nav aria-label={c.legal} className="flex flex-wrap items-center justify-center gap-x-3 px-3 pt-1 text-xs"><a href="https://www.baumdienstflow.de/impressum" className="inline-flex min-h-11 items-center rounded px-2 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.legal}</a><Link href="/demo/privacy" className="inline-flex min-h-11 items-center rounded px-2 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.privacy}</Link></nav><RediOnFooter compact onDark={onDark} /><p data-testid="baumdienst-product-mark" className="flex justify-end px-4 pb-2 text-[11px] font-semibold tracking-tight"><span className={onDark ? "text-white" : "text-foreground"}>Baumdienst</span><span className="relative ml-1 pr-2 text-brand-green">Flow<span className="absolute -right-0.5 -top-1 text-[8px] font-bold leading-none text-red-700 dark:text-red-400">26</span></span></p></div>;
}
