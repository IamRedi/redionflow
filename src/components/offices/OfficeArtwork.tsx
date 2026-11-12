'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Camera, ImagePlus, Pencil, RotateCcw } from 'lucide-react';
import type { OfficeArtworkState } from '@/lib/offices/artwork';
import { updateOfficeArtwork } from '@/lib/offices/artwork-actions';
import { MAX_PHOTO_BYTES } from '@/lib/asset-photos/image-limits';
import s from './studio.module.css';
import glass from './surfaces.module.css';

const defaultArt = '/office-studio-v1/connected-work-artwork.webp';
export function OfficeArtwork({ initial, sq }: { initial?: OfficeArtworkState; sq: boolean }) {
  const [art, setArt] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), upload = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const source = art?.custom ? `/api/offices/artwork/${encodeURIComponent(art.memberId)}?v=${art.version}` : defaultArt;
  async function save(file?: File, reset = false) {
    if (!art || busy || (!reset && !file)) return;
    if (file && file.size > MAX_PHOTO_BYTES) { setError(sq ? 'Zgjidh një foto deri në 12 MB.' : 'Choose a photo up to 12 MB.'); return; }
    setBusy(true); setError('');
    const form = new FormData(); form.set('version', String(art.version)); form.set('reset', String(reset)); if (file) form.set('photo', file);
    try {
      const result = await updateOfficeArtwork(form);
      if (result.ok) { setArt(result.artwork); dialog.current?.close(); }
      else setError(result.code === 'CONFLICT' ? (sq ? 'Fotoja ndryshoi ndërkohë. Rifresko zyrën.' : 'The photo changed. Refresh the office.') : result.code === 'DENIED' ? (sq ? 'Nuk ke më akses për ta ndryshuar.' : 'You no longer have access to edit.') : (sq ? 'Fotoja nuk u ruajt. Provo JPG, PNG ose WebP.' : 'Photo not saved. Try JPG, PNG or WebP.'));
    } catch { setError(sq ? 'Lidhja u ndërpre. Fotoja e mëparshme ruhet.' : 'Connection interrupted. Your previous photo is kept.'); }
    finally { setBusy(false); if (upload.current) upload.current.value = ''; if (camera.current) camera.current.value = ''; }
  }
  // Already compressed WebP; private URLs must retain browser authentication.
  const picture = <span className={s.artMat}><Image unoptimized width={1100} height={825} src={source} alt={sq ? 'Piktura e zyrës' : 'Office artwork'} draggable={false}/></span>;
  return <>
    {art?.editable ? <button type="button" className={s.artFrame} data-testid="office-artwork" aria-label={sq ? 'Ndrysho foton e zyrës' : 'Change office photo'} onClick={() => { setError(''); dialog.current?.showModal(); }}>{picture}<span className={s.artEdit} data-office-art-edit aria-hidden="true"><Pencil size={12}/></span></button> : <figure className={s.artFrame} data-testid="office-artwork">{picture}</figure>}
    {art?.editable && <dialog ref={dialog} className={`${s.artDialog} ${glass.dialog}`} aria-labelledby="office-art-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <header><button type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label={sq ? 'Kthehu në zyrë' : 'Back to office'}><ArrowLeft size={18}/></button><h2 id="office-art-title">{sq ? 'Fotoja e zyrës' : 'Office photo'}</h2></header>
      <div className={s.artPreview}><Image unoptimized width={1100} height={825} src={source} alt={sq ? 'Fotoja aktuale' : 'Current photo'}/></div>
      <p>{sq ? 'Zgjidh një foto tënden. Ajo duket për personat që mund të vizitojnë zyrën.' : 'Choose your own photo. It is visible to people who can visit your office.'}</p>
      <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={sq ? 'Ngarko foto zyre' : 'Upload office photo'} onChange={event => void save(event.target.files?.[0])}/>
      <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label={sq ? 'Kamera e zyrës' : 'Office camera'} onChange={event => void save(event.target.files?.[0])}/>
      <div className={s.artActions}>
        <button type="button" disabled={busy} onClick={() => upload.current?.click()}><ImagePlus size={17}/>{sq ? 'Zgjidh foto' : 'Choose photo'}</button>
        <button type="button" disabled={busy} onClick={() => camera.current?.click()}><Camera size={17}/>{sq ? 'Kamera' : 'Camera'}</button>
        {art.custom && <button type="button" disabled={busy} onClick={() => void save(undefined, true)}><RotateCcw size={16}/>{sq ? 'Piktura bazë' : 'Default artwork'}</button>}
      </div>
      <p role="status" aria-live="polite">{busy ? (sq ? 'Duke ruajtur…' : 'Saving…') : error}</p>
    </dialog>}
  </>;
}
