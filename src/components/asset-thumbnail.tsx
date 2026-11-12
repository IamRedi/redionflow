/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from 'react';
import { photoSrcSet, type PhotoShape } from '@/lib/asset-photos/rendition';

/** Retina-aware previews; full cards and original stored photos stay unchanged. */
export function AssetThumbnail({ src, alt = '', sizes = '96px', shape = 'square', loading = 'lazy', ...props }:
  Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & { src: string; shape?: PhotoShape }) {
  return <img {...props} src={src} srcSet={photoSrcSet(src, shape)} sizes={sizes} alt={alt} loading={loading} decoding="async" />;
}
