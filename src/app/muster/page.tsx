import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowRight, BriefcaseBusiness, Factory, HardHat, SunMoon, UserRound, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { RediOnFooter } from '@/components/branding/RediOnFooter';
import { resolveRequestLanguage } from '@/lib/i18n/server';
import { getBauflowDemoAccount } from '@/lib/demo/bauflow-muster-access';
import { enterBauflowDemo } from './actions';
import '@/components/steel/steel-studio.css';

export const metadata: Metadata = { title: 'BauFlow · Musterfirma', robots: { index: false, follow: false } };
const productName = 'BauFlow';
const profileName = 'BauFlow · Musterfirma';

const copy = {
  de: { title: 'Ein Betrieb. Ein gemeinsamer Ablauf.', intro: 'Büro, Fertigung und Baustelle im selben BauFlow-System.', note: 'Öffentliche Musterfirma mit erfundenen Daten. Änderungen sind für andere Tester sichtbar. Bitte nur Testdaten verwenden.', owner: 'Geschäftsführung', office: 'Buchhaltung', field: 'Baustelle', factory: 'Fertigung', workshop: 'Werkstatt', theme: 'Tag / Nacht', busy: 'Bitte kurz warten und später erneut öffnen.', legal: 'Impressum', privacy: 'Datenschutz Website' },
  sq: { title: 'Një firmë. Një rrjedhë e përbashkët.', intro: 'Zyra, fabrika dhe kantieri në të njëjtin sistem BauFlow.', note: 'Musterfirma publike me të dhëna fiktive. Ndryshimet shihen edhe nga testuesit e tjerë. Përdor vetëm të dhëna provë.', owner: 'Shefi', office: 'Ekonomistja', field: 'Kantieri', factory: 'Fabrika', workshop: 'Oficina', theme: 'Ditë / Natë', busy: 'Prit pak dhe provo sërish më vonë.', legal: 'Informacion ligjor', privacy: 'Privatësia e website-it' },
  en: { title: 'One company. One shared workflow.', intro: 'Office, fabrication and site in the same BauFlow system.', note: 'Public sample company with fictional data. Changes are shared with other testers. Please use test data only.', owner: 'Management', office: 'Accounting', field: 'Site', factory: 'Fabrication', workshop: 'Workshop', theme: 'Day / Night', busy: 'Please wait and try again later.', legal: 'Legal notice', privacy: 'Website privacy' },
  it: { title: 'Un’azienda. Un flusso condiviso.', intro: 'Ufficio, produzione e cantiere nello stesso sistema BauFlow.', note: 'Azienda dimostrativa pubblica con dati fittizi. Le modifiche sono visibili agli altri utenti della demo. Usa solo dati di prova.', owner: 'Direzione', office: 'Contabilità', field: 'Cantiere', factory: 'Produzione', workshop: 'Officina', theme: 'Giorno / Notte', busy: 'Attendi e riprova più tardi.', legal: 'Note legali', privacy: 'Website privacy' },
  pl: { title: 'Jedna firma. Wspólny proces pracy.', intro: 'Biuro, produkcja i budowa w jednym systemie BauFlow.', note: 'Publiczna firma demonstracyjna z fikcyjnymi danymi. Zmiany są widoczne dla innych testerów. Używaj tylko danych testowych.', owner: 'Kierownictwo', office: 'Księgowość', field: 'Budowa', factory: 'Produkcja', workshop: 'Warsztat', theme: 'Dzień / Noc', busy: 'Poczekaj i spróbuj ponownie później.', legal: 'Informacje prawne', privacy: 'Prywatność strony' },
  ro: { title: 'O firmă. Un flux comun de lucru.', intro: 'Birou, producție și șantier în același sistem BauFlow.', note: 'Firmă demonstrativă publică cu date fictive. Modificările sunt vizibile pentru ceilalți testeri. Folosește doar date de test.', owner: 'Conducere', office: 'Contabilitate', field: 'Șantier', factory: 'Producție', workshop: 'Atelier', theme: 'Zi / Noapte', busy: 'Așteaptă și încearcă din nou mai târziu.', legal: 'Informații legale', privacy: 'Confidențialitatea site-ului' },
};

const roles = [
  { role: 'owner', name: 'Nora König', icon: UserRound },
  { role: 'office', name: 'Mira Weber', icon: BriefcaseBusiness },
  { role: 'field', name: 'Luca Rossi', icon: HardHat },
  { role: 'factory', name: 'Deniz Yilmaz', icon: Factory },
  { role: 'workshop', name: 'Emma Schulz', icon: Wrench },
] as const;

export default async function MusterPage({ searchParams }: { searchParams: Promise<{ busy?: string }> }) {
  if (!await getBauflowDemoAccount('owner')) notFound();
  const lang = await resolveRequestLanguage();
  const c = copy[lang];
  const busy = (await searchParams).busy === '1';
  return <div data-steel-studio className="bauflowMusterEntry flex min-h-dvh min-w-0 flex-col p-3 sm:p-6" data-testid="muster-entry">
    <header className="flex items-center justify-end gap-2">
      <LanguageSwitcher />
      <form method="post" action="/app/toggle-theme"><Button type="submit" variant="outline" className="size-11 rounded-full p-0" aria-label={c.theme} title={c.theme}><SunMoon /></Button></form>
    </header>
    <main className="flex flex-1 items-center justify-center py-4">
      <section data-studio-home className="bauflowMusterEntryPanel w-full max-w-md rounded-3xl border p-5 sm:p-7">
        <Image src="/bauflow-muster-v1/brand-profile.webp" width={76} height={76} alt={productName} className="mb-4 rounded-full" priority unoptimized />
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{profileName}</p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.intro}</p>
        <div className="mt-5 grid gap-2">
          {roles.map(({ role, name, icon: Icon }) => <form action={enterBauflowDemo} key={role}>
            <input type="hidden" name="role" value={role} />
            <Button type="submit" variant={role === 'owner' ? 'default' : 'outline'} data-demo-role={role} className="h-auto min-h-14 w-full justify-start rounded-xl px-3 py-2 text-left">
              <Icon className="size-5" /><span className="min-w-0 flex-1 whitespace-normal"><strong className="block text-sm">{c[role]}</strong><span className="block text-xs opacity-80">{name}</span></span><ArrowRight />
            </Button>
          </form>)}
        </div>
        {busy ? <p role="status" className="mt-3 text-sm font-medium">{c.busy}</p> : null}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{c.note}</p>
      </section>
    </main>
    <div className="text-center text-xs"><nav className="flex flex-wrap justify-center gap-x-4"><a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline" href="https://www.baumdienstflow.de/bauflow/impressum.html">{c.legal}</a><a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline" href="https://www.baumdienstflow.de/bauflow/datenschutz.html">{c.privacy}</a></nav><RediOnFooter /></div>
  </div>;
}
