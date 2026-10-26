import type { LucideIcon } from "lucide-react";

export function HeroValueStrip({
  items,
}: {
  items: Array<{ icon: LucideIcon; label: string }>;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="inline-flex min-h-[50px] items-center gap-3 rounded-lg bg-white/[0.045] px-3.5 py-2.5 text-sm text-white/76 shadow-[0_10px_22px_rgba(0,0,0,0.12)]"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
            <Icon className="size-4" />
          </span>
          <span className="leading-5">{label}</span>
        </div>
      ))}
    </div>
  );
}
