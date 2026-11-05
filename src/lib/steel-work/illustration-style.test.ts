import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { buildSteelIllustrationPrompt, STEEL_ART_PALETTE, STEEL_ILLUSTRATION_REFERENCE_PATH, STEEL_ILLUSTRATION_STYLE_VERSION, type SteelIllustrationBriefInput } from './illustration-style';

const task = { key: 'steel-task-fixture', label: 'Montim borde', description: '', kind: 'site' as const };
function data(prompt: string) {
  return JSON.parse(prompt.split('TASK DATA (JSON):\n')[1]);
}

it('ships a compact transparent native reference that the provider can actually read', async () => {
  const bytes = await readFile(new URL(`../../../${STEEL_ILLUSTRATION_REFERENCE_PATH}`, import.meta.url));
  expect(bytes.length).toBeLessThan(100_000);
  expect(await sharp(bytes).metadata()).toMatchObject({ format: 'png', width: 640, height: 480, hasAlpha: true });
});

it('uses the exact established native palette, a stable style and a shipped reference asset', () => {
  expect(STEEL_ART_PALETTE).toEqual({ steel: '#475569', steelDark: '#1e293b', steelLight: '#94a3b8', concrete: '#a8a29e', concreteTop: '#d6d3d1', ground: '#78716c', orange: '#f97316', primer: '#c2410c', spark: '#fde047', zinc: '#cbd5e1' });
  expect(Object.isFrozen(STEEL_ART_PALETTE)).toBe(true);
  expect(STEEL_ILLUSTRATION_STYLE_VERSION).toBe('alsteel-native-v1');
  expect(STEEL_ILLUSTRATION_REFERENCE_PATH).toBe('public/illustrations/alsteel-style-v1.png');
  const prompt = buildSteelIllustrationPrompt(task);
  for (const token of Object.values(STEEL_ART_PALETTE)) expect(prompt).toContain(token);
  expect(prompt).toContain('transparent background and a 4:3 composition');
  expect(prompt).toContain('8% safe margin');
  expect(prompt).toContain('never a contact sheet');
});

it.each(['Montim borde', 'MONTIM BORDE çati', 'Montimi i bordeve', 'Montim bordesh'])('grounds the confirmed sheet-metal trim meaning of %s', label => {
  const prompt = buildSteelIllustrationPrompt({ ...task, label });
  expect(prompt).toContain('OWNER-CONFIRMED TERM');
  expect(prompt).toContain('folded sheet-metal trims at roof or facade edges');
  expect(prompt).toContain('L- or Z-section');
  expect(prompt).toContain('driver touches that screw');
});

it('preserves explicit descriptions and uses linked context only as supporting data', () => {
  const input = { ...task, description: 'Fix the folded trim along the vertical facade corner using sealed screws.', linkedProcess: { key: 'mounted', label: 'Mounting', description: 'General steel assembly', list: 'assembly' as const, elementKind: 'COLUMN' } };
  const prompt = buildSteelIllustrationPrompt(input);
  expect(data(prompt)).toEqual({ task: { key: input.key, label: input.label, description: input.description, kind: input.kind }, linkedProcess: input.linkedProcess });
  expect(prompt).toContain('explicit task description is the source of truth');
  expect(prompt).toContain('must never replace a more specific description');
  expect(prompt).toContain('Unless the explicit description specifies a different detail');
});

it.each(['Prerje profili', 'Montim kolonash', 'Transport bordesh', 'Borde elektronike'])('does not reinterpret another task as roof trim (%s)', label => {
  const prompt = buildSteelIllustrationPrompt({ ...task, label });
  expect(prompt).not.toContain('OWNER-CONFIRMED TERM');
  expect(data(prompt).task.label).toBe(label);
});

it('projects only bounded descriptive fields and excludes runtime record extras', () => {
  const input = { ...task, id: 'private-id', companyProfileId: 'private-company', projectName: 'private-project', workerName: 'private-worker', description: `\u0000${'x'.repeat(700)}`, linkedProcess: { key: 'welding', label: 'Join plates', description: 'Short weld', list: 'part' as const, elementKind: 'BEAM', companyProfileId: 'private-linked-company', id: 'private-linked-id' } };
  const prompt = buildSteelIllustrationPrompt(input), brief = data(prompt);
  expect(Object.keys(brief.task).sort()).toEqual(['description', 'key', 'kind', 'label']);
  expect(Object.keys(brief.linkedProcess).sort()).toEqual(['description', 'elementKind', 'key', 'label', 'list']);
  expect(brief.task.description).toHaveLength(500);
  expect(prompt).not.toContain('private-');
  expect(prompt).not.toContain('\u0000');
  expect(prompt).toContain('untrusted descriptive data');
});

it('bounds every optional linked field without introducing missing values as facts', () => {
  const prompt = buildSteelIllustrationPrompt({ ...task, key: 'k'.repeat(100), label: 'l'.repeat(100), linkedProcess: { key: 'p'.repeat(100), label: 'n'.repeat(100), description: 'd'.repeat(700), elementKind: 'e'.repeat(100) } });
  const brief = data(prompt);
  expect(brief.task.key).toHaveLength(64); expect(brief.task.label).toHaveLength(80);
  expect(brief.linkedProcess.key).toHaveLength(64); expect(brief.linkedProcess.label).toHaveLength(80);
  expect(brief.linkedProcess.description).toHaveLength(500); expect(brief.linkedProcess.elementKind).toHaveLength(80);
  expect(brief.linkedProcess).not.toHaveProperty('list');
  expect(prompt.length).toBeLessThan(6500);
});

it('rejects an unexpected runtime domain value instead of forwarding record data', () => {
  expect(() => buildSteelIllustrationPrompt({ ...task, kind: 'private-unexpected-value' as SteelIllustrationBriefInput['kind'] })).toThrow('ILLUSTRATION_KIND');
});
