import Image from "next/image";

import { brandLogoSrc } from "@/lib/branding";
import type { CompanyMode } from "@/lib/mode-config";
import { productBranding } from "@/lib/mode-config";
import { cn } from "@/lib/ui/cn";

const AI_BADGE_TEXT = "AI";

/**
 * Mode-aware brand mark.
 *
 * Structure is IDENTICAL across modes so React never sees a hydration
 * mismatch between server and client. Only the *contents* switch:
 *   - baumdienst: hero image with the tree wordmark baked in.
 *   - bau: safety-orange gradient with the product name.
 */
export function AppBrand({
  compact = false,
  className,
  aiBadge = false,
  logoSrc = brandLogoSrc,
  mode,
  logoAlt = "Firmenlogo",
}: {
  compact?: boolean;
  className?: string;
  aiBadge?: boolean;
  logoSrc?: string;
  mode?: CompanyMode;
  /** Alt text for the logo image. Callers with i18n access should pass
   * the translated string (e.g. t("common.companyLogoAlt", lang)). */
  logoAlt?: string;
}) {
  const isBaumdienst = !mode || mode === "baumdienst";
  const branding = productBranding(mode ?? "baumdienst");

  // Inline style for the orange gradient guarantees it renders correctly
  // even when Tailwind's JIT skips the `from-orange-*` classes on cold
  // reloads. Baumdienst still uses the Image so no style is needed there.
  const brandStyle = isBaumdienst
    ? undefined
    : {
        backgroundImage:
          "linear-gradient(135deg, hsl(24 95% 55%) 0%, hsl(18 88% 42%) 100%)",
      };

  return (
    <div className={cn("relative flex min-w-0 items-center", className)}>
      <div
        style={brandStyle}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full shadow-sm ring-1 ring-border",
          compact ? "size-[60px]" : "size-[72px]",
          isBaumdienst ? "bg-transparent" : "text-white",
        )}
      >
        {isBaumdienst ? (
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={compact ? 60 : 72}
            height={compact ? 60 : 72}
            priority
            className="size-full rounded-full object-cover"
          />
        ) : (
          <div className="px-1 text-center leading-tight">
            <div
              className={cn(
                "font-semibold tracking-tight",
                compact ? "text-[13px]" : "text-[15px]",
              )}
            >
              {branding.name}
            </div>
            <div
              className={cn(
                "font-light opacity-90",
                compact ? "text-[10px]" : "text-[11px]",
              )}
            >
              {branding.suffix}
              <sup className="ml-0.5 text-[7px]">{branding.superscript}</sup>
            </div>
          </div>
        )}
      </div>
      {aiBadge ? (
        <span className="absolute -right-1 -top-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-green shadow-sm">
          {AI_BADGE_TEXT}
        </span>
      ) : null}
    </div>
  );
}
