const BRAND_RED = "Redi";
const BRAND_GREEN = "ON";
const BRAND_TAGLINE = "Upgrade humans. Not replace them.";

export function RediOnFooter() {
  return (
    <footer className="px-5 pb-4 pt-8 text-center text-[9px] font-light tracking-wide text-muted-foreground/35 print:hidden">
      <div className="text-[8px] font-medium tracking-[0.08em] text-muted-foreground/45">
        <span className="text-alfa-red/60">{BRAND_RED}</span><span className="text-brand-green/60">{BRAND_GREEN}</span>
      </div>
      <div className="mt-0.5 text-[8px]">
        <span>{BRAND_TAGLINE}</span>
      </div>
    </footer>
  );
}
