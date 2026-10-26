import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LandingContent } from "./landing-content";

function ColumnList({
  eyebrow,
  title,
  tone,
  icon: Icon,
  items,
}: {
  eyebrow: string;
  title: string;
  tone: "problem" | "solution";
  icon: typeof AlertTriangle;
  items: string[];
}) {
  const iconTone =
    tone === "problem"
      ? "bg-[#4a3320] text-amber-300"
      : "bg-[#214737] text-emerald-300";
  const cardTone =
    tone === "problem"
      ? "border-amber-500/20 bg-[#1c1612]"
      : "border-emerald-500/20 bg-[#163328]";

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${cardTone}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">{eyebrow}</div>
      <h3 className="mt-2.5 max-w-lg text-[1rem] font-semibold tracking-tight text-white sm:text-[1.4rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
        {title}
      </h3>

      <div className="mt-4 space-y-2.5 sm:mt-5">
        {items.slice(0, 3).map((item) => (
          <div key={item} className="rounded-lg bg-[#10211a] px-3 py-2.5 sm:px-3.5 sm:py-3">
            <span className={`inline-flex size-5 items-center justify-center rounded-md ${iconTone} sm:size-6`}>
              <Icon className="size-2.5 sm:size-3" />
            </span>
            <div className="mt-1.5 text-[0.8rem] leading-5 text-white/86 sm:text-[0.9rem] sm:leading-5.5">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProblemSolutionSection({ content }: { content: LandingContent["problemSolution"] }) {
  return (
    <section className="mt-14 sm:mt-16">
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <ColumnList
          eyebrow={content.problemsEyebrow}
          title={content.problemsTitle}
          tone="problem"
          icon={AlertTriangle}
          items={content.problems}
        />
        <ColumnList
          eyebrow={content.solutionsEyebrow}
          title={content.solutionsTitle}
          tone="solution"
          icon={CheckCircle2}
          items={content.solutions}
        />
      </div>

      {content.footnote ? (
        <p className="mt-5 text-center text-sm font-medium text-white/54">
          {content.footnote}
        </p>
      ) : null}
    </section>
  );
}
