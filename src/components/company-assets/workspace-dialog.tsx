"use client";

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode, type RefObject } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { assetCopy } from './copy';

export function AssetWorkspaceDialog({ open, onOpenChange, title, children, scrollBody = false, layer = 1500, returnFocusRef, fullScreen = false, compact=false }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
  scrollBody?: boolean; layer?: number; returnFocusRef?: RefObject<HTMLElement | null>;
  fullScreen?: boolean;
  compact?:boolean;
}) {
  const { currentLang } = useLanguage();
  const c = assetCopy(currentLang);
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay style={{ zIndex: layer }} className="fixed inset-0 bg-black/50" />
      <Dialog.Content aria-describedby={undefined} style={{ zIndex: layer + 1 }}
        onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const target = returnFocusRef?.current?.isConnected ? returnFocusRef.current : opener.current;
          if (target?.isConnected) target.focus({ preventScroll: true });
        }}
        className={`fixed flex min-h-0 min-w-0 flex-col bg-background text-foreground outline-none ${compact?'left-1/2 top-1/2 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border shadow-xl':`inset-0 h-[100dvh] ${fullScreen?'':'sm:inset-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:border sm:shadow-xl'}`}`}>
        <div className="flex shrink-0 items-center gap-3 px-3 py-2 sm:px-5">
          <Dialog.Title className="min-w-0 flex-1 break-words text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close aria-label={c.close} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X size={20} /></Dialog.Close>
        </div>
        <div className={scrollBody ? 'no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5' : 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'}>{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
