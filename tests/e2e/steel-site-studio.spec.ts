import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
import {seedSteelWorkCatalog} from '../fixtures/steel-work-catalog';

const words=JSON.parse(readFileSync(new URL('../../src/locales/sq.json',import.meta.url),'utf8'));
const text=(path:string):string=>path.split('.').reduce((v,k)=>v[k],words);
async function login(context:BrowserContext,base:string,kind:'admin'|'worker',id:string,epoch:number){
 await context.clearCookies();await context.addCookies([{name:kind==='admin'?'bk_admin_id':'bk_worker_id',value:await createSessionCookie(kind,id,epoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const dialog=page.getByRole('dialog').last();if(await dialog.count())expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);}

test('steel interiors keep real process commands, material routes and viewer boundaries in compact glass',async({page,context,browser},info)=>{
 test.setTimeout(240000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),baseline=process.env.SITE_STUDIO_BASELINE==='true',out=process.env.OFFICE_EVIDENCE_DIR!,errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 const company=await prisma.companyProfile.create({data:{displayName:'Aurora Glass · DEMO',legalName:'Synthetic local only',mode:'bau',country:'AL'}});
 let viewerContext:BrowserContext|undefined;
 try{
  const admin=await prisma.user.create({data:{companyProfileId:company.id,email:`glass-${company.id}@example.test`,name:'Studio Chief · DEMO',role:'ADMIN',isActive:true}});
  const seed=await seedSteelWorkCatalog(company.id,{worker:true});
  const viewer=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Reader',lastName:'Synthetic',crewRole:'FIELD_WORKER',accessLevel:'BASE'}});
  await prisma.accessGrant.createMany({data:['site','factory','field'].map(place=>({companyProfileId:company.id,workerId:viewer.id,place,scopeId:seed.sites.aurora.id,level:'view'}))});
  await prisma.workSession.create({data:{workerId:seed.worker!.id,baustelleId:seed.sites.aurora.id,startTime:new Date(),isLive:true,breakMinutes:0}});
  const photo=await sharp({create:{width:640,height:360,channels:3,background:'#758a7a'}}).webp().toBuffer();
  await prisma.assetPhoto.create({data:{companyProfileId:company.id,baustelleId:seed.sites.aurora.id,data:photo}});
  await prisma.baustelle.update({where:{id:seed.sites.aurora.id},data:{coverPhotoAt:new Date()}});
  await login(context,base,'admin',admin.id,admin.sessionEpoch);
  const url=`/workzone/baustellen/${seed.sites.aurora.id}`;
  const snap=async(name:string,theme:string,width:number)=>{const open=page.getByRole('dialog').last();if(await open.count()){await expect.poll(()=>open.evaluate(e=>getComputedStyle(e).opacity)).toBe('1');await expect.poll(()=>open.locator('div[style*="opacity"]').evaluateAll(ns=>ns.every(n=>!n.getClientRects().length||n.closest('[inert]')||getComputedStyle(n).opacity==='1'))).toBe(true);}await page.screenshot({path:`${out}/${baseline?'before':'after'}-${name}-${theme}-${width}.png`});};
  for(const theme of ['light','dark'])for(const[width,height]of[[1440,1000],[390,844],[320,740],[760,360]]){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto(url);
   await expect(page.getByRole('heading',{name:seed.sites.aurora.name,exact:true})).toBeVisible();await fits(page);
   await expect(page.locator(`img[src*="/api/asset-photos/site/${seed.sites.aurora.id}"]`).first()).toBeVisible();
   if(!baseline){
    await expect(page.locator('[data-studio-interior]')).toHaveCount(1);
    expect(await page.locator('.steelStudioWorkspace').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('/office-studio-v1/connected-work-artwork.webp');
    const worker=page.locator('[data-worker-live="true"]').first();await expect(worker).toBeVisible();
    const state=await worker.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,animation:getComputedStyle(e,'::after').animationName,ring:getComputedStyle(e).getPropertyValue('--tw-ring-color')}));
    expect(state.animation).toBe('none');const rgb=state.bg.match(/\d+/g)!.slice(0,3).map(Number);expect(rgb[1]).toBeGreaterThan(rgb[0]+8);expect(rgb[1]).toBeGreaterThan(rgb[2]+8);
    expect(await page.locator('[data-studio-list-open]').first().evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
   }
   await snap('site',theme,width);
   if(!baseline){const cards=await page.locator('[data-studio-phase-board] button').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));const sizing=await page.locator('[data-studio-site-columns]').evaluate(e=>[e,...e.children].map(n=>({width:n.getBoundingClientRect().width,min:getComputedStyle(n).minWidth,columns:getComputedStyle(n).gridTemplateColumns})));expect(cards.every(r=>r.left>=-1&&r.right<=width+1),JSON.stringify({width,cards,sizing})).toBe(true);}
   await page.getByTestId('phase-group-assembly').click();await fits(page);await snap('phases',theme,width);
   const phase=page.getByRole('button').filter({has:page.getByText('Pastrim demo',{exact:true})});await phase.click();
   const sheet=page.getByRole('dialog',{name:'Pastrim demo',exact:true});await expect(sheet).toBeVisible();await fits(page);
   await snap('phase-detail',theme,width);
   if(!baseline)await expect.poll(async()=>{const actions=await sheet.locator('[data-studio-phase-actions] button').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {w:Math.round(r.width*100)/100,h:Math.round(r.height*100)/100};}));return actions.length>1&&actions.every(r=>r.h>=44&&r.h<=49&&r.w>=44);},{message:'Settled process actions remain compact 44px touch targets'}).toBe(true);
   await sheet.getByRole('button',{name:text('steel.close'),exact:true}).click();
   await page.getByRole('button',{name:new RegExp('^'+text('elements.factoryList'))}).click();await fits(page);await snap('materials',theme,width);
   if(!baseline)expect(await page.locator('[data-studio-list-title]').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1&&e.clientHeight<=parseFloat(getComputedStyle(e).lineHeight)*2.1)).toBe(true);
   await page.getByRole('dialog').last().getByRole('button').filter({has:page.getByText(seed.elements.column.mark,{exact:true})}).click();await fits(page);await snap('element',theme,width);
   await page.getByRole('dialog').last().getByRole('button').filter({has:page.getByText(text('factory.steps.cutting'),{exact:true})}).click();await expect(page.getByRole('dialog').last().getByText(`${seed.elements.column.mark} · ${text('factory.steps.cutting')}`,{exact:true})).toBeVisible();await fits(page);await snap('element-stage',theme,width);
   if(!baseline){const targets=await page.getByRole('dialog').last().locator('.grid-cols-6 button[aria-pressed]').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}));expect(targets.length).toBe(6);expect(targets.every(a=>a.w>=44&&a.h>=44&&a.x>=0&&a.right<=width)).toBe(true);expect(targets.every((a,i)=>targets.every((b,j)=>i===j||a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y))).toBe(true);}
   await page.getByRole('dialog').last().getByRole('button',{name:text('factory.close'),exact:true}).click();
  }
  // Commands are the real existing server actions, limited to disposable data.
  await page.setViewportSize({width:390,height:844});await page.goto(url);await page.getByTestId('phase-group-assembly').click();
  await page.getByRole('button').filter({has:page.getByText('Pastrim demo',{exact:true})}).click();let sheet=page.getByRole('dialog',{name:'Pastrim demo',exact:true});
  // Simulate another planner moving this same process before the next refresh.
  if(!baseline)expect((await prisma.steelSiteTask.updateMany({where:{companyProfileId:company.id,baustelleId:seed.sites.aurora.id,treeItemId:seed.customTasks[5].id},data:{position:1}})).count).toBe(1);
  await sheet.getByRole('button',{name:text('steel.note'),exact:true}).click();await sheet.getByRole('textbox').fill('Shënim prove i ruajtur · DEMO');await page.setViewportSize({width:390,height:480});await sheet.getByRole('button',{name:text('steel.save'),exact:true}).scrollIntoViewIfNeeded();await fits(page);await snap('note-short','dark',390);await sheet.getByRole('button',{name:text('steel.save'),exact:true}).click();await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>JSON.parse((await prisma.treeItem.findUniqueOrThrow({where:{id:seed.customTasks[5].id}})).notes??'{}').note).toBe('Shënim prove i ruajtur · DEMO');
  await expect(sheet.getByRole('heading',{name:'Pastrim demo',exact:true})).toBeVisible();
  await sheet.getByRole('button',{name:text('steel.markDone'),exact:true}).click();await expect.poll(async()=>(await prisma.treeItem.findUniqueOrThrow({where:{id:seed.customTasks[5].id}})).status).toBe('done');
  await sheet.getByRole('button',{name:text('steel.reopen'),exact:true}).click();await expect.poll(async()=>(await prisma.treeItem.findUniqueOrThrow({where:{id:seed.customTasks[5].id}})).status).toBe('todo');
  await sheet.getByRole('button',{name:text('steel.close'),exact:true}).click();
  // A reader sees the same materials without the engineer/admin actions.
  viewerContext=await browser.newContext({baseURL:base});await viewerContext.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  await login(viewerContext,base,'worker',viewer.id,viewer.sessionEpoch);const vp=await viewerContext.newPage();await vp.goto(url);await expect(vp.getByRole('heading',{name:seed.sites.aurora.name,exact:true})).toBeVisible();
  await expect(vp.getByRole('button',{name:text('steel.addTask'),exact:true})).toHaveCount(0);await vp.getByTestId('phase-group-assembly').click();await vp.getByRole('button').filter({has:vp.getByText('Pastrim demo',{exact:true})}).click();sheet=vp.getByRole('dialog',{name:'Pastrim demo',exact:true});
  await expect(sheet.getByRole('button',{name:text('steel.markDone'),exact:true})).toHaveCount(0);await expect(sheet.getByRole('button',{name:text('steel.note'),exact:true})).toHaveCount(0);
  await vp.goto(`/workzone/baustellen/${seed.sites.vega.id}`);await expect(vp.getByTestId('no-access')).toBeVisible();await expect(vp.locator('[data-studio-interior]')).toHaveCount(0);
  for(const task of seed.customTasks.slice(0,5))expect((await prisma.treeItem.findUniqueOrThrow({where:{id:task.id}})).status).toBe(task.status);
  expect(await prisma.siteElementWork.count({where:{companyProfileId:company.id}})).toBe(6);expect(errors).toEqual([]);
 }finally{await viewerContext?.close();await prisma.user.deleteMany({where:{companyProfileId:company.id}});await prisma.companyProfile.delete({where:{id:company.id}});}
});
