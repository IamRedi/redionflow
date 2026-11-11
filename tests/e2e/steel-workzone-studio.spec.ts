import {test,expect} from '@playwright/test';
import sharp from 'sharp';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
import {seedSteelAssetsWorkshop,cleanupSteelAssetsWorkshop} from '../fixtures/steel-assets-workshop';
import {dateKey,dayRange} from '../../src/lib/workzone/date-utils';

test('photorealistic steel workspace preserves sites, factory, photos, fleet and workshop flows',async({page,context},info)=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),baseline=process.env.OFFICE_BASELINE==='true',out=process.env.OFFICE_EVIDENCE_DIR!;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
 const company=await prisma.companyProfile.create({data:{displayName:'Synthetic Assets · DEMO',legalName:'Fictional studio test',mode:'bau',country:'AL'}});
 try{
  const admin=await prisma.user.create({data:{companyProfileId:company.id,name:'Studio Chief · DEMO',email:`studio-${company.id}@example.test`,role:'ADMIN',isActive:true}});
  const seed=await seedSteelAssetsWorkshop(company.id,company.id);
  const covered=await prisma.baustelle.create({data:{companyProfileId:company.id,type:'STEEL_ASSEMBLY',name:'Glass pavilion · DEMO',address:'Fictional industrial park',coverPhotoAt:new Date()}});
  const photo=await sharp({create:{width:640,height:360,channels:3,background:'#718b82'}}).webp().toBuffer();
  await prisma.assetPhoto.create({data:{companyProfileId:company.id,baustelleId:covered.id,data:photo}});
  await prisma.baustelle.create({data:{companyProfileId:company.id,type:'STEEL_ASSEMBLY',name:'Riverside structure · DEMO'}});
  await prisma.dailyWorkPlan.create({data:{companyProfileId:company.id,createdByAdminId:admin.id,planDate:dayRange(dateKey(new Date())).start,columns:{create:{title:covered.name,baustelleId:covered.id}},savedRows:{create:{workerNames:'Demo Operator',machineNames:'Demo vehicle',baustelleName:covered.name,note:'Inspect the uploaded drawing before delivery · DEMO'}}}});
  for(const [i,phase]of ['reported','reported','received','received','repairing','repairing','ready','ready'].entries()){
   const asset=await prisma.companyOperationalAsset.create({data:{companyProfileId:company.id,machineId:seed.machines[i].id}});
   await prisma.companyAssetRepair.create({data:{companyProfileId:company.id,assetId:asset.id,phase,location:i===5?'external':'internal',problem:'Scheduled inspection · DEMO',tested:phase==='ready',repairNote:phase==='ready'?'Inspection complete · DEMO':'',reportedByKey:'synthetic:studio',reportedByName:'Demo Operator'}});
  }
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  async function screenshot(name:string,theme:string,width:number){await page.screenshot({path:`${out}/${baseline?'before':'after'}-${name}-${theme}-${width}.png`});}
  async function fits(){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
  for(const theme of ['light','dark'])for(const[width,height]of[[1440,1000],[390,844],[320,740],[760,360]]){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto('/workzone');
   await expect(page.getByTestId('app-workspace-scroll')).toBeVisible();await expect(page.getByTestId('site-card-open')).toHaveCount(3);await fits();
   if(!baseline){await expect(page.locator('[data-steel-studio]')).toHaveCount(1);await expect(page.locator('[data-studio-environment=site]').first()).toBeVisible();expect(await page.getByTestId('workzone-topbar').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect.poll(()=>page.locator('[data-studio-site-card]').evaluateAll(cards=>{const r=cards.map(c=>c.getBoundingClientRect());return r.every((a,i)=>r.every((b,j)=>i===j||a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y));})).toBe(true);
    const targets=await page.getByTestId('site-card-open').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height};}));expect(targets.every(r=>r.w>=44&&r.h>=44)).toBe(true);
   }
   await screenshot('workzone',theme,width);
   await page.locator('#fabrika').scrollIntoViewIfNeeded();await fits();await screenshot('factory',theme,width);
   await page.getByTestId('app-workspace-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);const footer=page.getByTestId('app-workspace-scroll').locator('footer');await expect(footer).toBeVisible();
   await page.getByTestId('app-workspace-scroll').evaluate(e=>e.scrollTop=0);await expect(footer).not.toBeInViewport();
   await page.getByTestId('fleet-dock-open').click();await expect(page.getByTestId('fleet-card-grid').locator('button')).toHaveCount(12);await fits();await screenshot('fleet',theme,width);await page.keyboard.press('Escape');
   await page.getByTestId('workshop-dock-open').click();await expect(page.getByTestId('workshop-workspace')).toBeVisible();await expect(page.getByTestId('workshop-repair-card').first()).toBeVisible();await fits();await screenshot('workshop',theme,width);
   await page.getByTestId('workshop-repair-card').first().click();await expect(page.getByTestId('asset-detail')).toBeVisible();await fits();await screenshot('repair',theme,width);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:390,height:844});await page.goto('/workzone');await page.locator('button').filter({has:page.locator('svg.lucide-map')}).click();await expect(page.getByTestId('workzone-map-layout')).toBeVisible();await fits();await screenshot('map','dark',390);
  await page.goto(`/workzone/baustellen/${covered.id}`);await expect(page.getByRole('heading',{name:covered.name,exact:true})).toBeVisible();await expect(page.locator(`img[src*="/api/asset-photos/site/${covered.id}"]`).first()).toBeVisible();await fits();await screenshot('site-photo','dark',390);
  if(!baseline){await page.emulateMedia({media:'print'});const ink=await page.evaluate(()=>getComputedStyle(document.body).color.match(/\d+/g)?.slice(0,3).map(Number)??[]);expect(ink).toHaveLength(3);expect(ink.every(value=>value<50)).toBe(true);await page.emulateMedia({media:'screen'});}
  expect(await prisma.companyAssetRepair.count({where:{companyProfileId:company.id}})).toBe(8);expect(await prisma.workSession.count({where:{worker:{companyProfileId:company.id}}})).toBe(0);expect(errors).toEqual([]);
 }finally{await cleanupSteelAssetsWorkshop(company.id);}
});

test('classic companies keep their existing palette and do not load industrial assets',async({page,context},info)=>{
 assertE2ETestDatabase(process.env);const base=String(info.project.use.baseURL);
 const company=await prisma.companyProfile.create({data:{displayName:'Classic tree services · DEMO',legalName:'Synthetic only',mode:'baumdienst'}});
 const assets:string[]=[];page.on('request',r=>{if(r.url().includes('/steel-studio-v1/'))assets.push(r.url());});
 try{
  const admin=await prisma.user.create({data:{companyProfileId:company.id,name:'Classic Chief · DEMO',email:`classic-${company.id}@example.test`,role:'ADMIN',isActive:true}});
  await prisma.baustelle.create({data:{companyProfileId:company.id,type:'CLIMBING',name:'Classic trees · DEMO'}});
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  await page.goto('/workzone');await expect(page.locator('[data-steel-studio]')).toHaveCount(0);
  expect(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--steel-glass').trim())).toBe('');expect(assets).toEqual([]);
 }finally{await prisma.user.deleteMany({where:{companyProfileId:company.id}});await prisma.companyProfile.delete({where:{id:company.id}});}
});
