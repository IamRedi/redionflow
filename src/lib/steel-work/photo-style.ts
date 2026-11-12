/** One photographic identity for catalog thumbnails, work cards and AI edits. */
export const STEEL_WORK_PHOTO_STYLE = 'alsteel-industrial-photo-v2';
export const STEEL_WORK_PHOTO_REFERENCE = 'public/steel-studio-v1/processes.webp';

export const STEEL_WORK_PHOTO_DIRECTION = `Photorealistic premium industrial editorial photography: realistic camera optics, physical scale and brushed steel textures, warm natural daylight, limestone/concrete and walnut-brown shadows, restrained copper amber tools and muted deep teal accents. A believable contemporary European steel workshop or construction site. Absolutely NOT illustration, vector art, sketch, cartoon, isometric miniature, animation, glossy 3D render or abstract shapes. Fictional illustrative imagery, never evidence of an actual company, completed work, measured geometry or safety instructions.`;

export type SteelWorkPhoto = { src: string; panel?: number };
const panels: Record<string, number> = { cutting: 0, assembly: 1, trusses: 1, welding: 2, cleaning: 3, painting: 4, coating: 4, touchup: 4, loading: 5, final: 5, received: 5 };

/** Unknown custom work gets neutral site context, never an invented operation. */
export function steelWorkPhoto(input: { key?: string | null; label?: string | null; linkedProcessKey?: string | null; kind?: string }, fallback?: string): SteelWorkPhoto {
  const label = (input.label ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/\b(ulluk\w*|gutter\w*)\b/.test(label)) return { src: '/steel-studio-v1/gutter.webp' };
  if (/\b(ristel[ei]m\w*|purlin\w*)\b/.test(label)) return { src: '/steel-studio-v1/purlins.webp' };
  if (/\b(kontroll\w*|inspekt\w*|inspection)\b/.test(label)) return { src: '/steel-studio-v1/inspection.webp' };
  const key = (input.linkedProcessKey ?? fallback ?? input.key ?? '').replace(/^steel-/, '');
  if (Object.hasOwn(panels, key)) return { src: '/steel-studio-v1/processes.webp', panel: panels[key] };
  return { src: `/steel-studio-v1/${input.kind === 'factory' || ['drilling', 'laser'].includes(key) ? 'factory' : 'site'}.webp` };
}
