"use client";

import { Barcode, Camera, Nfc, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inventoryCopy } from "@/lib/workshop/inventory-copy";
import { workshopCopy } from "@/lib/workshop/copy";
import { WorkshopDialog } from "./workshop-ui";

export function RegistrationEntry({ lang, onClose, onManual, onScan }: { lang: string; onClose: () => void; onManual: () => void; onScan: (mode: "manual" | "camera" | "nfc") => void }) {
  const c = workshopCopy(lang), i = inventoryCopy(lang);
  return <WorkshopDialog open title={c.register} description={i.tagHint} closeLabel={c.close} onClose={onClose}>
    <div className="grid gap-2">
      <Button variant="outline" className="min-h-14 justify-start gap-3 rounded-xl px-4" onClick={onManual}><Barcode className="size-5 shrink-0" /><span className="flex-1 text-left">{i.manual}</span><ArrowRight className="size-4 shrink-0" /></Button>
      <Button variant="outline" className="min-h-14 justify-start gap-3 rounded-xl px-4" onClick={() => onScan("camera")}><Camera className="size-5 shrink-0" /><span className="flex-1 text-left">{i.camera}</span><ArrowRight className="size-4 shrink-0" /></Button>
      <Button variant="outline" className="min-h-14 justify-start gap-3 rounded-xl px-4" onClick={() => onScan("nfc")}><Nfc className="size-5 shrink-0" /><span className="flex-1 text-left">{i.nfc}</span><ArrowRight className="size-4 shrink-0" /></Button>
    </div>
    <Button variant="ghost" className="mt-3 min-h-11" onClick={() => onScan("manual")}>{i.find}</Button>
  </WorkshopDialog>;
}
