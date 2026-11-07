"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Monitor lifecycle only: no navigation, action bar or fullscreen button. */
export function DemoTvRefresh() {
  const router=useRouter(),[,start]=useTransition();
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==="visible")start(()=>router.refresh());},60000);return()=>clearInterval(timer);},[router]);
  return null;
}
