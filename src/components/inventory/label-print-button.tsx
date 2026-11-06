"use client";
import { Printer } from 'lucide-react';
export function LabelPrintButton({label}:{label:string}){return <button type="button" onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 font-semibold print:hidden"><Printer size={18}/>{label}</button>;}
