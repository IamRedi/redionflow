/** Optional local-only fictional scenario AFTER company:plan. Never part of startup/reset. */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { PrismaClient } from '../src/generated/prisma/client';
import { readBlueprint } from '../src/lib/provision/blueprints';
import { hashPassword } from '../src/lib/auth/password';
import { scanCodeKey } from '../src/lib/inventory/scan-code';
import { dateKey, dayRange } from '../src/lib/workzone/date-utils';
import { planMachineLabel } from '../src/lib/workzone/plan-machine-label';

export const CRANE_MUSTER_ID = 'company-rheinruhr-kran-muster';
const actor = 'crane-muster-fixture-v1';
const prefix = '/company-studio/crane-red-blue-v1';
const team = [
  ['dispo','Lena','Hartmann','Disposition & Kunden','OFFICE'],
  ['finance','David','Keller','Buchhaltung','OFFICE'],
  ['operator-a','Milan','Vogel','Kranführer','FIELD_WORKER'],
  ['operator-b','Nora','Falk','Kranführerin','FIELD_WORKER'],
  ['rigger','Samir','Beck','Anschläger · Montage','FIELD_WORKER'],
  ['rigger-b','Jonas','Weiss','Anschläger · Logistik','FIELD_WORKER'],
  ['mechanic','Eva','Sommer','Werkstatt','MECHANIC'],
] as const;
const phases = ['Einsatz vorbereiten','Zufahrt & Stellfläche prüfen','Absperrung aufbauen','Anlieferung übernehmen','Hub / Montage dokumentieren','Übergabe & Rückfahrt'];

