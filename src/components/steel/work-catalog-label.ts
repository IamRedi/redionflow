import type { SteelArtKey } from '@/components/steel/steel-art';
import { workCatalogCopy } from '@/components/steel/work-catalog-copy';
import { t } from '@/lib/i18n';
import type { SteelWorkDefinitionView } from '@/lib/steel-work/types';

/** Empty builtin labels keep the established per-language names. */
export function steelWorkLabel(definition: Pick<SteelWorkDefinitionView, 'kind' | 'key' | 'label'>, lang: string) {
  if (definition.label.trim()) return definition.label;
  const key = definition.key.replace(/^steel-/, '');
  const path = definition.kind === 'site' ? `steel.${key}` : definition.kind === 'field' ? `elements.fieldStages.${key}` : `factory.steps.${key}`;
  const translated = t(path, lang);
  return translated !== path ? translated : definition.kind === 'site' ? t('steel.task', lang) : workCatalogCopy(lang).process;
}

export function steelWorkArtKey(value?: string | null): SteelArtKey {
  const key = value?.replace(/^steel-/, '');
  const aliases: Record<string, SteelArtKey> = { cleaning: 'drilling', loading: 'final', received: 'final', mounted: 'columns', bolted: 'drilling', touchup: 'painting' };
  if (key && aliases[key]) return aliases[key];
  const supported: readonly string[] = ['foundation', 'columns', 'trusses', 'painting', 'cutting', 'drilling', 'welding', 'coating', 'laser', 'assembly', 'final', 'task'];
  return key && supported.includes(key) ? key as SteelArtKey : 'task';
}
