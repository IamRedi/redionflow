"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, LayoutDashboard, Maximize2, Monitor, RefreshCw } from "lucide-react";
import { navigationCopy } from "@/lib/workshop/navigation-copy";
import { Button } from "@/components/ui/button";

const productName = "BaumdienstFlow", workzoneName = "Workzone";

export function DemoTvControls({ lang, dashboard }: { lang:string; dashboard:boolean }) {
  const c = navigationCopy(lang), router = useRouter(), [pending,start] = useTransition(), [notice,setNotice] = useState("");
  useEffect(()=>{ const timer = window.setInterval(()=>{ if(document.visibilityState==="visible") start(()=>router.refresh()); },60000); return ()=>clearInterval(timer); },[router]);
  return <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4">
    <div><h1 className="flex items-center gap-2 text-lg font-semibold"><Monitor className="size-5 text-primary" />{c.tvTitle} · {productName}</h1><p className="mt-1 text-xs text-muted-foreground">{c.tvHint}</p></div>
    <nav aria-label={c.tvTitle} className="flex flex-wrap items-center gap-2">
      <Link href="/demo/workzone" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />{c.back}</Link>
      <Link href="/demo/tv" aria-current={!dashboard?"page":undefined} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm aria-[current=page]:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"><Home className="size-4" />{workzoneName}</Link>
      <Link href="/demo/tv?view=dashboard" aria-current={dashboard?"page":undefined} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm aria-[current=page]:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"><LayoutDashboard className="size-4" />{c.dashboard}</Link>
      <Button variant="outline" className="size-11" aria-label={c.refresh} title={c.refresh} disabled={pending} onClick={()=>start(()=>router.refresh())}><RefreshCw className={`size-4 ${pending?"animate-spin":""}`} /></Button>
      <Button variant="outline" className="min-h-11 gap-2" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setNotice("");}catch{setNotice(c.fullScreen);}}}><Maximize2 className="size-4" />{c.fullScreen}</Button>
    </nav>{notice&&<p role="status" className="text-sm">{notice}</p>}
  </header>;
}
