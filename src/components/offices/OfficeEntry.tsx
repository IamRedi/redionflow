import Link from 'next/link';
import { Building2, ArrowUpRight } from 'lucide-react';
import { currentOfficeAccess } from '@/lib/offices/access';
import { officeCopy } from '@/lib/offices/copy';
import type { SupportedLanguage } from '@/lib/i18n/language';

export async function OfficeEntry({ lang,compact=false }: { lang: SupportedLanguage;compact?:boolean }) {
  if (!await currentOfficeAccess()) return null;
  return <Link href="/workzone/offices/me" aria-label={lang==='sq'?'Zyra ime':'My office'} data-testid={compact?"office-header-entry":"office-entry"} className={compact?"inline-flex size-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border bg-background/80 text-[9px] font-medium transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring":"inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"}>
    <Building2 size={18} /><span>{officeCopy(lang).offices}</span>{!compact&&<ArrowUpRight size={15} className="text-muted-foreground" />}
  </Link>;
}
