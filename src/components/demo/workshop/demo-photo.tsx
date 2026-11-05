"use client";
import { canUploadDemoFile } from "@/lib/workshop/inventory-flow";

import Image from "next/image";
import { Camera, Download, ImagePlus, LoaderCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { photoCopy } from "@/lib/asset-photos/shared";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { WorkshopDialog } from "./workshop-ui";

/** Explicit demo adapter: never calls operational photo actions or storage. */
export function DemoPhoto({ kind, target, photoKey, jobId, alt, children, className = "" }: { kind: "asset" | "site"; target: string; photoKey?: string; jobId?: string; alt: string; children?: ReactNode; className?: string }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), p = photoCopy(currentLang);
  const { photos, state, actor, upload, pending, status } = useWorkshopDemo();
  const images = photos.filter(photo => photo.kind === kind && photo.target === (photoKey ?? target) && (!jobId || photo.jobId === jobId));
  const [open, setOpen] = useState(false), [message, setMessage] = useState("");
  const camera = useRef<HTMLInputElement>(null), file = useRef<HTMLInputElement>(null);
  async function choose(selected?: File) {
    if (!selected) return;
    setMessage("");
    try {
      if (!selected.size || selected.size > 12_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) throw new Error("fileError");
      await upload(selected, { kind, target, ...(jobId ? { jobId } : {}) });
      setMessage(c.saved);
    } catch (error) { const key = error instanceof Error ? error.message : "error"; setMessage(key === "conflict" ? c.conflict : key === "busy" ? c.busy : key === "connection" ? c.connection : c.fileError); }
    finally { if (camera.current) camera.current.value = ""; if (file.current) file.current.value = ""; }
  }
  return <div className={`relative ${className}`} data-testid={`demo-photo-${kind}-${target}`}>
    {images[0] ? <Image src={images[0].url} alt={alt} fill sizes="(max-width: 640px) 100vw, 420px" unoptimized className="object-cover" /> : children}
    <button type="button" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setOpen(true); }} className="absolute bottom-1.5 right-1.5 inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-black/70 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${c.photos}: ${alt}`}><Camera className="size-4" aria-hidden="true" />{images.length > 0 && <span>{images.length}</span>}</button>
    <WorkshopDialog open={open} onClose={() => setOpen(false)} closeLabel={c.close} title={`${c.photos} · ${alt}`} description={c.photoHint}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={pending || status !== "ready" || !canUploadDemoFile(state,actor,kind,target,jobId)} onClick={() => camera.current?.click()}><Camera />{p.camera}</Button><Button type="button" variant="outline" className="min-h-11" disabled={pending || status !== "ready" || !canUploadDemoFile(state,actor,kind,target,jobId)} onClick={() => file.current?.click()}><ImagePlus />{p.upload}</Button></div>
        <input ref={camera} data-photo-input="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => void choose(e.target.files?.[0])} />
        <input ref={file} data-photo-input="upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void choose(e.target.files?.[0])} />
        {pending && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 motion-safe:animate-spin" />{c.saving}</p>}
        {message && <p role={message === c.saved ? "status" : "alert"} className="rounded-xl border bg-muted/30 p-3 text-sm">{message}</p>}
        {images.length ? <div className="grid gap-3 sm:grid-cols-2">{images.map(photo => <figure key={photo.id} className="overflow-hidden rounded-xl border"><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.photos}: ${photo.name}`} className="block rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Image src={photo.url} alt={alt} width={1024} height={768} unoptimized className="aspect-[4/3] w-full object-cover" /></a><figcaption className="break-words p-3 text-xs text-muted-foreground">{photo.name}<time className="mt-1 block" dateTime={photo.at}>{new Date(photo.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })}</time><a href={photo.url} download={photo.name} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded px-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Download className="size-4" />{c.download}</a></figcaption></figure>)}</div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Camera className="mx-auto mb-3 size-8 opacity-50" />{c.noPhotos}</div>}
      </div>
    </WorkshopDialog>
  </div>;
}
