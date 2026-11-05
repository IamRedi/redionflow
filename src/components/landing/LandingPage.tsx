"use client";

import { MonitorPlay } from "lucide-react";

import { RediOnFooter } from "@/components/branding/RediOnFooter";
import { BaumdienstDemoFooter } from "@/components/demo/workshop/demo-footer";
import { useLanguage } from "@/components/i18n/language-provider";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { KalkulatorSection } from "@/components/landing/KalkulatorSection";
import { LandingLanguageControl } from "@/components/landing/LandingLanguageControl";
import { PositioningSection } from "@/components/landing/PositioningSection";
import { ProblemSolutionSection } from "@/components/landing/ProblemSolutionSection";
import { ProductsSection } from "@/components/landing/ProductsSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { SideNavigation } from "@/components/landing/SideNavigation";
import { landingContent, normalizeLandingLanguage } from "./landing-content";
import { workshopCopy } from "@/lib/workshop/copy";

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.1rem] lg:text-[2.35rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
        {title}
      </h2>
      {text ? <p className="mt-3 text-[0.96rem] leading-6.5 text-white/68">{text}</p> : null}
    </div>
  );
}

function TaskCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <article className="group rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition hover:border-white/20 hover:bg-white/[0.065]">
        <div className="min-w-0">
          <h3 className="text-[1.12rem] font-semibold tracking-tight text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/66">{text}</p>
        </div>
    </article>
  );
}

