/** Only our authenticated photo route supports renditions. Never rewrite external URLs. */
export const PHOTO_WIDTHS = [96, 192] as const;
export type PhotoShape = 'square' | '4x3' | '6x5';
export function photoShape(value: string | null): PhotoShape | null {
  return value === 'square' || value === '4x3' || value === '6x5' ? value : null;
}
export function photoWidth(value: string | null): number | null {
  return PHOTO_WIDTHS.find(width => String(width) === value) ?? null;
}
export function photoSrcSet(src: string, shape: PhotoShape = 'square'): string | undefined {
  if (!/^\/api\/asset-photos\/(worker|machine|site)\/[a-z0-9_-]+(?:\?|$)/i.test(src)) return;
  const url = new URL(src, 'https://photo.invalid');
  return [...PHOTO_WIDTHS.map(width => {
    url.searchParams.set('w', String(width));
    url.searchParams.set('shape', shape);
    return `${url.pathname}${url.search} ${width}w`;
  }), `${src} 1024w`].join(', ');
}
