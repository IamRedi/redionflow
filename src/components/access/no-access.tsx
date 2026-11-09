import { KeyRound } from 'lucide-react';
import Link from 'next/link';

import { accessCopy } from '@/lib/access/copy';
import { resolveRequestLanguage } from '@/lib/i18n/server';

/** Plain message instead of an error page: the boss gives access with the key button. */
export async function NoAccessHere({ backHref }: { backHref: string }) {
  const c = accessCopy(await resolveRequestLanguage());
  return <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm" data-testid="no-access">
    <KeyRound className="mx-auto size-8 text-orange-600 dark:text-orange-400" />
    <p className="mt-3 text-base font-semibold">{c.denied}</p>
    <Link href={backHref} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold hover:bg-muted">{c.close}</Link>
  </div>;
}
