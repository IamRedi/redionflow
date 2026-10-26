"use client";

import { type ReactNode } from "react";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-md border bg-background p-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        {children ? <div className="mt-3">{children}</div> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
