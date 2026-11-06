'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMachineEditAction, saveMachineEditAction } from '@/app/(workzone)/workzone/machine-edit-actions';
import { useLanguage } from '@/components/i18n/language-provider';
import { AssetPhoto } from '@/components/asset-photo';
import { MachineArt, machineKind } from '@/components/steel/machine-art';
import { t } from '@/lib/i18n';
import type { MachineEdit } from '@/lib/company-assets/machine-edit';
import { machineDateFields, machineTextFields } from '@/lib/company-assets/machine-edit';
import { AssetDetailPanel } from './asset-detail-panel';
import { assetCopy } from './copy';
import { AssetWorkspaceDialog } from './workspace-dialog';
import { AssetFeedback, AssetField, AssetLoading, assetButton, assetInput, assetPrimary } from './shared';

const labels: Record<string, string> = {
  name: 'common.name', nickname: 'admin.internalName', model: 'workzone.model', targe: 'workzone.licensePlate',
  funksioni: 'workzone.function', patentaEnevojshme: 'workzone.requiredLicense', ownership: 'machineSheet.papers.ownership',
  notes: 'common.notes', vitiProdhimit: 'workzone.productionYear', vitiBlerjes: 'workzone.purchaseYear', tonnage: 'machineSheet.papers.tonnage',
  tuvDate: 'machineSheet.papers.hu', insuranceDate: 'machineSheet.papers.insurance', taxDate: 'machineSheet.papers.tax',
  transportPermitDate: 'machineSheet.papers.permit', tachographDate: 'machineSheet.papers.tachograph',
  auDate: 'admin.au', spDate: 'admin.sp', uvvDate: 'admin.uvv',
};

export function MachineEditor({ machine, country, onClose }: { machine: { id: string; name: string; imageUrl: string | null; category?: string | null }; country: string; onClose: () => void }) {
  const { currentLang: lang } = useLanguage();
  const c = assetCopy(lang);
  return <AssetWorkspaceDialog open onOpenChange={open => { if (!open) onClose(); }} title={c.editVehicle} scrollBody layer={1650}>
    <MachineEditorForm key={machine.id} machine={machine} country={country} onClose={onClose}/>
  </AssetWorkspaceDialog>;
}

function MachineEditorForm({ machine, country, onClose }: { machine: { id: string; name: string; imageUrl: string | null; category?: string | null }; country: string; onClose: () => void }) {
  const { currentLang: lang } = useLanguage();
  const c = assetCopy(lang), router = useRouter();
  const [value, setValue] = useState<MachineEdit | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void getMachineEditAction(machine.id).then(result => {
      if (!alive) return;
      if (result.ok) { setValue(result.data); setMessage(null); }
      else { setMessage(result.message || c.loadError); setFailed(true); }
    }).catch(() => { if (alive) { setMessage(c.loadError); setFailed(true); } });
    return () => { alive = false; };
  }, [machine.id, c.loadError, retry]);
  if (!value) return <div className="space-y-3"><AssetFeedback message={message} failed/>{message ? <button className={assetButton} onClick={() => setRetry(retry + 1)}>{c.retry}</button> : <AssetLoading label={c.loading}/>}</div>;
  const fieldLabel = (key: string) => key === 'notes' ? c.note : ['auDate','spDate','uvvDate'].includes(key) ? key.slice(0,-4).toUpperCase() : key === 'tuvDate' && country === 'AL' ? t('machineSheet.papers.kolaudim',lang) : t(labels[key],lang);
  return <div data-testid="machine-editor" className="mx-auto grid w-full min-w-0 gap-5 pb-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
    <div className="space-y-4">
      <div className="h-48 overflow-hidden rounded-2xl border bg-card sm:h-64"><AssetPhoto kind="machine" id={machine.id} src={machine.imageUrl} alt={machine.name} canEdit><MachineArt kind={machineKind(machine)} className="size-full p-4"/></AssetPhoto></div>
      <AssetDetailPanel asset={{kind:'machine',id:machine.id}} mode="documents"/>
    </div>
    <form className="min-w-0 space-y-5" aria-busy={pending} onSubmit={async event => {
      event.preventDefault(); if (pending) return;
      setPending(true); setMessage(null);
      try {
        const result = await saveMachineEditAction(value);
        if (!result.ok) { setMessage(result.message || c.saveError); setFailed(true); return; }
        router.refresh(); onClose();
      } catch { setMessage(c.saveError); setFailed(true); }
      finally { setPending(false); }
    }}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-semibold">{c.vehicleData}</legend>
        <AssetField label={t('admin.calculationCategory',lang)}><select name="category" className={assetInput} value={value.category} onChange={event => setValue({...value,category:event.target.value as MachineEdit['category']})}>{(['TRUCK','AWP','CHIPPER','CHAINSAW','OTHER'] as const).map(category => <option key={category} value={category}>{t(`form.machineCategory.${category}`,lang)}</option>)}</select></AssetField>
        {machineTextFields.map(key => <AssetField key={key} label={fieldLabel(key)}>{key === 'notes' ? <textarea name={key} rows={3} maxLength={2000} className={assetInput} value={value[key] || ''} onChange={event => setValue({...value,[key]:event.target.value || null})}/> : <input name={key} required={key==='name'} maxLength={120} className={assetInput} value={value[key] || ''} onChange={event => setValue({...value,[key]:event.target.value || null})}/>}</AssetField>)}
        {(['vitiProdhimit','vitiBlerjes','tonnage'] as const).map(key => <AssetField key={key} label={fieldLabel(key)}><input name={key} type="number" min={key==='tonnage'?0:1900} max={key==='tonnage'?10000:2200} step={key==='tonnage'?'0.01':1} className={assetInput} value={value[key] ?? ''} onChange={event => setValue({...value,[key]:event.target.value ? Number(event.target.value) : null})}/></AssetField>)}
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="isActive" checked={value.isActive} className="size-5 accent-orange-600" onChange={event => setValue({...value,isActive:event.target.checked})}/>{c.vehicleActive}</label>
      </fieldset>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-semibold">{c.vehiclePapers}</legend>
        {machineDateFields.filter(key => country !== 'AL' || !['auDate','spDate','uvvDate'].includes(key)).map(key => <AssetField key={key} label={fieldLabel(key)}><input name={key} type="date" className={`${assetInput} [color-scheme:light] dark:[color-scheme:dark]`} value={value[key] || ''} onChange={event => setValue({...value,[key]:event.target.value || null})}/></AssetField>)}
      </fieldset>
      <AssetFeedback message={message} failed={failed}/>
      <div className="flex flex-wrap gap-2"><button className={assetPrimary} disabled={pending}><Save size={17}/>{c.save}</button><button type="button" className={assetButton} disabled={pending} onClick={onClose}>{c.cancel}</button>{failed ? <button type="button" className={assetButton} disabled={pending} onClick={() => setRetry(retry + 1)}>{c.refresh}</button> : null}</div>
    </form>
  </div>;
}
