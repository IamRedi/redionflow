import { BookOpenCheck, ExternalLink } from "lucide-react";

/** KiDraht shown inside BaumdienstFlow, with a way out to its own tab. */
export function KidrahtFrame({
  url,
  title,
  description,
  newTabLabel,
}: {
  url: string;
  title: string;
  description: string;
  newTabLabel: string;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpenCheck className="size-5 text-teal-600 dark:text-teal-300" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background/80 px-3 text-xs font-medium text-foreground/80 shadow-sm transition hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          {newTabLabel}
        </a>
      </div>
      <iframe
        src={url}
        title={title}
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-[calc(100dvh-16rem)] min-h-[560px] w-full rounded-xl border bg-[#0f2a2a] shadow-sm"
      />
    </section>
  );
}
