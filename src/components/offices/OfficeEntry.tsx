import Link from 'next/link';
import { Building2, ArrowUpRight } from 'lucide-react';
import { currentOfficeAccess } from '@/lib/offices/access';
import { officeCopy } from '@/lib/offices/copy';
import type { SupportedLanguage } from '@/lib/i18n/language';

export async function OfficeEntry({ lang }: { lang: SupportedLanguage }) {
  if (!await currentOfficeAccess()) return null;
  return <Link href="/workzone/offices" data-testid="office-entry" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
    <Building2 size={18} /><span>{officeCopy(lang).offices}</span><ArrowUpRight size={15} className="text-muted-foreground" />
  </Link>;
}
