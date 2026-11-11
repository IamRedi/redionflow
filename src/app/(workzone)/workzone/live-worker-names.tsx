"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** "Arben Dervishi" → "Arben" so two or three names fit on a site card; the list shows full names. */
export function shortWorkerName(full: string) {
  return full.trim().split(/\s+/)[0] ?? "";
}

/**
 * The people working on a site, in green: the first few by name, the rest as
 * "+N". Hovering (mouse) or tapping the names opens the full list. The list is
 * portalled to the body so card overflow, transforms and drag never clip it.
 */
export function LiveWorkerNames({ names, max = 3, className = "" }: { names: string[]; max?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Live cards bob up and down; a short grace period keeps the list from flickering.
  const lastPointer = useRef("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; setOpen(true); };
  const closeSoon = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 350); };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 220;
      setPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: rect.bottom + 4 });
    };
    place();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchor.current?.contains(target) || list.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (names.length === 0) return null;
  const shown = names.slice(0, max).map(shortWorkerName);
  const rest = names.length - shown.length;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        data-testid="live-worker-names"
        aria-expanded={open}
        title={names.join(", ")}
        className={`flex w-full min-w-0 items-center gap-1 text-left text-[11px] font-medium text-green-600 dark:text-green-400 ${className}`}
        onPointerDown={(event) => { lastPointer.current = event.pointerType; event.stopPropagation(); }}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") keepOpen(); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") closeSoon(); }}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (lastPointer.current === "mouse") keepOpen(); else setOpen((value) => !value); }}
      >
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-green-500" />
        <span className="min-w-0 truncate">{shown.join(", ")}</span>
        {rest > 0 ? <span className="shrink-0 rounded-full bg-green-500/15 px-1.5 text-[10px] font-semibold tabular-nums">+{rest}</span> : null}
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={list}
              role="dialog"
              data-testid="live-worker-names-list"
              style={{ left: pos.left, top: pos.top }}
              className="fixed z-[1300] w-[220px] rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg"
              onPointerEnter={keepOpen}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") closeSoon(); }}
            >
              <ul className="max-h-64 space-y-0.5 overflow-y-auto text-xs">
                {names.map((name, index) => (
                  <li key={`${name}-${index}`} className="flex items-center gap-2 rounded-md px-2 py-1">
                    <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                    <span className="min-w-0 truncate">{name}</span>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
