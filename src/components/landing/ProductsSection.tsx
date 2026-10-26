"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, HardHat, TreePine } from "lucide-react";

import type { LandingLanguage } from "./landing-content";

type ProductKey = "baumdienst" | "bau";

const productsContent: Record<LandingLanguage, {
  products: Array<{
  key: ProductKey;
  name: string;
  icon: typeof TreePine;
  tagline: string;
  bullets: string[];
  }>;
  sectionLabel: string;
  sectionTitle: string;
  sectionCopy: string;
  saasLabel: string;
  dedicatedLabel: string;
  saasCopy: string;
  dedicatedCopy: string;
  existingCustomer: string;
  loginLabel: string;
  ctaSaas: string;
  ctaDedicated: string;
}> = {
  de: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "Für Baumdienstbetriebe — die Referenzimplementierung.",
        bullets: [
          "Baustellen, Bäume und Team in einem System",
          "Kalkulation, Angebote und Feldeinsatz verzahnt",
          "Volle Workzone mit GPS, Inventar und Reports",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "Für Baubetriebe — dieselbe Plattform, ohne Baumlogik.",
        bullets: [
          "Baustellen, Aufgaben und Material zentral",
          "Team, Flotte, Inventar und Sicherheitsmaterial",
          "Reports und Sicherheit ohne Baumdienst-Spezifika",
        ],
      },
    ],
    sectionLabel: "Produkte",
    sectionTitle: "Ein System, zwei klare Zuschnitte.",
    sectionCopy: "Dieselbe Plattform, dieselbe Datenbasis — sichtbar wird nur, was der Betrieb braucht. Wählen Sie das Produkt, das zu Ihnen passt.",
    saasLabel: "SaaS-Plattform",
    dedicatedLabel: "Dedizierte Instanz",
    saasCopy: "Direkt online loslegen. 14 Tage kostenlos, keine Kreditkarte.",
    dedicatedCopy: "Eigene Datenbank, eigene Infrastruktur, direkter Kundenkontakt.",
    existingCustomer: "Schon Kunde?",
    loginLabel: "Anmelden",
    ctaSaas: "14 Tage kostenlos starten",
    ctaDedicated: "Für dedizierte Instanz anfragen",
  },
  en: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "For tree service companies — the reference implementation.",
        bullets: [
          "Job sites, trees and crew in one system",
          "Calculation, offers and field work connected",
          "Full Workzone with GPS, inventory and reports",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "For construction companies — the same platform without tree-specific logic.",
        bullets: [
          "Job sites, tasks and material in one place",
          "Crew, fleet, inventory and safety material",
          "Reports and safety without tree-service specifics",
        ],
      },
    ],
    sectionLabel: "Products",
    sectionTitle: "One system, two clear editions.",
    sectionCopy: "Same platform, same data foundation — only what the business needs is visible. Choose the product that fits you.",
    saasLabel: "SaaS platform",
    dedicatedLabel: "Dedicated instance",
    saasCopy: "Start online right away. 14 days free, no credit card.",
    dedicatedCopy: "Own database, own infrastructure, direct customer contact.",
    existingCustomer: "Already a customer?",
    loginLabel: "Sign in",
    ctaSaas: "Start 14 days free",
    ctaDedicated: "Request dedicated instance",
  },
  it: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "Per aziende di tree service - l'implementazione di riferimento.",
        bullets: [
          "Cantieri, alberi e squadra in un unico sistema",
          "Calcolo, offerte e lavoro sul campo collegati",
          "Workzone completa con GPS, inventario e report",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "Per imprese edili - la stessa piattaforma senza logica per alberi.",
        bullets: [
          "Cantieri, attivita e materiale in un solo posto",
          "Squadra, flotta, inventario e materiale di sicurezza",
          "Report e sicurezza senza specifiche da tree service",
        ],
      },
    ],
    sectionLabel: "Prodotti",
    sectionTitle: "Un sistema, due versioni chiare.",
    sectionCopy: "Stessa piattaforma, stessa base dati: si vede solo cio che serve all'azienda. Scegli il prodotto adatto.",
    saasLabel: "Piattaforma SaaS",
    dedicatedLabel: "Istanza dedicata",
    saasCopy: "Inizia subito online. 14 giorni gratis, senza carta di credito.",
    dedicatedCopy: "Database proprio, infrastruttura propria, contatto diretto con il cliente.",
    existingCustomer: "Gia cliente?",
    loginLabel: "Accedi",
    ctaSaas: "Inizia 14 giorni gratis",
    ctaDedicated: "Richiedi istanza dedicata",
  },
  pl: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "Dla firm arborystycznych - wdrozenie referencyjne.",
        bullets: [
          "Miejsca pracy, drzewa i zespol w jednym systemie",
          "Kalkulacje, oferty i praca w terenie polaczone",
          "Pelna Workzone z GPS, magazynem i raportami",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "Dla firm budowlanych - ta sama platforma bez logiki drzew.",
        bullets: [
          "Miejsca pracy, zadania i material w jednym miejscu",
          "Zespol, flota, magazyn i material BHP",
          "Raporty i bezpieczenstwo bez specyfiki arborystycznej",
        ],
      },
    ],
    sectionLabel: "Produkty",
    sectionTitle: "Jeden system, dwie jasne wersje.",
    sectionCopy: "Ta sama platforma, ta sama baza danych: widoczne jest tylko to, czego firma potrzebuje. Wybierz produkt dla siebie.",
    saasLabel: "Platforma SaaS",
    dedicatedLabel: "Instancja dedykowana",
    saasCopy: "Start online od razu. 14 dni za darmo, bez karty kredytowej.",
    dedicatedCopy: "Wlasna baza danych, wlasna infrastruktura, bezposredni kontakt z klientem.",
    existingCustomer: "Masz juz konto?",
    loginLabel: "Zaloguj",
    ctaSaas: "Zacznij 14 dni za darmo",
    ctaDedicated: "Zapytaj o instancje dedykowana",
  },
  ro: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "Pentru firme de servicii arboricole - implementarea de referinta.",
        bullets: [
          "Santiere, arbori si echipa intr-un singur sistem",
          "Calculatie, oferte si munca pe teren conectate",
          "Workzone completa cu GPS, inventar si rapoarte",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "Pentru firme de constructii - aceeasi platforma fara logica de arbori.",
        bullets: [
          "Santiere, sarcini si materiale intr-un singur loc",
          "Echipa, flota, inventar si materiale de siguranta",
          "Rapoarte si siguranta fara specific de servicii arboricole",
        ],
      },
    ],
    sectionLabel: "Produse",
    sectionTitle: "Un sistem, doua versiuni clare.",
    sectionCopy: "Aceeasi platforma, aceeasi baza de date: se vede doar ce are nevoie firma. Alege produsul potrivit.",
    saasLabel: "Platforma SaaS",
    dedicatedLabel: "Instanta dedicata",
    saasCopy: "Porneste online imediat. 14 zile gratuit, fara card de credit.",
    dedicatedCopy: "Baza de date proprie, infrastructura proprie, contact direct cu clientul.",
    existingCustomer: "Esti deja client?",
    loginLabel: "Autentificare",
    ctaSaas: "Incepe 14 zile gratuit",
    ctaDedicated: "Cere instanta dedicata",
  },
  sq: {
    products: [
      {
        key: "baumdienst",
        name: "BaumdienstFlow²⁶",
        icon: TreePine,
        tagline: "Per firma te sherbimit te pemeve — implementimi reference.",
        bullets: [
          "Kantiere, peme dhe ekip ne nje sistem",
          "Kalkulim, oferta dhe puna ne terren te lidhura",
          "Workzone e plote me GPS, inventar dhe raporte",
        ],
      },
      {
        key: "bau",
        name: "BauFlow²⁶",
        icon: HardHat,
        tagline: "Per firma ndertimi — e njejta platforme, pa logjike specifike per peme.",
        bullets: [
          "Kantiere, detyra dhe material ne nje vend",
          "Ekip, flote, inventar dhe material sigurie",
          "Raporte dhe siguri pa specifika te sherbimit te pemeve",
        ],
      },
    ],
    sectionLabel: "Produktet",
    sectionTitle: "Nje sistem, dy versione te qarta.",
    sectionCopy: "E njejta platforme, e njejta baze te dhenash — shfaqet vetem ajo qe i duhet biznesit. Zgjidh produktin qe te pershtatet.",
    saasLabel: "Platforme SaaS",
    dedicatedLabel: "Instance e dedikuar",
    saasCopy: "Fillo online menjehere. 14 dite falas, pa karte krediti.",
    dedicatedCopy: "Database i vet, infrastrukture e vet, kontakt direkt me klientin.",
    existingCustomer: "Je tashme klient?",
    loginLabel: "Hyr",
    ctaSaas: "Fillo 14 dite falas",
    ctaDedicated: "Kerko instance te dedikuar",
  },
};

