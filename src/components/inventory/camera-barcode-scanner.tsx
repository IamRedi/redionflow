"use client";

import { useEffect, useRef } from 'react';
import { normalizeBarcodeInput } from '@/lib/inventory/barcode';
import { useLanguage } from '@/components/i18n/language-provider';
import { scanCopy } from '@/lib/inventory/scan-copy';

type DetectorLike = { detect(source: ImageBitmapSource): Promise<{rawValue?: string}[]> };
type DetectorCtor = { new(options?: {formats?: string[]}): DetectorLike; getSupportedFormats?: () => Promise<string[]> };
type Controls = {stop: () => void};
const formats = ['code_128','code_39','code_93','codabar','ean_13','ean_8','upc_a','upc_e','itf','qr_code','data_matrix','pdf417','aztec'];

export function CameraBarcodeScanner({active,onDetected,onError,normalizeValue=normalizeBarcodeInput}: {
  active:boolean;onDetected:(value:string)=>void;onError:(message:string)=>void;normalizeValue?:(value:string)=>string;
}) {
  const {currentLang}=useLanguage();
  const video=useRef<HTMLVideoElement>(null);
  const callbacks=useRef({onDetected,onError,normalizeValue,message:scanCopy(currentLang).camera});
  useEffect(()=>{callbacks.current={onDetected,onError,normalizeValue,message:scanCopy(currentLang).camera};},[onDetected,onError,normalizeValue,currentLang]);
  useEffect(()=>{
    if(!active)return;
    let alive=true,found=false,frame:number|undefined,stream:MediaStream|null=null,controls:Controls|null=null;
    function stopNative(){if(frame!==undefined)cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());stream=null;}
    function accept(raw:string){
      if(!alive||found)return;
      const value=callbacks.current.normalizeValue(raw);
      if(!value)return;
      found=true;stopNative();controls?.stop();callbacks.current.onDetected(value);
    }
    async function fallback(){
      stopNative();
      try{
        const {BrowserMultiFormatReader}=await import('@zxing/browser');
        if(!alive||!video.current)return;
        const reader=new BrowserMultiFormatReader();
        const next=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},video.current,(result,_error,own)=>{
          if(result&&alive&&!found){own.stop();accept(result.getText());}
        });
        if(!alive||found)next.stop();else controls=next;
      }catch{if(alive)callbacks.current.onError(callbacks.current.message);}
    }
    async function start(){
      const Detector=(window as Window&{BarcodeDetector?:DetectorCtor}).BarcodeDetector;
      if(!Detector?.getSupportedFormats){await fallback();return;}
      let detector:DetectorLike;
      try{
        const supported=await Detector.getSupportedFormats();
        if(!alive)return;
        if(!formats.every(format=>supported.includes(format))){await fallback();return;}
        detector=new Detector({formats:formats.filter(format=>supported.includes(format))});
      }catch{await fallback();return;}
      try{
        const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(!alive){next.getTracks().forEach(track=>track.stop());return;}
        stream=next;
        if(!video.current){stopNative();return;}
        video.current.srcObject=stream;await video.current.play();
      }catch{stopNative();if(alive)callbacks.current.onError(callbacks.current.message);return;}
      const scan=async()=>{
        if(!alive||found)return;
        if(video.current&&video.current.readyState>=2){
          try{
            const values=await detector.detect(video.current);
            if(!alive||found)return;
            const raw=values.find(value=>callbacks.current.normalizeValue(value.rawValue??''))?.rawValue;
            if(raw){accept(raw);return;}
          }catch{if(alive&&!found)await fallback();return;}
        }
        if(alive&&!found)frame=requestAnimationFrame(scan);
      };
      if(alive&&!found)frame=requestAnimationFrame(scan);
    }
    void start();
    return()=>{alive=false;stopNative();controls?.stop();};
  },[active]);
  return <video ref={video} aria-label={scanCopy(currentLang).code} className="aspect-[4/3] w-full rounded-xl border bg-black object-cover" muted playsInline/>;
}
