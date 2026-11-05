import { expect, it } from 'vitest';
import { parseSteelScene, renderSteelScene } from './visual';

const scene = { v: 1, shapes: [{ type: 'rect', x: 30, y: 90, width: 200, height: 15, color: 'steel' }, { type: 'line', from: [70, 90], to: [150, 30], width: 3, color: 'orange' }] };
it('renders only validated geometry with the established palette', () => {
  const svg = renderSteelScene(scene);
  expect(svg).toContain('viewBox="0 0 320 160"'); expect(svg).toContain('#f97316');
  expect(svg).not.toMatch(/script|foreignObject|href|style=|onload|<text/i);
});
it.each([
  '<svg onload="alert(1)"></svg>', { ...scene, script: 'alert(1)' },
  { v: 1, shapes: [{ type: 'image', href: 'https://foreign.example.test/private' }] },
  { v: 1, shapes: [{ ...scene.shapes[0], color: 'url(https://foreign.example.test)' }] },
  { v: 1, shapes: [{ ...scene.shapes[0], x: Infinity }] },
  { v: 1, shapes: Array.from({ length: 25 }, () => scene.shapes[0]) },
  { v: 1, shapes: [{ ...scene.shapes[0], onload: 'alert(1)' }] },
])('rejects executable, external, oversized or malformed scenes (%j)', input => {
  expect(parseSteelScene(input)).toBeNull(); expect(renderSteelScene(input)).toBeNull();
});
it('bounds output size and accepts a single JSON code fence without evaluating code', () => {
  expect(parseSteelScene(' '.repeat(13_000) + JSON.stringify(scene))).not.toBeNull(); // Surrounding whitespace is discarded.
  expect(parseSteelScene(JSON.stringify({ ...scene, padding: 'x'.repeat(13_000) }))).toBeNull();
  expect(parseSteelScene('```json\n' + JSON.stringify(scene) + '\n```')).toEqual(scene);
});
