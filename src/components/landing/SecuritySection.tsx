import { Check, ShieldCheck } from "lucide-react";
import type { LandingContent } from "./landing-content";

export function SecuritySection({ content }: { content: LandingContent["security"] }) {
  return (
    <article className="h-full rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)]">
      <span className="inline-flex size-9 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
        <ShieldCheck className="size-[1.125rem]" />
      </span>

      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
        {content.eyebrow}
      </div>

      <h3 className="mt-2.5 text-[1.25rem] font-semibold tracking-tight text-white">
        {content.title}
      </h3>

      <p className="mt-2.5 text-[0.93rem] leading-6 text-white/68">{content.text}</p>

      <div className="mt-4 space-y-2">
        {content.points.slice(0, 3).map((point) => (
          <div key={point} className="flex items-start gap-2.5 text-[0.88rem] leading-5.5 text-white/84">
            <Check className="mt-1 size-3.5 shrink-0 text-emerald-300" />
            <span>{point}</span>
          </div>
        ))}
      </div>

      {content.notes.slice(0, 1).map((note) => (
        <p key={note} className="mt-5 text-sm font-medium text-white/52">
          {note}
        </p>
      ))}
    </article>
  );
}
