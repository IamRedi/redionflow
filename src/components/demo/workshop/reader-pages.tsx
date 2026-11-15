"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { atlasText } from "@/lib/workshop/atlas";
import { Button } from "@/components/ui/button";

export function ReaderPager({ index, count, onChange }: { index: number; count: number; onChange: (index: number) => void }) {
  const { currentLang } = useLanguage();
  return <div className="baum-reader-pager"><Button type="button" variant="outline" size="icon" disabled={!index} aria-label={atlasText("Vorherige Seite|Faqja e mëparshme|Previous page|Pagina precedente|Poprzednia strona|Pagina anterioară", currentLang)} onClick={() => onChange(index - 1)}><ChevronLeft /></Button><span role="status">{index + 1} / {count}</span><Button type="button" variant="outline" size="icon" disabled={index >= count - 1} aria-label={atlasText("Nächste Seite|Faqja tjetër|Next page|Pagina successiva|Następna strona|Pagina următoare", currentLang)} onClick={() => onChange(index + 1)}><ChevronRight /></Button></div>;
}

/** Long originals remain available in bounded pages rather than clipped text. */
export function ReaderText({ text }: { text: string }) {
  const [page, setPage] = useState(0), [budget, setBudget] = useState(72), [columns, setColumns] = useState(20), frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!frame.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { const { width, height } = entry.contentRect; const cols = Math.max(1, Math.floor(width / 9)), lines = Math.max(1, Math.floor((height - 60) / 22)); setColumns(cols); setBudget(Math.max(12, Math.min(600, cols * lines))); });
    observer.observe(frame.current); return () => observer.disconnect();
  }, []);
  const chars = Array.from(text), pages: string[] = [];
  while (chars.length) {
    let end = 0, used = 0;
    while (end < chars.length) { const cost = chars[end] === "\n" ? columns : 1; if (end && used + cost > budget) break; used += cost; end++; }
    if (end < chars.length) { const space = chars.slice(0, end).lastIndexOf(" "); if (space > end * .65) end = space + 1; }
    pages.push(chars.splice(0, end).join(""));
  }
  const current = Math.min(page, Math.max(0, pages.length - 1));
  return <div ref={frame} className="baum-reader-text"><p>{pages[current] || "—"}</p>{pages.length > 1 && <ReaderPager index={current} count={pages.length} onChange={setPage} />}</div>;
}