export function LandingPage({
  initialTheme,
  isSaasMode = false,
  demoEnabled = false,
  workshopDemoEnabled = false,
}: {
  initialTheme: "light" | "dark";
  isSaasMode?: boolean;
  demoEnabled?: boolean;
  workshopDemoEnabled?: boolean;
}) {
  const { currentLang } = useLanguage();
  const landingLang = normalizeLandingLanguage(currentLang);
  const content = landingContent[landingLang];
  const workshop = workshopCopy(landingLang);
  const demoPush = {
    de: {
      title: "Live sehen statt lesen.",
      text: "Die Workzone direkt im Browser testen.",
      cta: "Demo starten",
      adminLabel: "Verwaltung",
      displayLabel: "Display",
      adminTitle: "Verwaltung, Reports und Assistenz bleiben getrennt",
      adminText: "Gleiche Logo-Optik, getrennte Rechte: Admin Assistant liest Verwaltung und Reports, Worker Helper bleibt bei Workzone.",
      dashboardTitle: "Dashboard mit eigenem Zugang",
      dashboardText: "Ein ruhiger Bildschirm fuer Buero, Monitor oder Fahrzeug: Dashboard und Workzone live.",
      paperlessLead: "Weniger Papier. Mehr Klarheit.",
      paperlessText: "Dokumente, Verlauf und Status bleiben digital verbunden.",
      finalDemoCta: "Nach oben zur Demo",
    },
    en: {
      title: "See it live instead of reading.",
      text: "Test Workzone directly in the browser.",
      cta: "Start demo",
      adminLabel: "Management",
      displayLabel: "Display",
      adminTitle: "Management, reports and assistance stay separated",
      adminText: "Same logo look, separate permissions: Admin Assistant reads management and reports, Worker Helper stays with Workzone.",
      dashboardTitle: "Dashboard with its own access",
      dashboardText: "A calm screen for office, monitor or vehicle: dashboard and live Workzone.",
      paperlessLead: "Less paper. More clarity.",
      paperlessText: "Documents, history and status stay digitally connected.",
      finalDemoCta: "Back to demo",
    },
    it: {
      title: "Vederlo live invece di leggere.",
      text: "Prova Workzone direttamente nel browser.",
      cta: "Avvia demo",
      adminLabel: "Gestione",
      displayLabel: "Display",
      adminTitle: "Gestione, report e assistenza restano separati",
      adminText: "Stesso aspetto del logo, diritti separati: Admin Assistant legge gestione e report, Worker Helper resta su Workzone.",
      dashboardTitle: "Dashboard con accesso dedicato",
      dashboardText: "Uno schermo chiaro per ufficio, monitor o veicolo: dashboard e Workzone live.",
      paperlessLead: "Meno carta. Piu chiarezza.",
      paperlessText: "Documenti, storico e stato restano collegati digitalmente.",
      finalDemoCta: "Torna alla demo",
    },
    pl: {
      title: "Zobacz na zywo zamiast czytac.",
      text: "Przetestuj Workzone bezposrednio w przegladarce.",
      cta: "Uruchom demo",
      adminLabel: "Zarzadzanie",
      displayLabel: "Display",
      adminTitle: "Zarzadzanie, raporty i asystencja pozostaja rozdzielone",
      adminText: "Ten sam wyglad logo, osobne uprawnienia: Admin Assistant czyta zarzadzanie i raporty, Worker Helper zostaje przy Workzone.",
      dashboardTitle: "Dashboard z osobnym dostepem",
      dashboardText: "Spokojny ekran dla biura, monitora lub pojazdu: dashboard i Workzone live.",
      paperlessLead: "Mniej papieru. Wiecej jasnosci.",
      paperlessText: "Dokumenty, historia i status pozostaja polaczone cyfrowo.",
      finalDemoCta: "Wroc do demo",
    },
    ro: {
      title: "Vezi live in loc sa citesti.",
      text: "Testeaza Workzone direct in browser.",
      cta: "Porneste demo",
      adminLabel: "Administrare",
      displayLabel: "Display",
      adminTitle: "Administrarea, rapoartele si asistenta raman separate",
      adminText: "Acelasi aspect de logo, drepturi separate: Admin Assistant citeste administrare si rapoarte, Worker Helper ramane la Workzone.",
      dashboardTitle: "Dashboard cu acces propriu",
      dashboardText: "Un ecran clar pentru birou, monitor sau vehicul: dashboard si Workzone live.",
      paperlessLead: "Mai putina hartie. Mai multa claritate.",
      paperlessText: "Documentele, istoricul si statusul raman conectate digital.",
      finalDemoCta: "Inapoi la demo",
    },
    sq: {
      title: "Shihe live, jo me shpjegim te gjate.",
      text: "Testo Workzone direkt ne browser.",
      cta: "Nis demo",
      adminLabel: "Administrim",
      displayLabel: "Display",
      adminTitle: "Administrimi, raportet dhe asistenca mbeten te ndara",
      adminText: "E njejta pamje logoje, te drejta te ndara: Admin Assistant lexon administrim dhe raporte, Worker Helper mbetet te Workzone.",
      dashboardTitle: "Dashboard me hyrje te vecante",
      dashboardText: "Ekran i qete per zyre, monitor ose makine: dashboard dhe Workzone live.",
      paperlessLead: "Me pak letra. Me shume qartesi.",
      paperlessText: "Dokumentet, historia dhe statusi mbeten te lidhura digitalisht.",
      finalDemoCta: "Shko lart te demo",
    },
  }[landingLang];

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#10211a] text-white">
      <LandingLanguageControl content={content.language} />
      <SideNavigation />

      <section id="overview" className="scroll-mt-28">
        <HeroSection content={content.hero} initialTheme={initialTheme} landingLang={landingLang} demoEnabled={demoEnabled} />
        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <ProblemSolutionSection content={content.problemSolution} />
        </div>
        <ProductsSection isSaasMode={isSaasMode} landingLang={landingLang} />
        {workshopDemoEnabled ? <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8"><section id="werkstatt-demo" className="my-12 rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)] sm:p-8">
          <SectionIntro eyebrow={workshop.demo} title={workshop.title} text={workshop.subtitle} />
          <p className="mt-4 text-sm font-semibold text-emerald-200">{workshop.received} → {workshop.repairing} → {workshop.repaired}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{workshop.featureSummary}</p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{workshop.demoHint}</p>
          <a href="/demo/workshop" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-emerald-300 px-5 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#10211a]">{workshop.open}</a>
        </section></div> : null}
      </section>

      <div className={`relative z-10 mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 ${workshopDemoEnabled ? "" : "pb-8"}`}>
        <section id="betrieb" className="scroll-mt-28">
          <FeaturesSection content={content.features} />
        </section>

        <section id="verwaltung" className="scroll-mt-28">
          <div className="mt-18">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">{demoPush.adminLabel}</div>
              <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.2rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
                {demoPush.adminTitle}
              </h2>
              <p className="mt-3 text-[0.96rem] leading-6.5 text-white/68">{demoPush.adminText}</p>
            </div>
            <div className="mt-7 grid gap-3 lg:grid-cols-3">
              <KalkulatorSection content={content.calculator} />
              <SecuritySection content={content.security} />
              <article className="h-full rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_16px_32px_rgba(0,0,0,0.12)]">
                <span className="inline-flex size-9 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
                  <MonitorPlay className="size-[1.125rem]" />
                </span>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">{demoPush.displayLabel}</div>
                <h3 className="mt-2.5 text-[1.25rem] font-semibold tracking-tight text-white">{demoPush.dashboardTitle}</h3>
                <p className="mt-2.5 text-[0.93rem] leading-6 text-white/68">{demoPush.dashboardText}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="smart" className="scroll-mt-28">
          <PositioningSection content={content.positioning} landingLang={landingLang} />
          <div className="mx-auto mt-8 max-w-3xl text-center">
            <p className="text-[1rem] font-medium text-white/90">{demoPush.paperlessLead}</p>
            <p className="mt-2 text-[0.95rem] leading-6.5 text-white/60">{demoPush.paperlessText}</p>
          </div>
        </section>

        <section id="produkt" className="mt-16">
          <SectionIntro {...content.sections.previewsIntro} />

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {content.sections.previews.map((card) => (
              <TaskCard
                key={card.title}
                title={card.title}
                text={card.text}
              />
            ))}
          </div>
        </section>

        <div className="mt-12 flex justify-center">
          <a
            href="#produktvorschau"
            className="inline-flex items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-300/16"
          >
            {demoPush.finalDemoCta}
          </a>
        </div>

        <div className={workshopDemoEnabled ? "mt-10" : "mt-10 border-t border-white/10 pt-5"}>
          {workshopDemoEnabled ? <BaumdienstDemoFooter lang={currentLang} onDark /> : <RediOnFooter onDark />}
        </div>
      </div>
    </main>
  );
}
