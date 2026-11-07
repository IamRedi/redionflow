"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/** Fullscreen must be requested during this click, before same-document routing. */
export function DemoDashboardLaunch({href="/demo/tv?view=dashboard",className,children}:{href?:string;className?:string;children:ReactNode}) {
  const router=useRouter();
  async function open(event:MouseEvent<HTMLAnchorElement>) {
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    try { if(!document.fullscreenElement&&document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({navigationUI:"hide"}); }
    catch { /* Unsupported/denied native fullscreen still opens the clean viewport. */ }
    router.push(href);
  }
  return <Link href={href} className={className} onClick={open}>{children}</Link>;
}
