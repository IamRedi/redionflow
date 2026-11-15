"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";

const controls = 'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
function focusable(element: Element) { return Array.from(element.querySelectorAll<HTMLElement>(controls)).filter(node => !node.closest('[inert],[aria-hidden="true"]') && node.getClientRects().length); }

/** Fixed-size cards, responsive columns, bounded DOM; record state belongs to the caller. */
export function WindowedGrid<T>({ items, itemKey, renderItem, pinnedKeys = [], revealKey, label, testId = "windowed-grid", columnsClass = "baum-window-columns", cardHeight = "17rem", onNavigate }: {
  items: T[]; itemKey: (item: T) => string; renderItem: (item: T) => ReactNode;
  pinnedKeys?: string[]; revealKey?: string | null; label: string; testId?: string; columnsClass?: string; cardHeight?: string; onNavigate?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null), probe = useRef<HTMLDivElement>(null), pendingFocus = useRef<{ index: number; last: boolean } | null>(null);
  const [, commitNavigation] = useState(0);
  const [geometry, setGeometry] = useState({ columns: 1, stride: 284 }), [focused, setFocused] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => { if (!probe.current) return; const style = getComputedStyle(probe.current); const columns = style.gridTemplateColumns.split(" ").length; const stride = probe.current.getBoundingClientRect().height + parseFloat(style.rowGap || "12"); setGeometry(old => old.columns === columns && old.stride === stride ? old : { columns, stride }); };
    measure(); const observer = new ResizeObserver(measure); if (probe.current) observer.observe(probe.current); return () => observer.disconnect();
  }, []);
  const pinnedRows = pinnedKeys.map(key => items.findIndex(item => itemKey(item) === key)).filter(index => index >= 0).map(index => Math.floor(index / geometry.columns));
  if (focused !== null && focused < items.length) pinnedRows.push(Math.floor(focused / geometry.columns));
  const virtual = useVirtualizer({ count: Math.ceil(items.length / geometry.columns), getScrollElement: () => root.current, estimateSize: () => geometry.stride, overscan: 1, getItemKey: index => itemKey(items[index * geometry.columns]), rangeExtractor: range => [...new Set([...defaultRangeExtractor(range), ...pinnedRows])].sort((a, b) => a - b) });
  const windows = virtual.getVirtualItems();
  useLayoutEffect(() => { virtual.measure(); }, [geometry.stride, geometry.columns, virtual]);
  function focusRecord(index: number, last = false) {
    onNavigate?.(); pendingFocus.current = { index, last }; commitNavigation(value => value + 1); virtual.scrollToIndex(Math.floor(index / geometry.columns), { align: "auto" });

  }
  useLayoutEffect(() => { if (!pendingFocus.current) return; const frame = requestAnimationFrame(() => { const target = pendingFocus.current; if (!target) return; const node = root.current?.querySelector(`[data-window-index="${target.index}"]`); if (node) { const targets = focusable(node), control = target.last ? targets.at(-1) : targets[0]; if (control) { control.focus({ preventScroll: true }); pendingFocus.current = null; } } }); return () => cancelAnimationFrame(frame); });
  const revealIndex = revealKey ? items.findIndex(item => itemKey(item) === revealKey) : -1;
  useLayoutEffect(() => { if (revealIndex >= 0) virtual.scrollToIndex(Math.floor(revealIndex / geometry.columns), { align: "auto" }); }, [revealKey, revealIndex, geometry.columns, virtual]);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement, record = target.closest<HTMLElement>("[data-window-index]");
    if (target.matches("input,textarea,select") || !items.length) return;
    const index = record ? Number(record.dataset.windowIndex) : 0;
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); focusRecord(event.key === "Home" ? 0 : items.length - 1); }
    else if (event.key === "Tab" && record) { const targets = focusable(record); const edge = event.shiftKey ? targets[0] : targets.at(-1); const next = index + (event.shiftKey ? -1 : 1); if (target === edge && next >= 0 && next < items.length) { event.preventDefault(); focusRecord(next, event.shiftKey); } }
  }
  return <div ref={root} className="baum-windowed-grid" data-testid={testId} data-total-items={items.length} data-columns={geometry.columns} role="list" aria-label={label} tabIndex={0} onKeyDown={keyboard} onFocusCapture={event => { const row = (event.target as HTMLElement).closest<HTMLElement>("[data-window-index]"); if (row) setFocused(Number(row.dataset.windowIndex)); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(null); }}>
    <div ref={probe} className={`baum-window-probe ${columnsClass}`} aria-hidden="true" style={{ height: cardHeight }}>{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
    <div className="baum-window-canvas" style={{ height: Math.max(0, virtual.getTotalSize() - 12) }}>
      {windows.map(row => <div key={row.key} className="baum-window-row" style={{ transform: `translateY(${row.start}px)`, gridTemplateColumns: `repeat(${geometry.columns},minmax(0,1fr))`, height: `calc(${cardHeight})` }}>{items.slice(row.index * geometry.columns, (row.index + 1) * geometry.columns).map((item, offset) => { const index = row.index * geometry.columns + offset; return <div key={itemKey(item)} data-window-index={index} className="baum-window-item" role="listitem" aria-posinset={index + 1} aria-setsize={items.length}>{renderItem(item)}</div>; })}</div>)}
    </div>
  </div>;
}
