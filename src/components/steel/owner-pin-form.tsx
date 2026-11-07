'use client';
import { useState } from 'react';
import { useLanguage } from '@/components/i18n/language-provider';
import { AssetField,AssetFeedback,assetInput,assetPrimary } from '@/components/company-assets/shared';
import { assetCopy } from '@/components/company-assets/copy';
import { siteAccessCopy } from '@/lib/site-phase-documents/access-copy';
import { configureOwnerPinAction } from '@/app/(admin)/app/profile/owner-pin-actions';
export function OwnerPinForm({pendingOwners=[]}:{pendingOwners?:{name:string|null;email:string}[]}){
 const {currentLang}=useLanguage(),c=siteAccessCopy(currentLang),a=assetCopy(currentLang);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[failed,setFailed]=useState(false);
 return <form data-testid="owner-pin-form" className="grid gap-3" onSubmit={async event=>{event.preventDefault();if(busy)return;const element=event.currentTarget,form=new FormData(element);setBusy(true);setMessage(null);try{const r=await configureOwnerPinAction({name:String(form.get('name')??''),email:String(form.get('email')??''),pin:String(form.get('pin')??'')});setFailed(!r.ok);setMessage(r.ok?c.saved:r.message||a.saveError);if(r.ok)element.reset();}catch{setFailed(true);setMessage(a.saveError);}finally{setBusy(false);}}}>
  <p className="text-xs leading-relaxed text-muted-foreground">{c.pinHint}</p>
  <div className="grid gap-3 sm:grid-cols-2"><AssetField label={a.name}><input name="name" defaultValue={pendingOwners.length===1?pendingOwners[0].name??'':''} required minLength={2} maxLength={120} className={assetInput} disabled={busy} autoComplete="name"/></AssetField><AssetField label="Email"><input name="email" defaultValue={pendingOwners.length===1?pendingOwners[0].email:''} required type="email" maxLength={200} className={assetInput} disabled={busy} autoComplete="email"/></AssetField></div>
  <AssetField label={c.pin}><input name="pin" required type="password" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="new-password" className={`${assetInput} max-w-xs`} disabled={busy}/></AssetField>
  <p className="text-xs font-medium text-muted-foreground">{c.owner}</p><AssetFeedback message={message} failed={failed}/><button type="submit" className={`${assetPrimary} w-fit`} disabled={busy}>{a.save}</button>
 </form>;
}
