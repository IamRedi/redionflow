"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function SimpleDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  confirmVariant = "default",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string | null;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: "default" | "outline" | "secondary" | "destructive";
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={value => { if (!value) onCancel(); }}>
      <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1800] bg-black/45" />
      <Dialog.Content data-studio-dialog data-testid="simple-dialog"
        onOpenAutoFocus={event => {
          event.preventDefault();
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          cancel.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
        }}
        onPointerDownOutside={event => event.preventDefault()}
        className="fixed left-1/2 top-1/2 z-[1801] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-md border bg-background p-4 shadow-xl outline-none">
        <div className="space-y-1">
          <Dialog.Title asChild><h3 className="text-sm font-semibold">{title}</h3></Dialog.Title>
          {description ? <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description> : null}
        </div>

        {children ? <div className="mt-3">{children}</div> : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button ref={cancel} type="button" className="min-h-11" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" className="min-h-11" variant={confirmVariant} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
