'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatPerson } from '@/lib/company-chat/contract';
import { CompanyChatProvider } from './CompanyChat';

/** Public role simulation has two existing, differently scoped signed cookies. */
export function DemoCompanyChat({ children }: { children: ReactNode }) {
  const pathname = usePathname(), office = pathname.startsWith('/demo/offices');
  if (pathname.startsWith('/demo/tv')) return children;
  return <ResolveActor key={String(office)} office={office}>{children}</ResolveActor>;
}
function ResolveActor({ office, children }: { office: boolean; children: ReactNode }) {
  const [actor, setActor] = useState<ChatPerson | null>(null);
  const resolve = useCallback(async () => {
    try {
      const response = await fetch(`${office ? '/api/demo/baumdienst/offices/chat' : '/api/demo/baumdienst/chat'}?demo=1&summary=1`, { cache: 'no-store' });
      if (!response.ok) { if ([403,404].includes(response.status)) setActor(null); return; }
      const { actor: next } = await response.json();
      setActor(previous => previous?.key === next.key && previous?.context === next.context ? previous : next);
    } catch { /* Preserve the selected person on temporary connection failure. */ }
  }, [office]);
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState === 'visible') void resolve(); };
    refresh(); const timer = setInterval(refresh, 30000);
    window.addEventListener('company-chat-profile-update', refresh); window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('company-chat-profile-update', refresh); window.removeEventListener('focus', refresh); };
  }, [resolve]);
  return <CompanyChatProvider actor={actor}>{children}</CompanyChatProvider>;
}
