import { CalendarDays, ScanLine } from "lucide-react";
import type { LandingContent } from "./landing-content";

type FeatureCardData = LandingContent["features"]["cards"][number];

function FeatureCard({ title, icon: Icon, points }: FeatureCardData) {
  return (
    <div className="group flex h-full flex-col rounded-xl bg-white/[0.045] p-3.5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
        <Icon className="size-[1.125rem]" />
      </span>

      <h3 className="mt-3 text-[0.96rem] font-semibold tracking-tight text-white">{title}</h3>

      <div className="mt-4 space-y-1">
        {points.slice(0, 2).map((point) => (
          <div key={point} className="flex items-start gap-2 rounded-md bg-[#10211a]/88 px-2.5 py-1.5 text-[0.83rem] leading-[1.24] text-white/86">
            <span className="mt-[0.38rem] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/90" aria-hidden="true" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowLine({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold leading-6 text-white">
      {steps.map((step, index) => (
        <span key={`${step}-${index}`} className="contents">
          {index > 0 ? <span className="text-emerald-600 dark:text-emerald-300">{"->"}</span> : null}
          <span>{step}</span>
        </span>
      ))}
    </div>
  );
}

function PointGrid({ points }: { points: string[] }) {
  return (
    <div className="mt-4 grid gap-2.5 md:grid-cols-2">
      {points.map((point) => (
        <div key={point} className="rounded-lg bg-[#10211a] px-3.5 py-2.5 text-[0.9rem] leading-5.5 text-white/86">
          {point}
        </div>
      ))}
    </div>
  );
}

export function FeaturesSection({ content }: { content: LandingContent["features"] }) {
  return (
    <section className="mt-20">
      <div className="max-w-3xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          {content.eyebrow}
        </div>
        <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.2rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
          {content.title}
        </h2>
        {content.text ? <p className="mt-3 text-[0.96rem] leading-6.5 text-white/68">{content.text}</p> : null}
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {content.cards.map((card) => (
          <FeatureCard key={card.title} title={card.title} icon={card.icon ?? CalendarDays} points={card.points} />
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="max-w-4xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
            {content.flowEyebrow}
          </div>
          <h3 className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.7rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
            {content.flowTitle}
          </h3>
          <p className="mt-2.5 text-[0.96rem] leading-6.5 text-white/68">{content.flowText}</p>
        </div>

        <div className="mt-5 rounded-lg bg-[#10211a]/88 px-4 py-3.5 sm:px-[1.125rem]">
          <FlowLine steps={content.flowSteps} />
        </div>

        <PointGrid points={content.flowPoints.slice(0, 2)} />
      </div>

      <div className="mt-5 rounded-xl bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="max-w-4xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
            {content.urgentEyebrow}
          </div>
          <h3 className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.7rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
            {content.urgentTitle}
          </h3>
          <p className="mt-2.5 max-w-3xl text-[0.96rem] leading-6.5 text-white/68">{content.urgentText}</p>
        </div>

        <div className="mt-5 rounded-lg bg-[#10211a]/88 px-4 py-3.5 sm:px-[1.125rem]">
          <FlowLine steps={content.urgentSteps} />
        </div>

        <PointGrid points={content.urgentPoints.slice(0, 1)} />
      </div>

      <div className="mt-5 rounded-xl bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
              <ScanLine className="size-[1.125rem]" />
            </span>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
              {content.treeEyebrow}
            </div>
            <h3 className="mt-2.5 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.7rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
              {content.treeTitle}
            </h3>
            <p className="mt-2.5 text-[0.96rem] leading-6.5 text-white/68">{content.treeText}</p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {content.treePoints.slice(0, 4).map((point) => (
              <div key={point} className="rounded-lg bg-[#10211a] px-3.5 py-2.5 text-[0.9rem] leading-5.5 text-white/86">
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-7 w-fit rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-center text-sm font-semibold text-white/70">
        {content.footnote}
      </div>
    </section>
  );
}
