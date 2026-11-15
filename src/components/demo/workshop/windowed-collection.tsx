"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";

/** Small collections keep native layout. Long variable-height collections share the existing workspace scroll. */
export function WindowedCollection<T>(props: { items: T[]; itemKey: (item: T) => string; renderItem: (item: T) => ReactNode; className: string; scrollRef: RefObject<HTMLDivElement | null>; pinnedKey?: string; empty?: ReactNode }) {
  return props.items.length > 48 ? <LargeCollection {...props} /> : <div className={props.className}>{props.items.map(item => <div className="contents" key={props.itemKey(item)}>{props.renderItem(item)}</div>)}{!props.items.length && props.empty}</div>;
}
function LargeCollection<T>({ items, itemKey, renderItem, className, scrollRef, pinnedKey }: Parameters<typeof WindowedCollection<T>>[0]) {
  const root = useRef<HTMLDivElement>(null), probe = useRef<HTMLDivElement>(null), pendingFocus = useRef<number | null>(null);
  const [layout, setLayout] = useState({ columns: 1, template: "1fr", gap: 12, margin: 0 }), [focused, setFocused] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => { if (!probe.current || !root.current || !scrollRef.current) return; const style = getComputedStyle(probe.current), template = style.gridTemplateColumns, columns = template.split(" ").length, gap = parseFloat(style.rowGap) || 12, margin = root.current.getBoundingClientRect().top - scrollRef.current.getBoundingClientRect().top + scrollRef.current.scrollTop; setLayout(old => old.columns === columns && old.template === template && old.gap === gap && Math.abs(old.margin - margin) < 1 ? old : { columns, template, gap, margin }); };
    measure(); const observer = new ResizeObserver(measure); if (probe.current) observer.observe(probe.current); if (scrollRef.current) observer.observe(scrollRef.current); return () => observer.disconnect();
  }, [scrollRef]);
  const pinned = items.findIndex(item => itemKey(item) === pinnedKey), pinnedRows = [pinned, focused ?? -1].filter(index => index >= 0 && index < items.length).map(index => Math.floor(index / layout.columns));
  const virtual = useVirtualizer({ count: Math.ceil(items.length / layout.columns), getScrollElement: () => scrollRef.current, estimateSize: () => 360, gap: layout.gap, scrollMargin: layout.margin, overscan: 1, getItemKey: index => itemKey(items[index * layout.columns]), rangeExtractor: range => [...new Set([...defaultRangeExtractor(range), ...pinnedRows])].sort((a,b) => a-b) });
  useLayoutEffect(() => { virtual.measure(); }, [layout.columns, layout.template, virtual]);
  function reveal(index: number) { pendingFocus.current = index; virtual.scrollToIndex(Math.floor(index / layout.columns), { align: "auto" }); }
  useLayoutEffect(() => { if (pendingFocus.current === null) return; const node = root.current?.querySelector<HTMLElement>(`[data-collection-index="${pendingFocus.current}"] button:not(:disabled),[data-collection-index="${pendingFocus.current}"] a[href]`); if (node) { node.focus({ preventScroll: true }); pendingFocus.current = null; } });
  return <div ref={root} className="baum-large-collection" data-windowed-collection data-total-items={items.length} tabIndex={0} onFocusCapture={event => { const node = (event.target as HTMLElement).closest<HTMLElement>("[data-collection-index]"); if (node) setFocused(Number(node.dataset.collectionIndex)); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(null); }} onKeyDown={event => {
    const target = event.target as HTMLElement; if (target.matches("input,textarea,select")) return;
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); reveal(event.key === "Home" ? 0 : items.length - 1); }
    if (event.key === "Tab") { const record = target.closest<HTMLElement>("[data-collection-index]"); if (!record) return; const controls = [...record.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')].filter(node => !node.closest('[inert],[aria-hidden="true"]') && node.getClientRects().length); const next = Number(record.dataset.collectionIndex) + (event.shiftKey ? -1 : 1); if (target === (event.shiftKey ? controls[0] : controls.at(-1)) && next >= 0 && next < items.length && !root.current?.querySelector(`[data-collection-index="${next}"]`)) { event.preventDefault(); reveal(next); } }
  }}>
    <div ref={probe} className={`baum-collection-probe ${className}`} aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
    <div style={{ position: "relative", height: virtual.getTotalSize(), width: "100%" }}>{virtual.getVirtualItems().map(row => <div key={row.key} ref={virtual.measureElement} data-index={row.index} className="baum-collection-row" style={{ display: "grid", gridTemplateColumns: layout.template, gap: layout.gap, transform: `translateY(${row.start - layout.margin}px)` }}>{items.slice(row.index * layout.columns, (row.index + 1) * layout.columns).map((item, offset) => <div key={itemKey(item)} data-collection-index={row.index * layout.columns + offset} style={{ minWidth: 0 }}>{renderItem(item)}</div>)}</div>)}</div>
  </div>;
}
