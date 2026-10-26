import { HeroPreview } from "./HeroPreview";
import { HeroValueStrip } from "./HeroValueStrip";
import type { LandingContent, LandingLanguage } from "./landing-content";

function splitHeroTitle(title: string) {
  const parts = title.split(". ");
  if (parts.length < 2) return [title];
  const first = `${parts[0]}.`;
  const rest = parts.slice(1).join(". ");
  return [first, rest];
}

export function HeroSection({
  content,
  initialTheme,
  landingLang,
  demoEnabled,
}: {
  content: LandingContent["hero"];
  initialTheme: "light" | "dark";
  landingLang: LandingLanguage;
  demoEnabled: boolean;
}) {
  const titleLines = splitHeroTitle(content.title);
  const ctas = {
    de: { primary: "Demo starten", fieldTest: "Feldtest oeffnen" },
    en: { primary: "Start demo", fieldTest: "Open field test" },
    it: { primary: "Avvia demo", fieldTest: "Apri test sul campo" },
    pl: { primary: "Uruchom demo", fieldTest: "Otworz test terenowy" },
    ro: { primary: "Porneste demo", fieldTest: "Deschide testul pe teren" },
    sq: { primary: "Nis demo", fieldTest: "Hap test mode ne terren" },
  }[landingLang];

  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
        <div className="space-y-8 lg:space-y-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex rounded-full bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {content.eyebrow}
            </div>

            <h1 className="mt-5 text-[2.6rem] font-semibold tracking-tight text-white sm:text-[4rem] lg:text-[5.2rem] lg:leading-[0.96] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
              {titleLines.map((line, index) => (
                <span key={`${line}-${index}`} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-[1.05rem] leading-7 text-white/76 sm:text-[1.15rem]">
              {content.text}
            </p>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/52 sm:text-[0.96rem]">
              {content.note}
            </p>
          </div>

          <div id="produktvorschau" className="mx-auto max-w-5xl">
            <HeroPreview
              badge={content.previewBadge}
              title={content.previewTitle}
              subtitle={content.previewSubtitle}
              footer={content.previewFooter}
              initialTheme={initialTheme}
              ctaLabel={ctas.primary}
              fieldTestLabel={ctas.fieldTest}
              demoEnabled={demoEnabled}
            />
          </div>

          <div className="mx-auto max-w-5xl">
            <HeroValueStrip items={content.values} />
          </div>
        </div>
      </div>
    </section>
  );
}