type ProductsSectionProps = {
  isSaasMode: boolean;
  landingLang: LandingLanguage;
};

export function ProductsSection({ isSaasMode, landingLang }: ProductsSectionProps) {
  const content = productsContent[landingLang];
  const [active, setActive] = useState<ProductKey>("baumdienst");
  const product = content.products.find((p) => p.key === active) ?? content.products[0];

  const primaryCta = isSaasMode
    ? {
        label: content.ctaSaas,
        href: `/signup?mode=${product.key}`,
      }
    : {
        label: content.ctaDedicated,
        href: "mailto:contact@redion.example?subject=Dedizierte%20Instanz",
      };

  return (
    <section id="produkte" className="relative z-10 mx-auto mt-16 max-w-7xl px-5 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          {content.sectionLabel}
        </div>
        <h2 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.2rem] [font-family:'Canela','Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif]">
          {content.sectionTitle}
        </h2>
        <p className="mt-3 text-[0.96rem] leading-6.5 text-white/68">
          {content.sectionCopy}
        </p>
      </div>

      <div className="mt-7 flex flex-wrap gap-2" role="tablist">
        {content.products.map((option) => {
          const Icon = option.icon;
          const isActive = option.key === active;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(option.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-100"
                  : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white/90"
              }`}
            >
              <Icon className="size-4" />
              {option.name}
            </button>
          );
        })}
      </div>

      <article
        className="mt-6 grid gap-6 rounded-2xl border border-white/12 bg-white/[0.045] p-6 shadow-[0_16px_32px_rgba(0,0,0,0.14)] md:grid-cols-[1.2fr_1fr]"
        role="tabpanel"
      >
        <div className="min-w-0 space-y-4">
          <h3 className="text-[1.4rem] font-semibold tracking-tight text-white">
            {product.name}
          </h3>
          <p className="text-[0.98rem] leading-6.5 text-white/72">{product.tagline}</p>
          <ul className="space-y-2 text-sm text-white/78">
            {product.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className="mt-1 inline-flex size-1.5 rounded-full bg-emerald-300" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-black/25 p-5">
          <div className="space-y-1 text-sm text-white/70">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {isSaasMode ? content.saasLabel : content.dedicatedLabel}
            </div>
            <p>
              {isSaasMode
                ? content.saasCopy
                : content.dedicatedCopy}
            </p>
          </div>
          <Link
            href={primaryCta.href}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400/90 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            {primaryCta.label}
            <ArrowRight className="size-4" />
          </Link>
          {isSaasMode ? (
            <p className="text-xs text-white/50">
              {content.existingCustomer}{" "}
              <Link href="/login" className="underline hover:text-white/80">
                {content.loginLabel}
              </Link>
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
