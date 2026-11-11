import Link from 'next/link';
import {notFound} from 'next/navigation';
import {OfficeError} from '@/lib/offices/work-access';
import {BookOpen,FolderOpen,ArrowUpRight,ClipboardList} from 'lucide-react';
import {officeResources} from '@/lib/offices/resources';
import type {SupportedLanguage} from '@/lib/i18n/language';
import s from './office.module.css';

export async function OfficeResources({lang,initial}:{lang:SupportedLanguage;initial?:Awaited<ReturnType<typeof officeResources>>}){
 const data=initial??await officeResources().catch(e=>{if(e instanceof OfficeError)notFound();throw e;}),sq=lang==='sq';
 return <section className={s.work} aria-label={sq?'Sirtarët e punës':'Work drawers'}><div className={s.workTitle}><h2>{sq?'Sirtarët e punës':'Work drawers'}</h2><p>{sq?'Sipas aksesit tënd në platformë':'Based on your platform permissions'}</p></div><div className={s.shortcuts}>
  {data.workbooks&&<Link href="/workzone/offices/me/workbooks"><span className={s.appIcon}><BookOpen size={21}/></span><span>{sq?'Fletoret e punëtorëve':'Staff workbooks'}</span><ArrowUpRight size={16}/></Link>}
  <Link href="/workzone/offices/me/resources"><span className={s.appIcon}><FolderOpen size={21}/></span><span>{sq?'Dokumente & proceset e mia':'My documents & processes'}</span><ArrowUpRight size={16}/></Link>
  {data.warehouse&&<Link href="/workzone/inventory?office=desk"><span className={s.appIcon}><ClipboardList size={21}/></span><span>{sq?'Magazina':'Warehouse'}</span><ArrowUpRight size={16}/></Link>}
  {data.workshop&&<Link href="/workzone/workshop?office=desk"><span className={s.appIcon}><ClipboardList size={21}/></span><span>{sq?'Oficina':'Workshop'}</span><ArrowUpRight size={16}/></Link>}
 </div></section>;
}
export async function OfficePlaces({lang}:{lang:SupportedLanguage}){
 const data=await officeResources().catch(e=>{if(e instanceof OfficeError)notFound();throw e;}),sq=lang==='sq';
 return <section className={s.office}><nav className={s.breadcrumb}><Link href="/workzone/offices/me">← {sq?'Zyra ime':'My office'}</Link><Link href="/workzone/offices">{sq?'Recepsioni':'Reception'}</Link></nav><header className={s.heading}><h1>{sq?'Dokumente & procese':'Documents & processes'}</h1></header><p className="mb-4 text-sm text-muted-foreground">{sq?'Hap vendin e punës për dokumentet dhe veprimet e lejuara. Ngarkimet ruhen te dosja ekzistuese.':'Open a workplace for its permitted documents and actions. Uploads remain in the existing site folder.'}</p><div className={s.placeGrid}>{data.sites.map(site=><article className={s.placeCard} key={site.id}><header><FolderOpen size={22}/><h2>{site.name}</h2></header><div className={s.placeActions}><Link href={`/workzone/offices/me/resources/${site.id}`}>{sq?'Hap dosjen':'Open folder'}<ArrowUpRight size={15}/></Link>{site.documents&&<Link href={`/workzone/offices/me/resources/${site.id}`}>{sq?'Ngarko dokument':'Upload document'}</Link>}</div><p>{[site.documents?(sq?'Dokumente: vepron':'Documents: edit'):null,site.productionWrite?(sq?'Prodhimi: vepron':'Production: edit'):null,site.field?(sq?'Terreni: shikon':'Field: view'):null].filter(Boolean).join(' · ')}</p></article>)}</div>{!data.sites.length&&<p>{sq?'Nuk ka vende pune të lejuara për këtë profil.':'No workplaces are available to this profile.'}</p>}</section>;
}
