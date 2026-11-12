import { expect, test, type BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';

async function login(context: BrowserContext, base: string, kind: 'admin'|'worker', id: string) {
 const person=kind==='admin'?await prisma.user.findUniqueOrThrow({where:{id}}):await prisma.worker.findUniqueOrThrow({where:{id}});
 await context.clearCookies();await context.addCookies([{name:kind==='admin'?'bk_admin_id':'bk_worker_id',value:await createSessionCookie(kind,id,person.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
}
test('catalog photos stay inside their thumbnails and office start records the current person only', async({page,context},info)=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const base=String(info.project.use.baseURL),out=process.env.OFFICE_EVIDENCE_DIR!;
 const companyId='office-e2e-company',adminId='office-e2e-megi',workerId='office-e2e-worker-megi';
 await prisma.companyProfile.upsert({where:{id:companyId},update:{mode:'bau'},create:{id:companyId,displayName:'Office Glass · DEMO',legalName:'Synthetic local only',mode:'bau'}});
 await prisma.user.upsert({where:{id:adminId},update:{isActive:true},create:{id:adminId,email:'office-presence-chief@example.test',name:'Chief · DEMO',companyProfileId:companyId,role:'ADMIN'}});
 await prisma.worker.upsert({where:{id:workerId},update:{status:'active',availability:'AVAILABLE'},create:{id:workerId,companyProfileId:companyId,firstName:'Office',lastName:'Demo',crewRole:'OFFICE'}});
 const seed=await seedSteelWorkCatalog(companyId);
 await prisma.steelWorkDefinition.upsert({where:{companyProfileId_key:{companyProfileId:companyId,key:'catalog-painting-demo'}},update:{},create:{companyProfileId:companyId,key:'catalog-painting-demo',kind:'site',phaseGroup:'concrete',label:'Lyerje · DEMO',linkedProcessKey:'painting'}});
 const member=await prisma.officeMember.upsert({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId}},update:{enabled:true},create:{companyProfileId:companyId,workerId,title:'Office · DEMO',enabled:true}});
 await prisma.workSession.deleteMany({where:{workerId}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 await login(context,base,'admin',adminId);
 for(const [width,height,theme] of [[1440,900,'light'],[390,844,'dark'],[320,740,'light']] as const){
  await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);
  await page.goto(`/workzone/baustellen/${seed.sites.aurora.id}`);
  await page.getByRole('button',{name:'Shto detyrë',exact:true}).first().click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect.poll(()=>dialog.locator('[data-steel-work-visual]').count()).toBeGreaterThan(0);
  const previews=dialog.locator('[data-studio-process]');await expect.poll(()=>previews.count()).toBeGreaterThan(0);
  const boxes=await previews.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),sprite=n.firstElementChild!.getBoundingClientRect();return {w:r.width,h:r.height,sw:sprite.width,position:getComputedStyle(n).position};}));
  for(const b of boxes){expect(b.w).toBeLessThanOrEqual(130);expect(b.h).toBeLessThanOrEqual(100);expect(b.sw).toBeLessThanOrEqual(b.w+1);expect(b.position).toBe('relative');}
  await page.screenshot({path:`${out}/catalog-${theme}-${width}.png`});await dialog.getByRole('button',{name:'Mbyll',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.goto('/workzone/offices/me');const button=page.getByTestId('office-work-button');await expect(button).toBeVisible();
  const b=await button.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`${out}/office-${theme}-${width}.png`});
 }
 await page.getByTestId('office-work-button').click();await expect(page.getByTestId('office-work-button')).toHaveText('Në zyrë');
 await page.reload();await expect(page.getByTestId('office-work-button')).toHaveText('Në zyrë');
 const live=await prisma.workSession.findMany({where:{workerId,isLive:true}});expect(live).toHaveLength(1);expect(live[0].workplace).toBe('OFFICE');expect(live[0].baustelleId).toBeNull();
 // Manager preview must not allow starting another person's attendance.
 await page.goto(`/workzone/offices/people/${member.id}`);await expect(page.getByTestId('office-work-button')).toHaveCount(0);
 await login(context,base,'worker',workerId);await page.goto('/workzone/offices/me');await expect(page.getByTestId('office-work-button')).toHaveText('Në zyrë');
 expect(errors).toEqual([]);
});
