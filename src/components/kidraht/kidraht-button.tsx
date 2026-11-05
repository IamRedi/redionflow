import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/** Product name, not translated. */
const PRODUCT_NAME = "KiDraht";

/** Top-bar button that opens KiDraht inside BaumdienstFlow. Label shows from sm up. */
export function KidrahtButton({ href, title, className, iconOnly = false }: { href: string; title: string; className?: string; iconOnly?: boolean }) {
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={cn("inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-teal-500/40 bg-gradient-to-br from-teal-500/20 to-emerald-400/10 px-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:from-teal-500/30 hover:to-emerald-400/20 dark:text-teal-200 sm:px-3", iconOnly && 'size-[44px] min-w-[44px] p-0 sm:p-0', className)}
    >
      <BookOpenCheck className="size-4 shrink-0" />
      {!iconOnly && <span className="hidden sm:inline">{PRODUCT_NAME}</span>}
    </Link>
  );
}
