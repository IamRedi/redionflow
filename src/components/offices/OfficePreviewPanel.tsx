import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {SupportedLanguage} from '@/lib/i18n/language';
import {officeResources,officeSiteFiles,officeWorkbooks,officeMonth} from '@/lib/offices/resources';
import {officePreviewTasks,officePreviewPlan} from '@/lib/offices/preview';
import {OfficeError} from '@/lib/offices/work-access';
import {dateKey,monthKey} from '@/lib/workzone/date-utils';
import {MonthlyTimesheet} from '@/components/reports/monthly-timesheet';
import {SavedPlanList} from '@/app/(workzone)/workzone/plan/saved-plan';
import {planCopy} from '@/app/(workzone)/workzone/plan/plan-copy';
import s from './office.module.css';
import {OfficeDrawer} from './OfficeDrawer';

async function read<T>(promise:Promise<T>):Promise<T>{return promise.catch(e=>{if(e instanceof OfficeError)notFound();throw e;});}
export type OfficePreviewQuery={view?:string;site?:string;month?:string;worker?:string;date?:string};
export async function OfficePreviewPanel({id,name,lang,query}:{id:string;name:string;lang:SupportedLanguage;query:OfficePreviewQuery}){
 const sq=lang==='sq',unit='h',base=`/workzone/offices/people/${id}`,resources=await read(officeResources(id)),view=query.view??'tasks';
 let content;
  if(view==='documents'){
   const site=query.site?await read(officeSiteFiles(query.site,id)):null;
   content=site?<><h2>{site.site.name}</h2><Link href={`${base}?view=documents#office-preview`}>{sq?'← Dosjet':'← Folders'}</Link><ul className={s.previewRows}>{site.files.map(f=><li key={f.id}><a href={`/api/site-files/${f.id}`} target="_blank" rel="noopener">{f.fileName} ↗</a></li>)}</ul>{!site.files.length&&<p>{sq?'Nuk ka dokumente.':'No documents.'}</p>}</>:<><h2>{resources.profile==='PURCHASING'?(sq?'Projektet & blerjet':'Projects & purchasing'):(sq?'Dokumente & procese':'Documents & processes')}</h2><div className={s.placeGrid}>{resources.sites.map(site=><article key={site.id} className={s.placeCard}><h3>{site.name}</h3><p>{[site.documents?(sq?'Dokumente: vepron':'Documents: edit'):(sq?'Dokumente: shikon':'Documents: view'),site.productionWrite?(sq?'Prodhimi: vepron':'Production: edit'):null,site.field?(sq?'Terreni: shikon':'Field: view'):null].filter(Boolean).join(' · ')}</p><div className={s.placeActions}><Link href={`${base}?view=documents&site=${encodeURIComponent(site.id)}#office-preview`}>{sq?'Hap dosjen':'Open folder'}</Link></div></article>)}</div>{!resources.sites.length&&<p>{sq?'Nuk ka vende pune të lejuara.':'No permitted workplaces.'}</p>}</>;
  }else if(view==='workbooks'){
   const month=query.month??monthKey(new Date());if(!officeMonth.safeParse(month).success)notFound();
   const data=await read(officeWorkbooks(month,query.worker,id)),worker=data.summary[0];
   content=<><h2>{sq?'Fletoret e punëtorëve':'Staff workbooks'}</h2><form className={s.previewForm}><input type="hidden" name="view" value="workbooks"/><input type="month" name="month" aria-label={sq?'Muaji':'Month'} defaultValue={month}/><button>{sq?'Shfaq':'Show'}</button></form>{query.worker?<><Link href={`${base}?view=workbooks&month=${month}#office-preview`}>{sq?'← Të gjithë':'← All staff'}</Link><MonthlyTimesheet month={month} worker={worker} rows={data.rows} lang={lang}/></>:<ul className={s.previewRows}>{data.summary.map(w=><li key={w.id}><Link href={`${base}?view=workbooks&month=${month}&worker=${w.id}#office-preview`}>{w.firstName} {w.lastName}<strong>{w.hours.toFixed(2)} {unit}</strong></Link></li>)}</ul>}</>;
  }else if(view==='plan'){
   const date=query.date??dateKey(new Date()),plan=await read(officePreviewPlan(id,date));
   content=<><h2>{sq?'Plani ditor · i ruajtur':'Daily plan · saved'}</h2><form className={s.previewForm}><input type="hidden" name="view" value="plan"/><input type="date" name="date" aria-label={sq?'Data':'Date'} defaultValue={date}/><button>{sq?'Shfaq':'Show'}</button></form><SavedPlanList rows={plan?.savedRows??[]} c={planCopy(lang)} me={name}/></>;
  }else if(view==='tasks'){
   const tasks=await read(officePreviewTasks(id));
   const labels:Record<string,string>=sq?{TODO:'Për t’u bërë',IN_PROGRESS:'Në punë',DONE:'Përfunduar'}:{TODO:'To do',IN_PROGRESS:'In progress',DONE:'Done'};
   content=<><h2>{sq?'Detyrat e punës':'Work assignments'}</h2><ul className={s.previewRows}>{tasks.map(t=><li key={t.id}><details><summary><strong>{t.title}</strong><span>{labels[t.status]??t.status}</span></summary>{t.body&&<p className="whitespace-pre-wrap">{t.body}</p>}{t.category&&<p>{t.category.name}</p>}{t.dueDate&&<p>{t.dueDate}</p>}</details></li>)}</ul>{!tasks.length&&<p>{sq?'Nuk ka detyra pune aktive.':'No active work assignments.'}</p>}</>;
  }else notFound();
  return <OfficeDrawer backHref={base} label={sq?'Pamja e punonjësit':'Employee view'}><section id="office-preview" className={s.previewPanel} data-testid="office-preview-panel"><nav className={s.breadcrumb}><Link href={base}>{sq?'← Zyra e punonjësit':'← Employee office'}</Link><Link href="/workzone/offices">{sq?'Recepsioni':'Reception'}</Link></nav>{content}</section></OfficeDrawer>;
}
