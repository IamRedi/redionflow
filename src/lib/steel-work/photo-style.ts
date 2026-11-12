/** One photographic identity for catalog thumbnails, work cards and AI edits. */
export const STEEL_WORK_PHOTO_STYLE = 'alsteel-industrial-photo-v2';
export const STEEL_WORK_PHOTO_REFERENCE = 'public/steel-studio-v1/processes.webp';

export const STEEL_WORK_PHOTO_DIRECTION = `Photorealistic premium industrial editorial photography: realistic camera optics, physical scale and brushed steel textures, warm natural daylight, limestone/concrete and walnut-brown shadows, restrained copper amber tools and muted deep teal accents. A believable contemporary European steel workshop or construction site. Absolutely NOT illustration, vector art, sketch, cartoon, isometric miniature, animation, glossy 3D render or abstract shapes. Fictional illustrative imagery, never evidence of an actual company, completed work, measured geometry or safety instructions.`;

export type SteelWorkPhoto = { src: string; panel?: number };
const detail = (name: string): SteelWorkPhoto => ({ src: `/steel-process-photos-v1/${name}.webp` });
const atlas = (panel: number): SteelWorkPhoto => ({ src: '/steel-studio-v1/processes.webp', panel });
const subjects: Record<string, SteelWorkPhoto> = {
  foundation: detail('foundation'), anchors: detail('foundation-anchors'), columns: detail('columns'),
  trusses: detail('trusses'), roofPanels: detail('roof-panels'), wallPanels: detail('wall-panels'),
  roofTrim: detail('roof-trim'), stairs: detail('stairs'), studs: detail('stud-welding'),
  panelScrews: detail('panel-screws'), cutting: detail('cutting'), drilling: detail('drilling'),
  bolted: detail('bolting'), staging: detail('staging'), received: detail('receiving'), mounted: detail('columns'),
  assembly: atlas(1), welding: atlas(2), cleaning: atlas(3), painting: atlas(4), coating: atlas(4),
  touchup: atlas(4), loading: atlas(5), final: atlas(5),
  gutter: { src: '/steel-studio-v1/gutter.webp' }, purlins: { src: '/steel-studio-v1/purlins.webp' },
  inspection: { src: '/steel-studio-v1/inspection.webp' },
};
const normalized = (value?: string | null) => (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Specific operations first; a workpiece word must not replace its actual action. */
function namedSubject(text: string): string | undefined {
  if (/\b(gati|ready|staging)\b/.test(text) && /\b(ngark\w*|load\w*)\b/.test(text)) return 'staging';
  if (/\b(piol\w*|studs?|shear connectors?)\b/.test(text)) return 'studs';
  if (/\b(vida|vidash|screws?)\b/.test(text) && /\b(panel\w*|mbules\w*|vesh\w*)\b/.test(text)) return 'panelScrews';
  if (/\b(ulluk\w*|gutter\w*)\b/.test(text)) return 'gutter';
  if (/\b(ristel[ei]m\w*|purlin\w*)\b/.test(text)) return 'purlins';
  if (/\b(kontroll\w*|inspekt\w*|inspection)\b/.test(text)) return 'inspection';
  if (/\b(prizhioner\w*|prigionier\w*|tirafond\w*|anker\w*|ankor\w*|anchor\w*)\b/.test(text)) return 'anchors';
  if (/\b(sald\w*|weld\w*)\b/.test(text)) return 'welding';
  if (/\b(prer\w*|cutting|sawing)\b/.test(text)) return 'cutting';
  if (/\b(shpim\w*|drilling)\b/.test(text)) return 'drilling';
  if (/\b(pastr\w*|cleaning|grinding)\b/.test(text)) return 'cleaning';
  if (/\b(lyer\w*|zink\w*|coating|painting|touchup)\b/.test(text)) return 'painting';
  if (/\b(ngark\w*|loading)\b/.test(text)) return 'loading';
  if (/\b(pranim\w*|received|receiving)\b/.test(text)) return 'received';
  if (/\bmontim\w*(?:\s+i)?\s+bord\w*\b|\bflashing\b|\broof trim\b/.test(text)) return 'roofTrim';
  if (/\bpanel\w*\b/.test(text) && /\b(vesh\w*|fasad\w*|wall|cladding)\b/.test(text)) return 'wallPanels';
  if (/\bpanel\w*\b/.test(text) && /\b(mbules\w*|cati\w*|roof\w*|cover\w*)\b/.test(text)) return 'roofPanels';
  if (/\b(shkall\w*|stairs?|staircase)\b/.test(text)) return 'stairs';
  if (/\b(kapriat\w*|truss\w*)\b/.test(text)) return 'trusses';
  if (/\b(kolon\w*|columns?)\b/.test(text)) return 'columns';
  if (/\b(bazament\w*|themel\w*|foundation|footing)\b/.test(text)) return 'foundation';
  if (/\b(bulon\w*|bolting)\b/.test(text)) return 'bolted';
  if (/\b(asambl\w*|asamb\w*|assembly)\b/.test(text)) return 'assembly';
}

/** Unknown custom work gets neutral site context, never an invented operation. */
export function steelWorkPhoto(input: { key?: string | null; label?: string | null; description?: string | null; linkedProcessKey?: string | null; kind?: string }, fallback?: string): SteelWorkPhoto {
  const label = normalized(input.label), description = normalized(input.description);
  const key = (input.key ?? '').replace(/^steel-/, '');
  // A linked material process is supporting context, not the task's visual identity.
  // Example: legacy "Saldim" linked to assembly still needs a welding photo.
  const subject = namedSubject(label) ?? (label || !Object.hasOwn(subjects, key) ? namedSubject(description) : undefined)
    ?? (Object.hasOwn(subjects, key) ? key : undefined)
    ?? [input.linkedProcessKey, fallback].map(value => value?.replace(/^steel-/, '')).find(value => value && Object.hasOwn(subjects, value));
  if (subject) return subjects[subject];
  return { src: `/steel-studio-v1/${input.kind === 'factory' || ['drilling', 'laser'].includes(key) ? 'factory' : 'site'}.webp` };
}
