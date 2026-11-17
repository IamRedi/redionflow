import type { Language } from '@/lib/i18n';

const copy = {
  sq: ['Informacion ligjor', 'Privatësia e website-it'], en: ['Legal notice', 'Website privacy'], de: ['Impressum', 'Datenschutz Website'],
  it: ['Note legali', 'Privacy del sito'], pl: ['Informacje prawne', 'Prywatność strony'], ro: ['Informații legale', 'Confidențialitatea site-ului'],
} as const;
export function MusterWorkspaceLegal({ lang }: { lang: Language }) {
  const labels = copy[lang];
  return <nav data-muster-legal aria-label={labels[0]} className="flex flex-wrap justify-center gap-x-4 text-xs"><a className="inline-flex min-h-11 items-center hover:underline focus-visible:outline" href="https://www.baumdienstflow.de/bauflow/impressum.html">{labels[0]}</a><a className="inline-flex min-h-11 items-center hover:underline focus-visible:outline" href="https://www.baumdienstflow.de/bauflow/datenschutz.html">{labels[1]}</a></nav>;
}
