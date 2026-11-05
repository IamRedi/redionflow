"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarcodeLabel } from "@/components/inventory/barcode-label";

const printStyles=`@media print { body:has([data-label-print]) * { visibility: hidden; } body:has([data-label-print]) [data-label-print], body:has([data-label-print]) [data-label-print] * { visibility: visible; } [data-label-print] { position: absolute; inset: 0 auto auto 0; width: 90mm; padding: 4mm; border: 0; } }`;
const companyLabel="BaumdienstFlow · Musterfirma";
export function PrintAssetLabel({ name, code, serial, label }: { name: string; code: string; serial?: string; label: string }) {
  return <div className="mx-auto max-w-xl space-y-5"><Button className="min-h-11 print:hidden" onClick={() => window.print()}><Printer className="size-4" />{label}</Button><div data-label-print className="rounded-2xl border bg-white p-4 text-black"><p className="mb-3 text-xs font-bold tracking-widest">{companyLabel}</p><BarcodeLabel title={name} value={code} shortCode={code} />{serial && <p className="mt-3 text-xs">{serial}</p>}</div><style>{printStyles}</style></div>;
}
