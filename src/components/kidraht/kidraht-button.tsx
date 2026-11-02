import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

/** Product name, the same in every language. */
const BRAND = "KiDraht";

/** Top-bar button that opens KiDraht inside BaumdienstFlow. Label shows from sm up. */
export function KidrahtButton({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-teal-500/40 bg-gradient-to-br from-teal-500/20 to-emerald-400/10 px-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:from-teal-500/30 hover:to-emerald-400/20 dark:text-teal-200 sm:px-3"
    >
      <BookOpenCheck className="size-4 shrink-0" />
      <span className="hidden sm:inline">{BRAND}</span>
    </Link>
  );
}
