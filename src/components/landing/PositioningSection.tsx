import { Bell, Bot, MapPinned, MonitorPlay, ScanLine, Smartphone } from "lucide-react";

import type { LandingContent } from "./landing-content";

const smartContent = {
  de: {
    eyebrow: "Game Changer",
    title: "Kleine Dinge, die den Betrieb spuerbar schneller machen",
    text: "BaumdienstFlow ist fuer den Alltag draussen gebaut: schnell, mobil und direkt im Arbeitsfluss.",
    items: [
      { icon: ScanLine, title: "Scan statt Suchen", text: "Barcode per Handykamera, NFC-ready fuer Inventar und Baum-ID." },
      { icon: MapPinned, title: "Live GPS fuer Flotte", text: "Maschine, Baustelle und Tagesbericht bleiben verbunden." },
      { icon: Smartphone, title: "Auf jedem Geraet", text: "Android, iPhone, iPad, Windows und Browser ohne Installation." },
      { icon: Bell, title: "Wichtige Meldungen", text: "Push fuer Tagesplan, Admin-Info und wichtige Aenderungen." },
      { icon: Bot, title: "Role-sichere Assistenz", text: "Gleiche Logo-Optik, aber Admin und Worker bleiben im eigenen Scope." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard und Workzone Live auf Monitor oder Fahrzeugdisplay." },
    ],
  },
  en: {
    eyebrow: "Game Changer",
    title: "Small details that make operations faster",
    text: "BaumdienstFlow is built for real field work: fast, mobile and inside the daily flow.",
    items: [
      { icon: ScanLine, title: "Scan instead of search", text: "Phone-camera barcode, NFC-ready for inventory and tree ID." },
      { icon: MapPinned, title: "Live GPS for fleet", text: "Machine, job site and daily report stay connected." },
      { icon: Smartphone, title: "Every device", text: "Android, iPhone, iPad, Windows and browser without installation." },
      { icon: Bell, title: "Important alerts", text: "Push for daily plans, admin notes and important changes." },
      { icon: Bot, title: "Role-safe assistance", text: "Same logo look, but admin and worker stay in their own scope." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard and live Workzone on a monitor or vehicle display." },
    ],
  },
  it: {
    eyebrow: "Game Changer",
    title: "Piccoli dettagli che rendono il lavoro piu veloce",
    text: "BaumdienstFlow e costruito per il lavoro reale sul campo: rapido, mobile e dentro il flusso quotidiano.",
    items: [
      { icon: ScanLine, title: "Scansione invece di ricerca", text: "Barcode con la camera del telefono, NFC-ready per inventario e Tree-ID." },
      { icon: MapPinned, title: "GPS live per la flotta", text: "Macchina, cantiere e rapporto giornaliero restano collegati." },
      { icon: Smartphone, title: "Su ogni dispositivo", text: "Android, iPhone, iPad, Windows e browser senza installazione." },
      { icon: Bell, title: "Avvisi importanti", text: "Push per piano giornaliero, note admin e modifiche importanti." },
      { icon: Bot, title: "Assistenza sicura per ruolo", text: "Stesso aspetto del logo, ma admin e worker restano nel proprio scope." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard e Workzone live su monitor o display del veicolo." },
    ],
  },
  pl: {
    eyebrow: "Game Changer",
    title: "Male detale, ktore wyraznie przyspieszaja prace",
    text: "BaumdienstFlow powstal do codziennej pracy w terenie: szybko, mobilnie i bezposrednio w procesie.",
    items: [
      { icon: ScanLine, title: "Skan zamiast szukania", text: "Kod kreskowy kamera telefonu, NFC-ready dla magazynu i Tree-ID." },
      { icon: MapPinned, title: "GPS live dla floty", text: "Maszyna, miejsce pracy i raport dzienny pozostaja polaczone." },
      { icon: Smartphone, title: "Na kazdym urzadzeniu", text: "Android, iPhone, iPad, Windows i przegladarka bez instalacji." },
      { icon: Bell, title: "Wazne powiadomienia", text: "Push dla planu dnia, informacji admina i waznych zmian." },
      { icon: Bot, title: "Asystencja wedlug roli", text: "Ten sam wyglad logo, ale admin i worker pozostaja w swoim zakresie." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard i Workzone live na monitorze lub wyswietlaczu pojazdu." },
    ],
  },
  ro: {
    eyebrow: "Game Changer",
    title: "Detalii mici care accelereaza vizibil operatiunile",
    text: "BaumdienstFlow este construit pentru munca reala pe teren: rapid, mobil si direct in fluxul zilnic.",
    items: [
      { icon: ScanLine, title: "Scanare in loc de cautare", text: "Barcode cu camera telefonului, NFC-ready pentru inventar si Tree-ID." },
      { icon: MapPinned, title: "GPS live pentru flota", text: "Masina, santierul si raportul zilnic raman conectate." },
      { icon: Smartphone, title: "Pe orice dispozitiv", text: "Android, iPhone, iPad, Windows si browser fara instalare." },
      { icon: Bell, title: "Notificari importante", text: "Push pentru planul zilnic, informatii admin si modificari importante." },
      { icon: Bot, title: "Asistenta sigura pe roluri", text: "Acelasi aspect de logo, dar adminul si workerul raman in scope-ul lor." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard si Workzone live pe monitor sau display de vehicul." },
    ],
  },
  sq: {
    eyebrow: "Game Changer",
    title: "Detaje te vogla qe e shpejtojne punen",
    text: "BaumdienstFlow eshte ndertuar per terren: shpejt, mobil dhe direkt ne rrjedhen e punes.",
    items: [
      { icon: ScanLine, title: "Scan, jo kerkim", text: "Barcode me kameren e telefonit, NFC-ready per inventar dhe Tree-ID." },
      { icon: MapPinned, title: "GPS live per floten", text: "Makina, kantieri dhe raporti ditor mbeten te lidhura." },
      { icon: Smartphone, title: "Ne cdo pajisje", text: "Android, iPhone, iPad, Windows dhe browser pa instalim." },
      { icon: Bell, title: "Njoftime te rendesishme", text: "Push per plan ditor, info nga admini dhe ndryshime te rendesishme." },
      { icon: Bot, title: "Asistence sipas rolit", text: "E njejta pamje logoje, por admini dhe workeri mbeten ne scope-in e vet." },
      { icon: MonitorPlay, title: "Display View", text: "Dashboard dhe Workzone live ne monitor ose makine." },
    ],
  },
} as const;

export function PositioningSection({
  content: _content,
  landingLang,
}: {
  content: LandingContent["positioning"];
  landingLang: keyof typeof smartContent;
}) {
  const section = smartContent[landingLang];

  return (
    <section className="mt-20">
      <div className="mx-auto max-w-4xl text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          {section.eyebrow}
        </div>

        <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.15rem] lg:text-[2.35rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
          {section.title}
        </h2>

        <p className="mx-auto mt-3 max-w-3xl text-[0.96rem] leading-6.5 text-white/68">
          {section.text}
        </p>

        <div className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.slice(0, 6).map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-white/[0.045] p-[1.125rem] text-left shadow-[0_16px_32px_rgba(0,0,0,0.12)]">
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-emerald-400/12 text-emerald-300">
                <Icon className="size-[1.125rem]" />
              </span>
              <h3 className="mt-3.5 text-[1rem] font-semibold text-white">{title}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-5.5 text-white/68">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
