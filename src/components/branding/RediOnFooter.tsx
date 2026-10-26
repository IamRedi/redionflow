import { cn } from "@/lib/ui/cn";

const BRAND_RED = "Redi";
const BRAND_GREEN = "ON";
const BRAND_TAGLINE = "Upgrade humans. Not replace them.";

/** `onDark` is for pages that paint their own dark background regardless of the theme (landing). */
export function RediOnFooter({ onDark = false }: { onDark?: boolean }) {
  return (
    <footer
      className={cn(
        "px-5 pb-4 pt-8 text-center text-[10px] font-light tracking-wide print:hidden",
        onDark ? "text-white/70" : "text-muted-foreground",
      )}
    >
      <div className="font-medium tracking-[0.08em]">
        <span className={onDark ? "text-red-400" : "text-red-700 dark:text-red-400"}>{BRAND_RED}</span>
        <span className={onDark ? "text-emerald-400" : "text-emerald-700 dark:text-emerald-400"}>{BRAND_GREEN}</span>
      </div>
      <div className="mt-0.5">
        <span>{BRAND_TAGLINE}</span>
      </div>
    </footer>
  );
}
