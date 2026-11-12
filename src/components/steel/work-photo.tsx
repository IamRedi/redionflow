/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import { steelWorkPhoto } from '@/lib/steel-work/photo-style';

/** Synthetic decoration, not a record of this company's work or premises. */
export function SteelWorkPhoto({ definition, fallback, className = 'h-full w-full' }: {
  definition?: { key?: string | null; label?: string | null; description?: string | null; linkedProcessKey?: string | null; kind?: string } | null;
  fallback?: string; className?: string;
}) {
  const photo = steelWorkPhoto(definition ?? {}, fallback);
  return <span aria-hidden="true" data-steel-work-photo className={`relative block overflow-hidden ${className}`}>
    {photo.panel === undefined ? <img alt="" src={photo.src} className="absolute inset-0 h-full w-full object-cover" /> :
      <span className="absolute left-0 top-1/2 w-full -translate-y-1/2" style={{ aspectRatio: '1', backgroundImage: `url(${photo.src})`, backgroundSize: '300% 200%', backgroundPosition: `${(photo.panel % 3) * 50}% ${Math.floor(photo.panel / 3) * 100}%` } as CSSProperties} />}
  </span>;
}
