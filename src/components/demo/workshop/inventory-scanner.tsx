"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inventoryCopy } from "@/lib/workshop/inventory-copy";
import { resolveInventoryTag } from "@/lib/workshop/inventory-flow";
import type { WorkshopAsset } from "@/lib/workshop/demo-model";
import { action, control, Field, WorkshopDialog } from "./workshop-ui";

type Reader = { scan(options: { signal: AbortSignal }): Promise<void>; onreading: ((e: { message?: { records: { recordType: string; encoding?: string; data?: BufferSource }[] } }) => void) | null; onreadingerror: (() => void) | null };
const exampleInventoryCode = "WG-102";
export function InventoryScanner({ assets, lang, closeLabel, onFound, onClose }: { assets: WorkshopAsset[]; lang: string; closeLabel: string; onFound: (asset: WorkshopAsset) => void; onClose: () => void }) {
  const c = inventoryCopy(lang);
  const [code, setCode] = useState(""), [mode, setMode] = useState<"manual" | "camera" | "nfc">("manual"), [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null), abort = useRef<AbortController | null>(null);
  const found = useRef(false), detect = useRef<(value: string) => void>(() => {});
  const stopNfc = useCallback(() => { abort.current?.abort(); abort.current = null; }, []);
  useEffect(() => { detect.current = value => {
    if (found.current) return;
    const asset = resolveInventoryTag(value, assets, window.location.origin);
    stopNfc(); setMode("manual");
    if (!asset) { setCode(value.slice(0, 2048)); setError(c.unknownCode); return; }
    found.current = true; onFound(asset);
  }; }, [assets, onFound, c.unknownCode, stopNfc]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { abort.current?.abort(); setMode("manual"); } };
    document.addEventListener("visibilitychange", hide);
    return () => { abort.current?.abort(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;
    let controls: { stop(): void } | undefined;
    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        const active = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current, (result, _error, scanner) => {
          if (!cancelled && result) { scanner.stop(); detect.current(result.getText()); }
        });
        controls = active;
        if (cancelled) active.stop();
      } catch { if (!cancelled) { setError(c.scanError); setMode("manual"); } }
    })();
    return () => { cancelled = true; controls?.stop(); };
  }, [mode, c.scanError]);
  async function startNfc() {
    stopNfc(); setError(""); setMode("nfc");
    const Ctor = (window as Window & { NDEFReader?: new () => Reader }).NDEFReader;
    if (!Ctor) { setError(c.nfcUnsupported); setMode("manual"); return; }
    const controller = new AbortController(); abort.current = controller;
    try {
      const reader = new Ctor();
      reader.onreading = e => {
        if (controller.signal.aborted) return;
        for (const record of e.message?.records ?? []) {
          if (!["text", "url"].includes(record.recordType) || !record.data) continue;
          try { detect.current(new TextDecoder(record.encoding || "utf-8").decode(record.data)); return; } catch { /* Try another readable NDEF record. */ }
        }
        setError(c.unknownCode); stopNfc(); setMode("manual");
      };
      reader.onreadingerror = () => { if (!controller.signal.aborted) { setError(c.scanError); stopNfc(); setMode("manual"); } };
      await reader.scan({ signal: controller.signal });
    } catch { if (!controller.signal.aborted) { setError(c.scanError); stopNfc(); setMode("manual"); } }
  }
  return <WorkshopDialog open title={c.scanTitle} description={c.tagHint} closeLabel={closeLabel} onClose={onClose}>
    <div className="space-y-4">
      {mode === "camera" && <video ref={video} muted playsInline className="aspect-[4/3] w-full rounded-xl border bg-black object-cover" />}
      {mode === "nfc" && <p role="status" className="rounded-xl border bg-muted/30 p-4 text-sm">{c.nfcReady}</p>}
      <form className="grid gap-3" onSubmit={e => { e.preventDefault(); detect.current(code); }}><Field label={c.codeInput}><input className={control} value={code} onChange={e => { setCode(e.target.value); setError(""); }} maxLength={2048} autoComplete="off" autoCapitalize="characters" placeholder={exampleInventoryCode} /></Field><Button className={action} disabled={!code.trim()}>{c.find}</Button></form>
      <div className="grid grid-cols-2 gap-3"><Button type="button" variant="outline" className={action} onClick={() => { stopNfc(); setError(""); setMode(mode === "camera" ? "manual" : "camera"); }} aria-pressed={mode === "camera"}><Camera />{c.camera}</Button><Button type="button" variant="outline" className={action} onClick={() => void startNfc()} aria-pressed={mode === "nfc"}><Nfc />{c.nfc}</Button></div>
      {error && <p role="alert" className="rounded-xl border border-amber-600 p-3 text-sm">{error}</p>}
    </div>
  </WorkshopDialog>;
}
