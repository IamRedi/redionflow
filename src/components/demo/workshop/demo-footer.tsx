import Link from "next/link";
import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { demoPrivacyCopy } from "@/lib/workshop/privacy-copy";
import styles from "./demo-footer.module.css";

export function BaumdienstDemoFooter({ lang, onDark = false }: { lang: string; onDark?: boolean }) {
  const c = demoPrivacyCopy(lang);
  return <div className={styles.row} data-testid="baumdienst-demo-footer"><nav aria-label={c.legal}><a href="https://www.baumdienstflow.de/impressum">{c.legal}</a><Link href="/demo/privacy">{c.privacy}</Link></nav><RediOnFooter compact onDark={onDark} /><p data-testid="baumdienst-product-mark" className={styles.mark}><span>Baumdienst</span><span className="relative ml-1 pr-2 text-brand-green">Flow<span className="absolute -right-0.5 -top-1 text-[8px] font-bold leading-none text-red-700 dark:text-red-400">26</span></span></p></div>;
}
