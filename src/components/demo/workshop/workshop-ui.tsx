"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cloneElement, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

export const control = "h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const action = "min-h-11 whitespace-normal [&.bg-primary]:dark:text-black";
export function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div className="grid min-w-0 gap-1.5 text-sm font-medium"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}
export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tone === "green" && "border-emerald-700/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", tone === "amber" && "border-amber-700/30 bg-amber-500/10 text-amber-900 dark:text-amber-200", tone === "blue" && "border-blue-700/30 bg-blue-500/10 text-blue-800 dark:text-blue-200")}>{children}</span>;
}
export function WorkshopDialog({ title, description, children, open, onClose, closeLabel }: { title: string; description?: string; children: ReactNode; open: boolean; onClose: () => void; closeLabel: string }) {
  const previous = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[1200] bg-black/50" />
      <Dialog.Content onOpenAutoFocus={() => { previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (previous.current?.isConnected) { event.preventDefault(); previous.current.focus(); } }} className="fixed left-1/2 top-1/2 z-[1201] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3"><div className="min-w-0"><Dialog.Title className="break-words text-xl font-semibold tracking-tight">{title}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{description || "BaumdienstFlow · Demo"}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={closeLabel}><X /></Button></Dialog.Close></div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
