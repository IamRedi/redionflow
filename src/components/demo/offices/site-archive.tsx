"use client";
import { useEffect, useState } from "react";
import { FolderOpen, FileText } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { officeCopy } from "@/lib/workshop/offices/copy";

export function OfficeSiteArchive({ siteId, expanded = false }: { siteId: string; expanded?: boolean }) {
  const { currentLang } = useLanguage(), c = officeCopy(currentLang), [files, setFiles] = useState<Array<{ id: string; name: string; url: string }>>([]), [error, setError] = useState(false);
  useEffect(() => { const abort = new AbortController(); void fetch(`/api/demo/baumdienst/offices/site-files?site=${encodeURIComponent(siteId)}`, { cache: "no-store", signal: abort.signal }).then(async r => { if (!r.ok) throw new Error(); const s = await r.json(); setFiles(s.files); setError(false); }).catch(() => { if (!abort.signal.aborted) setError(true); }); return () => abort.abort(); }, [siteId]);
  const content = error ? <p role="alert" className="text-sm">{c.error}</p> : files.length ? <><p className="text-xs text-muted-foreground">{c.sameFile}</p>{files.map(file => <a className="baum-site-person" key={file.id} href={file.url}><FileText className="size-5 shrink-0" /><strong className="min-w-0 break-all">{file.name}</strong></a>)}</> : <p className="baum-site-empty">{c.noItems}</p>;
  if (expanded) return <section className="grid gap-3" data-testid="site-office-archive">{content}</section>;
  if (!files.length && !error) return null;
  return <details className="rounded-2xl border bg-card px-4" data-testid="site-office-archive"><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><FolderOpen className="size-4 text-primary" />{c.archive} · {files.length}</summary><div className="space-y-2 pb-4">{content}</div></details>;
}
