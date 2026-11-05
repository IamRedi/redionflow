'use client';

import { HardHat, MapPin, ScanSearch, Truck } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import { fleetCopy } from '@/lib/fleet/copy';
import type { MapFleetName } from './workzone-map-fleet';
import { mapsLink } from '@/lib/fleet/location-link';
import { t } from '@/lib/i18n';
import styles from './workzone-map-index.module.css';

export type MissionMapFocus = { kind: 'site' | 'vehicle'; id: string; request: number };
type IndexSite = { id: string; name: string; standortAddress: string; coordinates: { lat: number; lng: number } | null };
export type MapIndexVehicle = MapFleetName & { coordinates: IndexSite['coordinates'] };

export function WorkzoneMapIndex({ items, vehicles, focus, onFocus }: {
  items: IndexSite[];
  vehicles: MapIndexVehicle[];
  focus: MissionMapFocus | null;
  onFocus: (kind: MissionMapFocus['kind'], id: string) => void;
}) {
  const { currentLang: lang } = useLanguage(), c = fleetCopy(lang);
  function row(kind: MissionMapFocus['kind'], id: string, name: string, coords: IndexSite['coordinates'], address = '', plate = '') {
    const label = [name, plate].filter(Boolean).join(' · ');
    const zoom = `${t('workzone.zoom', lang)}: ${label}`, location = `${t('common.location', lang)}: ${label}`;
    const href = coords ? mapsLink(coords.lat, coords.lng) : address.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}` : null;
    const selected = focus?.kind === kind && focus.id === id;
    return <div key={`${kind}-${id}`} className={styles.row} data-testid={`map-index-${kind}-${id}`} data-selected={selected || undefined}>
      <span className={styles.identity} title={label}><span className={styles.name}>{name}</span>{plate ? <span className={styles.plate}>{plate}</span> : null}</span>
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={!coords} aria-label={zoom} aria-pressed={selected} title={coords ? zoom : `${zoom} · ${t('workzone.noGps', lang)}`} onClick={() => onFocus(kind, id)}><ScanSearch size={15} /></button>
        {href ? <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer" aria-label={location} title={location}><MapPin size={15} /></a> : <button type="button" className={styles.action} disabled aria-label={location} title={`${location} · ${t('workzone.noGps', lang)}`}><MapPin size={15} /></button>}
      </div>
    </div>;
  }
  return <aside className={`${styles.index} no-scrollbar`} tabIndex={0} aria-label={t('workzone.focus', lang)} data-testid="workzone-map-index">
    <section aria-labelledby="map-index-sites"><h3 id="map-index-sites"><HardHat size={14} /><span>{c.sites}</span><small>{items.length}</small></h3>
      <div>{items.map(i => row('site', i.id, i.name, i.coordinates, i.standortAddress))}</div>
    </section>
    <section aria-labelledby="map-index-vehicles"><h3 id="map-index-vehicles"><Truck size={14} /><span>{c.vehicles}</span><small>{vehicles.length}</small></h3>
      <div>{vehicles.map(v => row('vehicle', v.id, v.name || v.plate || c.vehicles, v.coordinates, '', v.plate?.trim() ?? ''))}</div>
    </section>
  </aside>;
}
