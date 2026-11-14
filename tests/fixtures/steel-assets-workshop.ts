import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { isLoginCodeTaken } from '../../src/lib/auth/login-code';
import { randomInt } from 'node:crypto';

async function unusedSyntheticCode() {
  for(let attempt=0;attempt<50;attempt++) {
    const code=String(randomInt(100000,1000000));
    if(!await isLoginCodeTaken(prisma,code))return code;
  }
  throw new Error('Could not allocate an unambiguous disposable worker login code.');
}

/** Synthetic inventory only. This fixture refuses a hosted or nondisposable database. */
export async function seedSteelAssetsWorkshop(companyId: string, marker: string) {
  assertE2ETestDatabase(process.env);
  await prisma.companyProfile.update({where:{id:companyId},data:{displayName:'Synthetic Assets · DEMO',mode:'bau',country:'AL'}});
  const site=await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Aurora equipment · DEMO',type:'STEEL_ASSEMBLY'}});
  await prisma.baustelle.create({data:{companyProfileId:companyId,name:'Aurora workshop · DEMO',type:'STEEL_WORKSHOP'}});
  const workerCode=await unusedSyntheticCode();
  const worker=await prisma.worker.create({data:{companyProfileId:companyId,firstName:`Operator-${marker}`,lastName:'Synthetic',crewRole:'FIELD_WORKER',loginCodeHash:hashPassword(workerCode)}});
  const mechanicCode=await unusedSyntheticCode();
  const mechanic=await prisma.worker.create({data:{companyProfileId:companyId,firstName:`Mechanic-${marker}`,lastName:'Synthetic',crewRole:'MECHANIC',loginCodeHash:hashPassword(mechanicCode)}});
  const tool=await prisma.companyInventoryItem.create({data:{companyProfileId:companyId,category:'WORK_TOOL',itemCode:`DRILL-${marker}`,barcode:`AS-DRILL-${marker}`,name:'Drill Aurora · DEMO'}});
  const clothing=await prisma.companyInventoryItem.create({data:{companyProfileId:companyId,category:'CLOTHING',itemCode:`VEST-${marker}`,name:'Vest Aurora · DEMO',sizeLabel:'L'}});
  const equipment=await prisma.companyInventoryItem.create({data:{companyProfileId:companyId,category:'SITE_EQUIPMENT',itemCode:`BARRIER-${marker}`,name:'Barrier Aurora · DEMO'}});
  const machines=[];
  for(let i=0;i<12;i++)machines.push(await prisma.machine.create({data:{companyProfileId:companyId,name:i<2?`Aurora van ${i+1} · DEMO`:`Aurora machine ${i+1} · DEMO`,nickname:i<2?'Aurora van · DEMO':null,targe:`ZZ ${String(i+1).padStart(3,'0')} DM`,hourlyRateCents:0,...(i===0?{gpsEnabled:true,lastGpsLat:41.123,lastGpsLng:19.456,lastGpsAt:new Date()}: {})}}));
  const element=await prisma.siteElement.create({data:{companyProfileId:companyId,baustelleId:site.id,list:'assembly',mark:'DEMO-B10',quantity:4,weightKg:20}});
  await prisma.siteElementWork.create({data:{companyProfileId:companyId,elementId:element.id,stage:'cutting',pieces:2,workerNames:'Synthetic Operator',workerIds:[],checkedByName:'Synthetic Chief'}});
  return {site,worker,mechanic,workerCode,mechanicCode,tool,clothing,equipment,machines,element};
}

export async function cleanupSteelAssetsWorkshop(companyId: string) {
  assertE2ETestDatabase(process.env);
  const company=await prisma.companyProfile.findUnique({where:{id:companyId},select:{displayName:true}});
  if(company?.displayName!=='Synthetic Assets · DEMO')throw new Error('Refusing cleanup outside the synthetic assets fixture.');
  const where={companyProfileId:companyId};
  await prisma.siteDocumentEngineer.deleteMany({where});
  // Explicit FK order preserves Restrict protections in the production schema.
  await prisma.sitePhaseDocumentReceipt.deleteMany({where});
  while(await prisma.sitePhaseDocument.count({where})){
    const deleted=await prisma.sitePhaseDocument.deleteMany({where:{...where,nextVersion:{is:null}}});if(!deleted.count)throw new Error('Synthetic document version cycle');
  }
  await prisma.companyAssetCode.deleteMany({where});
  await prisma.companyAssetFile.deleteMany({where});
  await prisma.companyAssetEvent.deleteMany({where});
  await prisma.companyAssetHandover.deleteMany({where});
  await prisma.companyAssetIncident.deleteMany({where});
  await prisma.companyAssetCommandReceipt.deleteMany({where});
  await prisma.companyAssetRepair.deleteMany({where});
  await prisma.companyOperationalAsset.deleteMany({where});
  // Synthetic owner scenarios enter the real office-aware shell. Remove its
  // dependent private fixtures in FK order before deleting their user rows.
  await prisma.officeAttachment.deleteMany({where});
  await prisma.officeMessage.deleteMany({where});
  await prisma.officeThread.deleteMany({where});
  await prisma.officeTaskReminder.deleteMany({where});
  await prisma.officeTask.deleteMany({where});
  await prisma.officeAssistantTurn.deleteMany({where});
  await prisma.officeArtwork.deleteMany({where});
  await prisma.officeMember.deleteMany({where});
  await prisma.officeCategory.deleteMany({where});
  await prisma.user.deleteMany({where});
  await prisma.companyProfile.delete({where:{id:companyId}});
}