export async function populateCraneMuster(db: PrismaClient, pinBase: number) {
  if (!Number.isInteger(pinBase) || pinBase < 100000 || pinBase > 999990) throw new Error('SYNTHETIC_PIN_BASE_REQUIRED');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${CRANE_MUSTER_ID}, true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor}))`;
    const company = await tx.companyProfile.findUniqueOrThrow({ where: { id: CRANE_MUSTER_ID } });
    if (company.legalName !== 'RheinRuhr Kranservice Muster GmbH · Fiktive Demofirma' || company.uiIdentity !== 'crane-red-blue-v1' || readBlueprint(company.setupProfile)?.factory !== false) throw new Error('WRONG_MUSTER_COMPANY');
    const done = await tx.auditLog.findFirst({ where: { companyProfileId: CRANE_MUSTER_ID, action: actor } });
    if (done) return { created: false, companyId: CRANE_MUSTER_ID };
    if (await tx.worker.count({ where: { companyProfileId: CRANE_MUSTER_ID } }) || await tx.machine.count({ where: { companyProfileId: CRANE_MUSTER_ID } }) || await tx.companyInventoryItem.count({ where: { companyProfileId: CRANE_MUSTER_ID } })) throw new Error('MUSTER_NOT_EMPTY');
    const sites = await tx.baustelle.findMany({ where: { companyProfileId: CRANE_MUSTER_ID }, orderBy: { name: 'asc' } });
    if (sites.length !== 3 || sites.some(s => s.type !== 'STEEL_ASSEMBLY')) throw new Error('WRONG_MUSTER_SITES');
    const owner = await tx.user.findFirstOrThrow({ where: { companyProfileId: CRANE_MUSTER_ID, isOwner: true } });
    const ownerName = owner.name ?? 'Clara Winter';
    const workers: Record<string,string> = {};
    for (const [n,[key,firstName,lastName,position,crewRole]] of team.entries()) {
      const w=await tx.worker.create({ data: { id:`crane-muster-${key}`,companyProfileId:CRANE_MUSTER_ID,firstName,lastName,position,crewRole,loginCodeHash:hashPassword(String(pinBase+n)),preferredLanguage:'DE',motherTongue:'DE' } });
      workers[key]=w.id;
    }
    for (const [key,title] of [['owner','Geschäftsleitung'],['dispo','Disposition & Kunden'],['finance','Buchhaltung']] as const) {
      const member=await tx.officeMember.create({ data: { companyProfileId:CRANE_MUSTER_ID,...(key==='owner'?{id:owner.id,userId:owner.id}:{workerId:workers[key]}),title,enabled:true,workbooksEnabled:key!=='dispo',assistantEnabled:false } });
      await tx.officeTask.create({ data: { id:randomUUID(),companyProfileId:CRANE_MUSTER_ID,ownerId:member.id,createdById:member.id,kind:'PERSONAL',title:key==='finance'?'Einsatzstunden & Musterbelege prüfen':key==='dispo'?'Hafenforum: Team und Gerät abstimmen':'Musteraufträge und Freigaben prüfen' } });
    }
    const today = dayRange(dateKey(new Date())).start;
    const plan = await tx.dailyWorkPlan.create({ data: { companyProfileId:CRANE_MUSTER_ID,planDate:today,createdByAdminId:owner.id } });
    const machines=[];
    for (const item of [
      {key:'mobilkran',name:'Mobilkran · Mustergerät',category:'TRUCK' as const,targe:'MU RK 101',imageUrl:`${prefix}/mobile-crane.webp`},
      {key:'glasroboter',name:'Raupen-Glasroboter · Mustergerät',category:'OTHER' as const,targe:null,imageUrl:`${prefix}/glass-robot.webp`},
    ]) {
      const { key, ...machineData } = item;
      const m=await tx.machine.create({ data: { id:`crane-muster-${key}`,companyProfileId:CRANE_MUSTER_ID,...machineData,hourlyRateCents:0,notes:'Fiktives Mustergerät. Keine zertifizierten Traglast- oder Geometriedaten.',uvvDate:new Date(Date.now()+180*86400000) } });
      machines.push(m);
      const asset=await tx.companyOperationalAsset.create({ data: { companyProfileId:CRANE_MUSTER_ID,machineId:m.id } });
      await tx.companyAssetEvent.create({ data: { companyProfileId:CRANE_MUSTER_ID,assetId:asset.id,type:'registered',actorKey:actor,actorName:ownerName,note:'Fiktiver Musterbestand; Fahrzeugkennzeichen ist die primäre Identität, Barcode nur optional.' } });
    }
    const definitions=[];
    for (const [n,label] of phases.entries()) definitions.push(await tx.steelWorkDefinition.create({ data: { companyProfileId:CRANE_MUSTER_ID,kind:'site',key:`steel-task-crane-${n+1}`,label,description:'Dokumentierter Musterschritt; keine technische Einsatzfreigabe.',phaseGroup:'assembly',sortOrder:n } }));
    for (const [n,site] of sites.entries()) {
      await tx.baustelle.update({ where:{id:site.id},data:{canvasX:32+n*340,canvasY:70,canvasMobileX:12+(n%2)*186,canvasMobileY:65+Math.floor(n/2)*290,coverPhotoAt:new Date()} });
      await tx.assetPhoto.create({ data: {companyProfileId:CRANE_MUSTER_ID,baustelleId:site.id,data:readFileSync(`public/company-studio/crane-red-blue-v1/site-${['glass','steel','roof'][n]}.webp`)} });
      for (const [index,d] of definitions.entries()) {
        const tree=await tx.treeItem.create({data:{baustelleId:site.id,treeId:d.key,species:'task',diameter:0,notes:JSON.stringify({label:d.label})}});
        await tx.steelSiteTask.create({data:{companyProfileId:CRANE_MUSTER_ID,baustelleId:site.id,definitionId:d.id,treeItemId:tree.id,position:index+1}});
      }
      const bytes=Buffer.from(`MUSTER · ${site.name}\nFiktiver Auftrag, keine Einsatzfreigabe.\nDisposition: Lena Hartmann\nAblauf: Vorbereitung – Anlieferung – Hub/Montage – Übergabe.\nLast, Radius, Untergrund, Wind und Prüfungen sind durch qualifizierte Verantwortliche zu klären.\n`);
      await tx.siteFile.create({data:{companyProfileId:CRANE_MUSTER_ID,baustelleId:site.id,kind:'document',fileName:'Auftragsuebersicht-MUSTER.txt',mime:'text/plain',size:bytes.length,data:bytes,uploadedByName:ownerName}});
      const element=await tx.siteElement.create({data:{companyProfileId:CRANE_MUSTER_ID,baustelleId:site.id,list:'assembly',mark:`RK-${n+1}`,profile:n===0?'Glasfassade · Muster':n===1?'Stahlträger · Muster':'Dachgerät · Muster',quantity:2,processRoutes:{v:1,factory:[],field:['received','mounted'],supply:'external'}}});
      if (element.factoryDoneAt) throw new Error('UNEXPECTED_PRODUCTION');
      const crew=[workers[n===1?'operator-b':'operator-a'],workers[n===1?'rigger-b':'rigger']];
      const targetPlan=n===2?await tx.dailyWorkPlan.create({data:{companyProfileId:CRANE_MUSTER_ID,planDate:new Date(today.getTime()+86400000),createdByAdminId:owner.id}}):plan;
      const column=await tx.dailyWorkPlanColumn.create({data:{planId:targetPlan.id,baustelleId:site.id,title:site.name,sortOrder:n}});
      for (const [order,id] of crew.entries()) await tx.dailyWorkPlanAssignment.create({data:{columnId:column.id,kind:'WORKER',workerId:id,labelSnapshot:team.find(t=>`crane-muster-${t[0]}`===id)!.slice(1,3).join(' '),sortOrder:order}});
      const m=machines[n===0?1:0];
      await tx.dailyWorkPlanAssignment.create({data:{columnId:column.id,kind:'MACHINE',machineId:m.id,labelSnapshot:m.name,sortOrder:crew.length}});
      const row={workerNames:crew.map(id=>team.find(t=>`crane-muster-${t[0]}`===id)!.slice(1,3).join(' ')).join(', '),machineNames:planMachineLabel(m),baustelleName:site.name,sortOrder:n};
      await tx.dailyWorkPlanSavedRow.create({data:{...row,planId:targetPlan.id}});
      if(n<2) for(const workerId of crew) await tx.workSession.create({data:{workerId,baustelleId:site.id,startTime:new Date(Date.now()-40*60000),isLive:true}});
    }
    for(const p of await tx.dailyWorkPlan.findMany({where:{companyProfileId:CRANE_MUSTER_ID},include:{savedRows:true}}))
      await tx.dailyWorkPlanSnapshot.create({data:{planId:p.id,versionNumber:1,createdByAdminId:owner.id,rows:{create:p.savedRows.map(r=>({workerNames:r.workerNames,machineNames:r.machineNames,baustelleName:r.baustelleName,sortOrder:r.sortOrder}))}}});
    for(const key of ['finance','dispo']) for(let day=1;day<=3;day++) {
      const start=new Date(today.getTime()-day*86400000+8*3600000);
      await tx.workSession.create({data:{workerId:workers[key],workplace:'OFFICE',startTime:start,endTime:new Date(start.getTime()+8*3600000),totalHours:7.5,breakMinutes:30}});
    }
    for (const [n,name] of ['Hebeband · Muster','Anschlagkette · Muster','Vakuumheber · Muster','Unterlegplatten · Muster'].entries()) {
      const code=`RK-WZ-${String(n+1).padStart(3,'0')}`;
      const item=await tx.companyInventoryItem.create({data:{companyProfileId:CRANE_MUSTER_ID,name,category:'WORK_TOOL',itemCode:code,barcode:code,note:'Fiktiver Bestand; Prüfung und Identität des realen Mittels separat dokumentieren.'}});
      const asset=await tx.companyOperationalAsset.create({data:{companyProfileId:CRANE_MUSTER_ID,inventoryItemId:item.id}});
      await tx.companyAssetCode.create({data:{companyProfileId:CRANE_MUSTER_ID,assetId:asset.id,kind:'label',value:code,matchValue:scanCodeKey(code),createdByKey:actor,createdByName:ownerName}});
      await tx.companyAssetEvent.create({data:{companyProfileId:CRANE_MUSTER_ID,assetId:asset.id,type:'registered',actorKey:actor,actorName:ownerName,note:'Eigener fiktiver Musterbestand.'}});
      const data=Buffer.from(`MUSTER · ${name}\nIdentität: ${code}\nNur fiktive Dokumentablage, kein gültiger Prüfnachweis.`);
      await tx.companyAssetFile.create({data:{companyProfileId:CRANE_MUSTER_ID,assetId:asset.id,kind:'document',mime:'text/plain',name:'Geraetekarte-MUSTER.txt',size:data.length,dataBytes:data,sha256:createHash('sha256').update(data).digest('hex'),uploadedByUserId:owner.id,uploadedByName:ownerName}});
      if(n===1) await tx.companyAssetRepair.create({data:{companyProfileId:CRANE_MUSTER_ID,assetId:asset.id,phase:'received',problem:'Kennzeichnungsanhänger unleserlich · fiktiver Werkstattfall',reportedByKey:actor,reportedByName:'Eva Sommer'}});
    }
    await tx.workzoneAnnouncement.create({data:{companyProfileId:CRANE_MUSTER_ID,message:'MUSTERFIRMA · Alle Daten und Abbildungen sind fiktiv. Keine technische Einsatzfreigabe.',createdByName:'RheinRuhr Muster'}});
    await tx.auditLog.create({data:{companyProfileId:CRANE_MUSTER_ID,actorType:'SYSTEM',action:actor,payload:{workers:7,offices:3,sites:3,factory:0,machines:2,tools:4,copiedClientRecords:0}}});
    return {created:true,companyId:CRANE_MUSTER_ID,ownerId:owner.id,workers,sites:sites.map(s=>({id:s.id,name:s.name}))};
  },{timeout:30_000});
}

async function main(){
  if(process.env.APP_ENV!=='local'||process.env.INSTALLATION_COMPANY_ID!==CRANE_MUSTER_ID||process.env.CRANE_MUSTER_LOCAL_FIXTURE!=='true')throw new Error('LOCAL_CRANE_FIXTURE_REQUIRED');
  const [{PrismaClient},{PrismaPg},{resolveDatabaseConnectionString}]=await Promise.all([import('../src/generated/prisma/client'),import('@prisma/adapter-pg'),import('../src/lib/db/connection-string')]);
  const connection=resolveDatabaseConnectionString({preferDirect:true});
  if(!connection) throw new Error('ISOLATED_CRANE_DATABASE_REQUIRED');
  const url=new URL(connection);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/bauflow_crane_muster_test')throw new Error('ISOLATED_CRANE_DATABASE_REQUIRED');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:connection})});
  try{
    const [target]=await db.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`;
    if(target?.name!=='bauflow_crane_muster_test'||await db.companyProfile.count({where:{id:{not:CRANE_MUSTER_ID}}}))throw new Error('ISOLATED_CRANE_DATABASE_REQUIRED');
    console.log(JSON.stringify(await populateCraneMuster(db,Number(process.env.CRANE_MUSTER_WORKER_PIN_BASE))));
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(e=>{console.error(`[crane-muster] ${e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'FIXTURE_FAILED'}`);process.exitCode=1;});
