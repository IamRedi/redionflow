'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { ChatPerson } from '@/lib/company-chat/contract';
import { CompanyChatProvider } from './CompanyChat';

/** Public role simulation has two existing, differently scoped signed cookies. */
export function DemoCompanyChat({ children }: { children: ReactNode }) {
  const pathname = usePathname(), office = pathname.startsWith('/demo/offices');
  return <ResolveActor office={office} enabled={!pathname.startsWith('/demo/tv')}>{children}</ResolveActor>;
}
function ResolveActor({ office, enabled, children }: { office: boolean; enabled: boolean; children: ReactNode }) {
  const [resolved, setResolved] = useState<{ office: boolean; actor: ChatPerson } | null>(null);
  const resolve = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch(`${office ? '/api/demo/baumdienst/offices/chat' : '/api/demo/baumdienst/chat'}?demo=1&summary=1`, { cache: 'no-store', signal });
      if (!response.ok) { if (!signal.aborted && [403,404].includes(response.status)) setResolved(null); return; }
      const { actor: next } = await response.json();
      if (!signal.aborted) setResolved(previous => previous?.office === office && previous.actor.key === next.key && previous.actor.context === next.context ? previous : { office, actor: next });
    } catch { /* Preserve the selected person on temporary connection failure. */ }
  }, [office]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const refresh = () => { if (!controller.signal.aborted && document.visibilityState === 'visible') void resolve(controller.signal); };
    refresh(); const timer = setInterval(refresh, 30000);
    window.addEventListener('company-chat-profile-update', refresh); window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('company-chat-profile-update', refresh); window.removeEventListener('focus', refresh); };
  }, [enabled, resolve]);
  // Field/office cookies keep their existing scopes. Disable the old context
  // immediately, but keep the application tree stable across scene navigation.
  const actor = enabled && resolved?.office === office ? resolved.actor : null;
  return <CompanyChatProvider actor={actor}>{children}</CompanyChatProvider>;
}
