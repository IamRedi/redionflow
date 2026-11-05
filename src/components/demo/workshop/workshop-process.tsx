import { Check, ClipboardCheck, ShieldCheck, Wrench } from "lucide-react";
import { workshopCopy } from "@/lib/workshop/copy";
import type { WorkshopJob } from "@/lib/workshop/demo-model";

export function WorkshopProcess({ job, lang }: { job: WorkshopJob; lang: string }) {
  const c = workshopCopy(lang);
  const position = job.releasedAt ? 3 : job.status === "repaired" ? 2 : job.status === "repairing" ? 1 : 0;
  return <div className="rounded-xl border bg-muted/20 p-3"><ol aria-label={c.process} className="grid grid-cols-3 gap-2">{([ [c.received, ClipboardCheck], [c.repairing, Wrench], [c.repaired, ShieldCheck] ] as const).map(([label, Icon], i) => <li key={i} aria-current={i === Math.min(position, 2) ? "step" : undefined} className="min-w-0"><div className={`mb-2 flex items-center gap-2 ${i <= position ? "text-primary" : "text-muted-foreground/60"}`}><span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border ${i <= position ? "border-primary/25 bg-primary/10" : "bg-muted/40"}`}>{i < position ? <Check className="size-4" /> : <Icon className="size-4" />}</span>{i < 2 && <span className={`h-px flex-1 ${i < position ? "bg-primary/50" : "bg-border"}`} />}</div><span className={`block break-words text-xs ${i <= position ? "font-semibold" : "text-muted-foreground"}`}>{label}</span></li>)}</ol>{job.status === "repaired" && <p className={`mt-3 flex items-center gap-2 border-t pt-3 text-xs ${job.releasedAt ? "text-primary" : "text-muted-foreground"}`}><ShieldCheck className="size-4" />{job.releasedAt ? c.released : c.pendingRelease}</p>}</div>;
}
