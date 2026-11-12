import {expect,test} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
import {removeSecurityTenants} from '../security/fixtures';

test('part-only cutting is visible without assembly output and the mobile site board follows active/alphabetic order',async({page,context},info)=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),out=process.env.PARTS_ORDER_EVIDENCE_DIR,baseline=process.env.PARTS_ORDER_BASELINE==='true';
 test.skip(!out,'Requires the bounded local capture fixture.');
 const company=await prisma.companyProfile.create({data:{displayName:'Steel Progress · DEMO',legalName:'Synthetic parts progress only',mode:'bau',country:'AL'}});
 const admin=await prisma.user.create({data:{companyProfileId:company.id,name:'Planner · DEMO',email:`parts-order-${company.id}@example.test`,role:'ADMIN'}});
 const worker=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Factory',lastName:'DEMO',status:'active',crewRole:'FACTORY_WORKER',availability:'AVAILABLE'}});
 const second=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Crew',lastName:'DEMO',status:'active',crewRole:'FIELD_WORKER',availability:'AVAILABLE'}});
 const factory=await prisma.baustelle.create({data:{companyProfileId:company.id,name:'Factory · DEMO',type:'STEEL_WORKSHOP'}});
 const site=async(name:string,offset:number)=>prisma.baustelle.create({data:{companyProfileId:company.id,name,type:'STEEL_ASSEMBLY',updatedAt:new Date(Date.now()+offset)}});
 const parts=await site('Parts only · DEMO',1000),alpha=await site('Alpha idle · DEMO',2000),beta=await site('Beta active · DEMO',3000),zulu=await site('Zulu active · DEMO',4000),zed=await site('Zed idle · DEMO',5000);
 await prisma.workSession.createMany({data:[{workerId:worker.id,baustelleId:zulu.id,startTime:new Date(Date.now()-60000),isLive:true},{workerId:second.id,baustelleId:beta.id,startTime:new Date(Date.now()-120000),isLive:true}]});
 const part=await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:parts.id,list:'part',mark:'PLATE-DEMO',quantity:10,weightKg:100}});
 await prisma.siteElementWork.create({data:{companyProfileId:company.id,elementId:part.id,stage:'cutting',pieces:4,workerIds:[worker.id],checkedByName:'Synthetic confirmation'}});
 await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:alpha.id,list:'assembly',mark:'ASSEMBLY-DEMO',quantity:2,weightKg:20,processRoutes:{v:1,factory:['cutting','welding'],field:[]}}});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  for(const[width,height,theme]of [[1440,900,'light'],[390,844,'dark'],[320,740,'light'],[760,390,'dark']]as const){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto('/workzone');
   const cards=page.locator('[data-studio-site-list] [data-studio-card-id]');await expect(cards).toHaveCount(5);
   if(!baseline){expect(await cards.evaluateAll(ns=>ns.map(n=>(n as HTMLElement).dataset.studioCardId))).toEqual([zulu.id,beta.id,alpha.id,parts.id,zed.id]);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-board-${width}-${theme}.png`});
   const output=page.locator(`[data-testid="factory-output-site"][data-site-id="${parts.id}"]`);
   if(!baseline){await expect(output).toContainText('Prerja e pjesëve: 4/10 copë');await expect(output.getByTestId('factory-process-percent')).toHaveText('40%');await output.scrollIntoViewIfNeeded();}
   else await page.locator('#fabrika').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-factory-${width}-${theme}.png`});
   await page.goto(`/workzone/baustellen/${parts.id}`);
   if(!baseline){const detail=page.getByTestId('site-factory-output');await expect(detail.getByTestId('factory-process-percent')).toHaveText('40%');await expect(detail).toContainText('Prerja e pjesëve: 4/10 copë');await expect(detail).not.toContainText('0/0 copë');await detail.scrollIntoViewIfNeeded();}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-site-${width}-${theme}.png`});
  }
  if(!baseline){
   // A site becomes active without editing the site: it must move ahead of idle cards.
   await prisma.workSession.updateMany({where:{workerId:second.id,isLive:true},data:{baustelleId:zed.id,startTime:new Date()}});await page.goto('/workzone');
   await expect.poll(()=>page.locator('[data-studio-site-list] [data-studio-card-id]').first().getAttribute('data-studio-card-id')).toBe(zed.id);
   // A new saved partial check advances the same source on home and detail.
   await prisma.siteElementWork.create({data:{companyProfileId:company.id,elementId:part.id,stage:'cutting',pieces:3,workerIds:[worker.id],checkedByName:'Synthetic next confirmation'}});
   await page.reload();const output=page.locator(`[data-testid="factory-output-site"][data-site-id="${parts.id}"]`);await expect(output.getByTestId('factory-process-percent')).toHaveText('70%');await expect(output).toContainText('7/10 copë');
   await page.goto(`/workzone/baustellen/${parts.id}`);await expect(page.getByTestId('site-factory-output').getByTestId('factory-process-percent')).toHaveText('70%');
   expect(await prisma.siteElement.count({where:{companyProfileId:company.id,list:'assembly',baustelleId:parts.id}})).toBe(0);
   const field=await browserWorkerCookie(second.id);await context.clearCookies();await context.addCookies([{name:'bk_worker_id',value:field,url:base},{name:'bk_lang',value:'sq',url:base}]);await page.goto('/workzone');await expect(page.getByTestId('factory-output-site')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
 }finally{await removeSecurityTenants([company.id]);}
 async function browserWorkerCookie(id:string){const w=await prisma.worker.findUniqueOrThrow({where:{id}});return createSessionCookie('worker',w.id,w.sessionEpoch);}
 void factory;
});
