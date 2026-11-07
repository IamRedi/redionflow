'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { Camera, ImagePlus, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/components/i18n/language-provider';
import { photoCopy, type PhotoKind } from '@/lib/asset-photos/shared';
import { uploadAssetPhoto } from '@/app/(workzone)/workzone/photo-actions';

async function cameraFile(file: File) {
  // Reduce phone uploads before transfer; the server validates/converts again.
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    try {
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas
        .getContext('2d')!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.85),
      );
      return blob
        ? new File([blob], 'photo.webp', { type: 'image/webp' })
        : file;
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
export function AssetPhoto({
  kind,
  id,
  src,
  alt,
  canEdit = false,
  children,
  className = '',
  imageClassName = 'h-full w-full object-cover',
}: {
  kind: PhotoKind;
  id: string;
  src?: string | null;
  alt: string;
  canEdit?: boolean;
  children: ReactNode;
  className?: string;
  imageClassName?: string;
}) {
  const { currentLang } = useLanguage(),
    c = photoCopy(currentLang),
    router = useRouter();
  const camera = useRef<HTMLInputElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const [open, setOpen] = useState(false),
    [saved, setSaved] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  function choose(file?: File) {
    if (!file) return;
    setOpen(false);
    setMessage('');
    start(async () => {
      try {
        if (file.size > 12_000_000) throw new Error('PHOTO_FILE');
        const f = new FormData();
        f.set('kind', kind);
        f.set('id', id);
        f.set('file', await cameraFile(file));
        const r = await uploadAssetPhoto(f);
        if (!r.ok) {
          setMessage(
            r.code === 'PHOTO_DENIED'
              ? c.denied
              : r.code === 'PHOTO_BUSY'
                ? c.busy
                : r.code === 'PHOTO_UNAVAILABLE'
                  ? c.unavailable
                  : c.error,
          );
          setOpen(true);
          return;
        }
        setSaved(r.url);
        setMessage(c.saved);
        router.refresh();
      } catch {
        setMessage(c.error);
        setOpen(true);
      }
    });
  }
  return (
    <div
      className={className || 'relative h-full w-full'}
      data-testid={`asset-photo-${kind}-${id}`}
    >
      {saved || src ? (
        <img src={saved || src!} alt={alt} className={imageClassName} />
      ) : (
        children
      )}
      {canEdit && (
        <div
          className={kind === 'worker' ? 'absolute -bottom-1 -right-1 z-30' : 'absolute right-2 top-2 z-30'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={trigger}
            type="button"
            disabled={pending}
            aria-label={`${c.edit}: ${alt}`}
            title={c.edit}
            aria-expanded={open}
            onClick={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setAnchor({
                top: Math.min(window.innerHeight - 160, r.bottom + 6),
                left: Math.max(
                  8,
                  Math.min(window.innerWidth - 232, r.right - 224),
                ),
              });
              setOpen(!open);
            }}
            className="grid size-8 place-items-center rounded-full border border-white/70 bg-white/90 text-slate-800 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
          </button>
          {open &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[1590]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                />
                <div
                  role="group"
                  aria-label={c.edit}
                  style={anchor}
                  className="fixed z-[1600] w-56 space-y-1 rounded-xl border bg-background p-2 text-foreground shadow-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpen(false);
                      trigger.current?.focus();
                    }
                  }}
                >
                  <button
                    autoFocus
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      camera.current?.click();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"
                  >
                    <Camera className="size-4" />
                    {c.camera}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      upload.current?.click();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"
                  >
                    <ImagePlus className="size-4" />
                    {c.upload}
                  </button>
                  {message && message !== c.saved && (
                    <p
                      role="alert"
                      className="max-w-56 px-2 text-xs text-destructive"
                    >
                      {message}
                    </p>
                  )}
                </div>
              </>,
              document.body,
            )}
          <input
            ref={camera}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            data-photo-input="camera"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={upload}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-photo-input="upload"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? c.saving : message}
      </span>
    </div>
  );
}
