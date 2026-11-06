"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Camera, ImagePlus, Keyboard, Loader2, Nfc, X } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import { CameraBarcodeScanner } from './camera-barcode-scanner';
import { t } from '@/lib/i18n';
import { normalizeBarcodeInput } from '@/lib/inventory/barcode';
import { scanCopy } from '@/lib/inventory/scan-copy';

type NdefRecord={data?:BufferSource;encoding?:string;id?:string};
type NdefReader={scan(options?:{signal?:AbortSignal}):Promise<void>;onreading:((event:Event&{message?:{records?:NdefRecord[]}})=>void)|null;onreadingerror:(()=>void)|null};
type Mode='choice'|'camera'|'nfc'|'manual';
const button='inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50';

export function ScanGatewayDialog({open,title,description,value,onDetected,onCancel,onConfirm,confirmLabel,confirmDisabled,normalizeValue=normalizeBarcodeInput,children}:{
  open:boolean;title:string;description?:string;value:string;onDetected:(value:string)=>void;onCancel:()=>void;onConfirm:()=>void;
  confirmLabel?:string;confirmDisabled?:boolean;normalizeValue?:(value:string)=>string;children?:ReactNode;
}){
  const {currentLang}=useLanguage(),c=scanCopy(currentLang);
  const descriptionId=useId();
  const [mode,setMode]=useState<Mode>('choice'),[message,setMessage]=useState<string>(),[reading,setReading]=useState(false);
  const photo=useRef<HTMLInputElement>(null),epoch=useRef(0),nfc=useRef<AbortController|null>(null),opener=useRef<HTMLElement|null>(null);
  const invalidate=useCallback(()=>{epoch.current++;nfc.current?.abort();},[]);
  useEffect(()=>{if(!open)invalidate();return invalidate;},[open,invalidate]);
  function cancel(){epoch.current++;nfc.current?.abort();setMode('choice');setMessage(undefined);setReading(false);onCancel();}
  function accept(raw:string){onDetected(normalizeValue(raw));setMode('manual');setMessage(undefined);nfc.current?.abort();}
  async function readPhoto(file:File|undefined){
    if(!file)return;
    if(!file.type.startsWith('image/')||file.size>12_000_000){setMessage(c.photoLimit);return;}
    const own=++epoch.current;
    setReading(true);setMessage(undefined);nfc.current?.abort();setMode('manual');
    const url=URL.createObjectURL(file);
    try{
      const {BrowserMultiFormatReader}=await import('@zxing/browser');
      const result=await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      if(epoch.current===own)accept(result.getText());
    }catch{if(epoch.current===own)setMessage(c.notFound);}
    finally{URL.revokeObjectURL(url);if(epoch.current===own)setReading(false);}
  }
  async function startNfc(){
    nfc.current?.abort();setMode('nfc');setMessage(undefined);
    const Reader=(window as Window&{NDEFReader?:new()=>NdefReader}).NDEFReader;
    if(!Reader){setMessage(t('admin.scanNfcUnsupported',currentLang));return;}
    const own=++epoch.current,controller=new AbortController();nfc.current=controller;
    try{
      const reader=new Reader();
      reader.onreading=event=>{
        if(epoch.current!==own)return;
        const record=event.message?.records?.[0];
        try{const raw=record?.data?new TextDecoder(record.encoding||'utf-8').decode(record.data):record?.id??'';if(raw)accept(raw);}catch{setMessage(c.notFound);}
      };
      reader.onreadingerror=()=>{if(epoch.current===own)setMessage(c.notFound);};
      await reader.scan({signal:controller.signal});
    }catch{if(epoch.current===own&&!controller.signal.aborted)setMessage(t('admin.scanNfcStartFailed',currentLang));}
  }
  return <Dialog.Root open={open} onOpenChange={next=>{if(!next)cancel();}}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1700] bg-black/50"/>
      <Dialog.Content aria-describedby={description?descriptionId:undefined} onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={event=>{event.preventDefault();if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}} className="fixed inset-x-3 top-1/2 z-[1701] flex max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background text-foreground shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-[min(32rem,calc(100vw-1.5rem))] sm:-translate-x-1/2">
        <div className="flex shrink-0 items-center gap-3 px-4 py-2"><Dialog.Title className="min-w-0 flex-1 text-base font-semibold">{title}</Dialog.Title><button type="button" className={button} aria-label={t('common.close',currentLang)} onClick={cancel}><X size={18}/></button></div>
        <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
          {description?<Dialog.Description id={descriptionId} className="mb-3 text-sm text-muted-foreground">{description}</Dialog.Description>:null}
          {mode==='camera'&&!value?<CameraBarcodeScanner active={open} onDetected={accept} onError={setMessage} normalizeValue={normalizeValue}/>:null}
          <label className="mt-3 block text-sm font-medium">{c.code}<input type="text" value={value} maxLength={2048} autoComplete="off" spellCheck={false} onChange={event=>onDetected(normalizeValue(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border bg-card px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-500" placeholder={t('admin.scanCodeManualPlaceholder',currentLang)}/></label>
          <div className="my-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={()=>{epoch.current++;onDetected('');setReading(false);setMessage(undefined);setMode('camera');}}><Camera size={16}/>{value?c.rescan:t('admin.scanCodeQr',currentLang)}</button>
            <button type="button" className={button} onClick={()=>photo.current?.click()}><ImagePlus size={16}/>{c.photo}</button>
            <button type="button" className={button} onClick={()=>{nfc.current?.abort();setMode('manual');}}><Keyboard size={16}/>{t('admin.scanManual',currentLang)}</button>
            <button type="button" className={button} onClick={()=>void startNfc()}><Nfc size={16}/>{t('admin.scanNfc',currentLang)}</button>
          </div>
          <input ref={photo} hidden data-testid="scan-photo-input" type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];event.target.value='';void readPhoto(file);}}/>
          {reading?<p role="status" className="my-2 flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin"/>{c.decoding}</p>:null}
          {mode==='nfc'&&!message?<p className="my-2 text-sm text-muted-foreground">{t('admin.scanNfcHoldPhone',currentLang)}</p>:null}
          {message?<p role="status" className="my-2 text-sm text-orange-800 dark:text-orange-300">{message}</p>:null}
          {value?children:null}
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" className={button} onClick={cancel}>{t('common.close',currentLang)}</button><button type="button" className={button+' border-orange-700 bg-orange-700 text-white dark:border-orange-500 dark:bg-orange-500 dark:text-slate-950'} disabled={reading||(confirmDisabled??!value)} onClick={()=>{epoch.current++;nfc.current?.abort();setMode('choice');onConfirm();}}>{confirmLabel??t('admin.scanConfirmApply',currentLang)}</button></div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
