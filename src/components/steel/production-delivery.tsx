'use client';

import { useLanguage } from '@/components/i18n/language-provider';
import { formatAmount } from '@/lib/factory/production';

const copy = {
  sq: { produced: 'Prodhuar', ready: 'Gati për ngarkim', loaded: 'Ngarkuar', separate: 'Ngarkimi konfirmohet veçmas, vetëm kur kryhet realisht.' },
  en: { produced: 'Produced', ready: 'Ready for loading', loaded: 'Loaded', separate: 'Confirm loading separately, only when it actually takes place.' },
  de: { produced: 'Produziert', ready: 'Bereit zum Verladen', loaded: 'Verladen', separate: 'Verladung separat bestätigen, erst wenn sie tatsächlich erfolgt.' },
  it: { produced: 'Prodotto', ready: 'Pronto per il carico', loaded: 'Caricato', separate: 'Conferma il carico separatamente, solo quando avviene realmente.' },
  ro: { produced: 'Produs', ready: 'Pregătit pentru încărcare', loaded: 'Încărcat', separate: 'Confirmă încărcarea separat, numai când are loc efectiv.' },
  pl: { produced: 'Wyprodukowano', ready: 'Gotowe do załadunku', loaded: 'Załadowano', separate: 'Potwierdź załadunek osobno, dopiero po jego wykonaniu.' },
};
export const productionDeliveryCopy = (lang: string) => copy[lang as keyof typeof copy] ?? copy.en;

/** Read-only quantities: no finish button or selected route can invent a loading receipt. */
export function ProductionDelivery({ produced, loaded, total, ready = Math.max(0, produced - loaded) }: { produced: number; loaded: number; total: number; ready?: number }) {
  const { currentLang: lang } = useLanguage(), c = productionDeliveryCopy(lang);
  return <div data-testid="production-delivery" className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
    <span>{c.produced} <strong>{formatAmount(produced)}/{formatAmount(total)}</strong></span>
    <span className="text-orange-800 dark:text-orange-200">{c.ready} <strong>{formatAmount(ready)}</strong></span>
    <span className="text-green-800 dark:text-green-200">{c.loaded} <strong>{formatAmount(loaded)}/{formatAmount(total)}</strong></span>
  </div>;
}
