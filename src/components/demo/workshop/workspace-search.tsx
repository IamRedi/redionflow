"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { control } from "./workshop-ui";
import styles from "./workshop.module.css";

/** Collapsing also clears the filter, so no invisible query can hide records. */
export function WorkspaceSearch({ label, closeLabel, value, onChange }: { label: string; closeLabel: string; value: string; onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (expanded) input.current?.focus({ preventScroll: true }); }, [expanded]);
  function close() { onChange(""); setExpanded(false); trigger.current?.focus({ preventScroll: true }); }
  return <div className={styles.compactSearch} data-expanded={expanded}>
    <Button ref={trigger} variant="outline" className="size-11 shrink-0 rounded-full p-0" aria-label={label} title={label} aria-expanded={expanded} onClick={() => expanded ? close() : setExpanded(true)}><Search className="size-4" /></Button>
    {expanded && <div className={styles.searchField}><input ref={input} type="search" aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); close(); } }} className={control} /><Button variant="ghost" className="size-11 shrink-0 rounded-full p-0" aria-label={closeLabel} title={closeLabel} onClick={close}><X className="size-4" /></Button></div>}
  </div>;
}
