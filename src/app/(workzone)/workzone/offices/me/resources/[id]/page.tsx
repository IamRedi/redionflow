import glass from '@/components/offices/surfaces.module.css';
import Link from 'next/link';
import {resolveRequestLanguage} from '@/lib/i18n/server';
import {officeResourceCopy} from '@/lib/offices/resource-copy';
import {notFound} from 'next/navigation';
import {officeSiteFiles} from '@/lib/offices/resources';
import {OfficeError} from '@/lib/offices/work-access';
import {SiteFilesButton} from '@/app/(workzone)/workzone/baustellen/[baustelleId]/site-files-sheet';
import {PhaseDocumentsButton} from '@/components/steel/phase-documents';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const id=(await params).id,data=await officeSiteFiles(id).catch(e=>{if(e instanceof OfficeError)notFound();throw e;});
 const c=officeResourceCopy(await resolveRequestLanguage());
 return <section className="space-y-5 p-3 sm:p-5"><nav className={glass.backNav}><Link className="inline-flex min-h-11 items-center" href="/workzone/offices/me/resources">← {c.resources}</Link><Link className="inline-flex min-h-11 items-center" href="/workzone/offices/me">{c.desk}</Link></nav><header><h1 className="text-2xl font-semibold">{data.site.name}</h1><p className="mt-2 text-sm text-muted-foreground">{c.uploadHint}</p></header><div className="flex flex-wrap gap-3"><PhaseDocumentsButton siteId={id}/><div className="contents" data-testid="office-native-files"><SiteFilesButton site={data.site} files={data.files} isAdmin={data.canEditDetails} canSeeCosts={data.canSeeCosts} canUpload={data.canUpload}/></div><Link className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4 text-sm" href={`/workzone/baustellen/${id}?office=desk`}>{c.processes} →</Link></div></section>;
}
