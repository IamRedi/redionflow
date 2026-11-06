"use client";
import { canUploadDemoFile } from "@/lib/workshop/inventory-flow";

import Image from "next/image";
import { Camera, Download, ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { photoCopy } from "@/lib/asset-photos/shared";
import { workshopCopy } from "@/lib/workshop/copy";
import { useWorkshopDemo } from "./use-workshop-demo";
import { WorkshopDialog } from "./workshop-ui";
import { StudioArt } from "./studio-art";
import { atlasCopy } from "@/lib/workshop/atlas";
import { assetArtKind } from "@/lib/workshop/identity-art";
import { studioMediaUrl, type StudioMediaId } from "@/lib/workshop/studio-media";
import { studioCopy } from "@/lib/workshop/studio-copy";

/** Explicit demo adapter: never calls operational photo actions or storage. */
export function DemoPhoto({ kind, target, photoKey, jobId, alt, children, className = "", readOnly = false }: { readOnly?: boolean; kind: "asset" | "site"; target: string; photoKey?: string; jobId?: string; alt: string; children?: ReactNode; className?: string }) {
  const { currentLang } = useLanguage(), c = workshopCopy(currentLang), p = photoCopy(currentLang), studio = studioCopy(currentLang), atlas = atlasCopy(currentLang);
  const { photos, state, actor, upload, pending, status, illustrations, imageGenerationEnabled, generateImage, generating, imageErrors } = useWorkshopDemo();
  const images = photos.filter(photo => photo.kind === kind && photo.target === (photoKey ?? target) && (!jobId || photo.jobId === jobId));
  const [open, setOpen] = useState(false), [message, setMessage] = useState("");
  const illustration = kind === "asset" && !jobId ? illustrations?.find(i => i.assetId === target) : undefined;
  const asset = kind === "asset" ? state.assets.find(a=>a.id === target) : undefined;
  const artKind = asset ? assetArtKind(asset.id,asset.name,asset.details?.category) : "";
  const catalogue = !jobId ? kind === "site" ? "card-worksite" : ["chipper","truck","platform","harness","helmet","spade","toolbox","crane"].includes(artKind) ? `equipment-${artKind}` as StudioMediaId : undefined : undefined;
  const working = generating.includes(target) || illustration?.status === "pending";
  const generatedUrl = !images.length && illustration?.status === "ready" ? illustration.url : undefined;
  const imageError = imageErrors[target] || illustration?.error;
  const imageErrorText = imageError && (studio[imageError as keyof typeof studio] || studio.aiFailed);
  const camera = useRef<HTMLInputElement>(null), file = useRef<HTMLInputElement>(null);
  async function choose(selected?: File) {
    if (!selected || readOnly) return;
    setMessage("");
    try {
      if (!selected.size || selected.size > 12_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) throw new Error("fileError");
      await upload(selected, { kind, target, ...(jobId ? { jobId } : {}) });
      setMessage(c.saved);
    } catch (error) { const key = error instanceof Error ? error.message : "error"; setMessage(key === "conflict" ? c.conflict : key === "busy" ? c.busy : key === "connection" ? c.connection : c.fileError); }
    finally { if (camera.current) camera.current.value = ""; if (file.current) file.current.value = ""; }
  }
  return <div className={`relative ${className}`} data-testid={`demo-photo-${kind}-${target}`}>
    {images[0] ? <Image src={images[0].url} alt={alt} fill sizes="(max-width: 640px) 100vw, 420px" unoptimized className="object-cover" /> : generatedUrl ? <><Image src={generatedUrl} alt={`${alt} · ${studio.generated}`} fill sizes="(max-width: 640px) 100vw, 420px" unoptimized className="bg-[#f5f3ed] object-contain" /><span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-1 text-[10px] font-semibold text-white" title={studio.generated}>{studio.aiBadge}</span></> : catalogue ? <StudioArt id={catalogue} fill className="!rounded-none">{children}</StudioArt> : children}
    {working && !images.length && <span role="status" aria-label={studio.generating} className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 p-1.5 text-white"><LoaderCircle className="size-4 motion-safe:animate-spin" /></span>}
    <button type="button" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setOpen(true); }} className="absolute bottom-1.5 right-1.5 inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-black/70 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${c.photos}: ${alt}`}><Camera className="size-4" aria-hidden="true" />{images.length > 0 && <span>{images.length}</span>}</button>
    <WorkshopDialog open={open} onClose={() => setOpen(false)} closeLabel={c.close} title={`${c.photos} · ${alt}`} description={readOnly ? undefined : c.photoHint}>
      <div className="space-y-4">
        {!readOnly && <><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={pending || status !== "ready" || !canUploadDemoFile(state,actor,kind,target,jobId)} onClick={() => camera.current?.click()}><Camera />{p.camera}</Button><Button type="button" variant="outline" className="min-h-11" disabled={pending || status !== "ready" || !canUploadDemoFile(state,actor,kind,target,jobId)} onClick={() => file.current?.click()}><ImagePlus />{p.upload}</Button></div>
        <input ref={camera} data-photo-input="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => void choose(e.target.files?.[0])} />
        <input ref={file} data-photo-input="upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void choose(e.target.files?.[0])} /></>}
        {kind === "asset" && !jobId && <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
          {generatedUrl && <figure><Image src={generatedUrl} alt={`${alt} · ${studio.generated}`} width={1024} height={1024} unoptimized className="mx-auto aspect-square max-h-72 w-full rounded-lg bg-[#f5f3ed] object-contain" /><figcaption className="mt-2 flex items-center gap-2 text-xs font-medium"><Sparkles className="size-4 text-primary" />{studio.generated}</figcaption></figure>}
          {!images.length && !generatedUrl && catalogue && <figure><Image src={studioMediaUrl(catalogue)} alt={`${alt} · ${atlas.catalogue}`} width={1536} height={1024} unoptimized className="mx-auto aspect-[3/2] max-h-72 w-full rounded-lg object-contain" /><figcaption className="mt-2 text-xs text-muted-foreground">{atlas.catalogue} · {studio.reference}</figcaption></figure>}
          {!readOnly && !images.length && !generatedUrl && actor.role === "admin" && <Button type="button" variant="outline" className="min-h-11 w-full" disabled={!imageGenerationEnabled || working || pending || status !== "ready" || Boolean(generatedUrl)} onClick={() => void generateImage(target).catch(() => {})}>{working ? <LoaderCircle className="motion-safe:animate-spin" /> : <Sparkles />}{working ? studio.generating : generatedUrl ? studio.generated : studio.generate}</Button>}
          <p className="text-xs leading-relaxed text-muted-foreground">{generatedUrl ? studio.reference : studio.hint}</p>
          {!images.length && !imageGenerationEnabled && <p className="text-xs leading-relaxed text-muted-foreground">{studio.aiUnavailable}</p>}
          {!images.length && imageErrorText && <p role="alert" className="text-sm">{imageErrorText}</p>}
        </div>}
        {pending && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 motion-safe:animate-spin" />{c.saving}</p>}
        {message && <p role={message === c.saved ? "status" : "alert"} className="rounded-xl border bg-muted/30 p-3 text-sm">{message}</p>}
        {images.length ? <div className="grid gap-3 sm:grid-cols-2">{images.map(photo => <figure key={photo.id} className="overflow-hidden rounded-xl border"><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`${c.photos}: ${photo.name}`} className="block rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Image src={photo.url} alt={alt} width={1024} height={768} unoptimized className="aspect-[4/3] w-full object-cover" /></a><figcaption className="break-words p-3 text-xs text-muted-foreground">{photo.name}<time className="mt-1 block" dateTime={photo.at}>{new Date(photo.at).toLocaleString(currentLang, { timeZone: "Europe/Berlin" })}</time><a href={photo.url} download={photo.name} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded px-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Download className="size-4" />{c.download}</a></figcaption></figure>)}</div> : !generatedUrl && !working && !(kind === "asset" && catalogue) ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Camera className="mx-auto mb-3 size-8 opacity-50" />{c.noPhotos}</div> : null}
      </div>
    </WorkshopDialog>
  </div>;
}
