import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { SteelPhaseArt } from './steel-art';
import { steelWorkArtKey, steelWorkLabel } from './work-catalog-label';
import { t } from '@/lib/i18n';

it('shows translated builtin labels instead of empty catalog and checkbox names in every supported language', () => {
  for (const lang of ['sq', 'en', 'de', 'it', 'ro', 'pl']) {
    for (const [kind, key, translation] of [['site', 'steel-columns', 'steel.columns'], ['factory', 'cutting', 'factory.steps.cutting'], ['field', 'mounted', 'elements.fieldStages.mounted']] as const) {
      const label = steelWorkLabel({ kind, key, label: '' }, lang);
      expect(label).toBe(t(translation, lang)); expect(label.trim()).not.toBe(''); expect(label).not.toBe(translation);
    }
    expect(steelWorkLabel({ kind: 'site', key: 'steel-columns', label: 'Custom fixture label' }, lang)).toBe('Custom fixture label');
  }
});

it('renders the correct existing SVG fallback for prefixed builtin site keys and a safe generic scene for custom tasks', () => {
  expect(steelWorkArtKey('steel-columns')).toBe('columns');
  expect(steelWorkArtKey('steel-task-fixture0001')).toBe('task');
  for (const key of ['steel-columns', 'steel-foundation', 'steel-task-fixture0001']) {
    const markup = renderToStaticMarkup(createElement(SteelPhaseArt, { phase: steelWorkArtKey(key), animate: false }));
    expect(markup).toContain('<svg'); expect(markup).toContain('viewBox="0 0 160 120"');
  }
});
