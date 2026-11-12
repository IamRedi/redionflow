import {expect,test} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
import {seedSteelAssetsWorkshop,cleanupSteelAssetsWorkshop} from '../fixtures/steel-assets-workshop';

test('factory and workshop show actual people; compact workshop preserves repair navigation and own clock',async({page,context,browser},info)=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),out=process.env.WORKSHOP_PRESENCE_EVIDENCE_DIR!,baseline=process.env.WORKSHOP_PRESENCE_BASELINE==='true';
 const company=await prisma.companyProfile.create({data:{displayName:'Synthetic assets DEMO',legalName:'Local only',mode:'bau',country:'AL'}});
 const employeeContext=await browser.newContext(),employee=await employeeContext.newPage(),errors:string[]=[];
 for(const p of [page,employee])p.on('pageerror',e=>errors.push(e.message));
 for(const c of [context,employeeContext])await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 try{
  const seed=await seedSteelAssetsWorkshop(company.id,company.id),admin=await prisma.user.create({data:{companyProfileId:company.id,email:`presence-${company.id}@example.test`,name:'Demo chief',role:'ADMIN'}});
  const factory=await prisma.baustelle.findFirstOrThrow({where:{companyProfileId:company.id,type:'STEEL_WORKSHOP'}});
  const workers=await Promise.all(['Arben','Elira','Dritan','Mira'].map(firstName=>prisma.worker.create({data:{companyProfileId:company.id,firstName,lastName:'DEMO',crewRole:'FACTORY_WORKER',availability:'AVAILABLE'}})));
  await prisma.workSession.createMany({data:workers.map(w=>({workerId:w.id,isLive:true,startTime:new Date(Date.now()-3600000),baustelleId:factory.id}))});
  await prisma.workSession.create({data:{workerId:seed.worker.id,isLive:true,startTime:new Date(),baustelleId:seed.site.id}});
  const mechanicClock=await prisma.workSession.create({data:{workerId:seed.mechanic.id,isLive:true,startTime:new Date(Date.now()-3600000),workplace:baseline?null:'WORKSHOP'}});
  for(const[i,phase]of ['reported','reported','received','received','repairing','repairing','ready','ready','ready','ready'].entries()){
   const asset=await prisma.companyOperationalAsset.create({data:{companyProfileId:company.id,machineId:seed.machines[i].id}});
   await prisma.companyAssetRepair.create({data:{companyProfileId:company.id,assetId:asset.id,phase,problem:'Synthetic inspection',reportedByKey:'synthetic',reportedByName:'Demo chief',tested:phase==='ready',repairNote:phase==='ready'?'Completed inspection':''}});
  }
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  for(const theme of ['light','dark'])for(const[width,height]of [[1440,900],[390,844],[320,740],[760,360]]){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto('/workzone');
   await page.locator('#fabrika').scrollIntoViewIfNeeded();
   if(!baseline){
    const names=page.locator('#fabrika').getByTestId('live-worker-names');await expect(names).toContainText('Arben');await expect(names).toHaveAttribute('aria-label','Arben DEMO, Elira DEMO, Dritan DEMO, Mira DEMO');
    expect(await names.getAttribute('title')).toBeNull();await names.click();await expect(page.getByTestId('live-worker-names-list')).toContainText('Mira DEMO');
    await page.screenshot({path:`${out}/after-factory-${theme}-${width}.png`});await page.locator('#fabrika h2').click();
   }else await page.screenshot({path:`${out}/before-factory-${theme}-${width}.png`});
   // The site uses the same single popover, never a second native title.
   if(!baseline){await page.getByTestId('app-workspace-scroll').evaluate(e=>e.scrollTop=0);const names=page.locator('[data-studio-site-card]').getByTestId('live-worker-names').first();expect(await names.getAttribute('title')).toBeNull();}
   await page.getByTestId('workshop-dock-open').click();await expect(page.getByTestId('workshop-repair-card').first()).toBeVisible();
   if(!baseline){
    await expect(page.getByTestId('workshop-presence')).toContainText(seed.mechanic.firstName);
    if(width===1440){await page.getByTestId('workshop-presence').getByTestId('live-worker-names').hover();const list=page.getByTestId('live-worker-names-list');await expect(list).toBeVisible();expect(await list.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+10,r.y+10));})).toBe(true);await page.getByTestId('workshop-search').click();}await expect(page.getByTestId('workshop-history-preview').getByTestId('workshop-repair-card')).toHaveCount(3);
    expect((await page.getByTestId('workshop-search').boundingBox())!.width).toBeLessThanOrEqual(260);
    const s=await page.getByTestId('workshop-scroll').evaluate(e=>({h:e.clientHeight,scroll:e.scrollHeight}));if(width===1440)expect(s.scroll).toBeLessThanOrEqual(s.h+1);
    expect(await page.getByTestId('workshop-workspace').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-workshop-${theme}-${width}.png`});
   if(!baseline&&width===390){await page.getByRole('button',{name:'Hap historikun',exact:true}).click();await expect(page.getByRole('dialog').last().getByTestId('workshop-repair-card')).toHaveCount(4);await page.keyboard.press('Escape');}
   await page.getByTestId('workshop-repair-card').first().click();await expect(page.getByTestId('asset-detail')).toBeVisible();await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  }
  if(baseline)return;
  await page.setViewportSize({width:390,height:844});await page.goto('/workzone');await page.getByTestId('workshop-dock-open').click();
  const zoom=await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.getByTestId('workshop-workspace').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Hap historikun',exact:true}).click();await page.keyboard.press('Escape');
  await page.screenshot({path:`${out}/after-workshop-text-zoom.png`});await zoom.evaluate(e=>e.remove());
  const search=page.getByTestId('workshop-search').getByRole('searchbox');await search.fill('ZZ 010 DM');await expect(page.getByTestId('workshop-history-preview').getByTestId('workshop-repair-card')).toHaveCount(1);
  await search.fill('');await expect(page.getByTestId('workshop-history-preview').getByTestId('workshop-repair-card')).toHaveCount(3);await page.keyboard.press('Escape');
  await employeeContext.addCookies([{name:'bk_worker_id',value:await createSessionCookie('worker',seed.mechanic.id,seed.mechanic.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  await employee.setViewportSize({width:390,height:844});await employee.goto('/workzone');await employee.getByTestId('workshop-dock-open').click();
  const work=employee.getByTestId('workshop-work-here');await expect(work).toHaveText('Ndalo');await work.click();await expect(work).toHaveText('Puno këtu');
  expect((await prisma.workSession.findUniqueOrThrow({where:{id:mechanicClock.id}})).isLive).toBe(false);
  await work.click();await expect(work).toHaveText('Ndalo');expect(await prisma.workSession.count({where:{workerId:seed.mechanic.id,isLive:true,workplace:'WORKSHOP'}})).toBe(1);
  await employee.screenshot({path:`${out}/after-own-workshop-clock.png`});
  expect(errors).toEqual([]);
 }finally{await employeeContext.close();await cleanupSteelAssetsWorkshop(company.id);}
});
