'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Package, Truck, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { t } from '@/lib/i18n';
import { assetCopy } from './copy';

export function MusterOperationsNavigation({ admin, warehouse, workshop, office }: { admin: boolean; warehouse: boolean; workshop: boolean; office: ReactNode }) {
  const path = usePathname(), { currentLang: lang } = useLanguage(), c = assetCopy(lang);
  const links = [
    { href: '/workzone', label: t('workzone.title', lang), Icon: Home, visible: true },
    { href: '/app/dashboard', label: t('workzone.admin', lang), Icon: LayoutDashboard, visible: admin },
    { href: '/workzone/workshop', label: c.workshop, Icon: Wrench, visible: workshop },
    { href: '/workzone/inventory', label: c.warehouse, Icon: Package, visible: warehouse },
    { href: '/workzone/fleet', label: t('workzone.fleet', lang), Icon: Truck, visible: true },
  ];
  return <nav data-testid="muster-operations-nav" aria-label={t('workzone.title', lang)} className="flex min-w-0 flex-wrap items-center gap-2">
    {links.filter(link => link.visible).map(({ href, label, Icon }) => <Link key={href} href={href} title={label} aria-label={label} aria-current={path === href ? 'page' : undefined} className="musterOperationLink inline-flex size-11 shrink-0 items-center justify-center rounded-full border outline-none transition focus-visible:ring-2 focus-visible:ring-ring"><Icon size={19} aria-hidden="true" /></Link>)}
    {office}
  </nav>;
}
