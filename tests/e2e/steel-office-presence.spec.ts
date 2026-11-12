import {expect,test,type BrowserContext} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';

async function login(context:BrowserContext,base:string,kind:'admin'|'worker',id:string){
 const person=kind==='admin'?await prisma.user.findUniqueOrThrow({where:{id}}):await prisma.worker.findUniqueOrThrow({where:{id}});
 await context.clearCookies();await context.addCookies([{name:kind==='admin'?'bk_admin_id':'bk_worker_id',value:await createSessionCookie(kind,id,person.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
}

test('office stop, green door and compact live roster share the real attendance state',async({page,context},info)=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),out=process.env.OFFICE_EVIDENCE_DIR!,companyId='office-e2e-company',adminId='office-e2e-megi',workerId='office-e2e-worker-megi';
 await prisma.companyProfile.upsert({where:{id:companyId},update:{mode:'bau'},create:{id:companyId,displayName:'Office Studio · DEMO',legalName:'Synthetic local only',mode:'bau'}});
 await prisma.user.upsert({where:{id:adminId},update:{isActive:true},create:{id:adminId,email:'office-presence-chief@example.test',companyProfileId:companyId,name:'Chief · DEMO',role:'ADMIN'}});
 await prisma.worker.upsert({where:{id:workerId},update:{status:'active',availability:'AVAILABLE'},create:{id:workerId,companyProfileId:companyId,firstName:'Office',lastName:'Demo',crewRole:'OFFICE'}});
 const staff=await prisma.worker.create({data:{companyProfileId:companyId,firstName:'Elira',lastName:'Demo',crewRole:'OFFICE'}});
 const member=await prisma.officeMember.create({data:{companyProfileId:companyId,workerId:staff.id,title:'Inxhiniere · DEMO',enabled:true}});
 await prisma.workSession.deleteMany({where:{worker:{companyProfileId:companyId}}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 try{
  await login(context,base,'worker',staff.id);await page.setViewportSize({width:390,height:844});await page.goto('/workzone/offices/me');
  await page.getByRole('button',{name:'Puno në zyrë',exact:true}).click();await expect(page.getByRole('button',{name:'Ndalo punën në zyrë'})).toBeVisible();
  await login(context,base,'admin',adminId);await page.goto(`/workzone/offices/people/${member.id}`);await expect(page.getByTestId('office-work-button')).toHaveCount(0);
  await page.goto('/workzone/offices');await expect(page.getByTestId('office-presence-display')).toContainText('Elira Demo');await expect(page.locator('[data-office-entrance][data-office-presence=active]').filter({hasText:'Elira Demo'})).toHaveCount(1);
  await page.goto('/workzone/offices/me');await page.getByRole('button',{name:'Puno në zyrë',exact:true}).click();await expect(page.getByRole('button',{name:'Ndalo punën në zyrë'})).toBeVisible();
  for(const[width,height,theme]of[[1440,900,'light'],[390,844,'dark'],[320,740,'light'],[760,360,'dark']] as const){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto('/workzone/offices/me');
   const stop=page.getByRole('button',{name:'Ndalo punën në zyrë'}),b=await stop.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);await page.screenshot({path:`${out}/room-${theme}-${width}.png`});
   await page.goto('/workzone/offices');const display=page.getByTestId('office-presence-display');await expect(display).toContainText('Elira Demo');expect(await display.locator('header b').textContent()).toBe('2');
   const panel=await display.boundingBox();expect(panel!.x).toBeGreaterThanOrEqual(0);expect(panel!.y).toBeGreaterThanOrEqual(0);expect(panel!.x+panel!.width).toBeLessThanOrEqual(width);expect(panel!.y+panel!.height).toBeLessThanOrEqual(height);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${out}/reception-${theme}-${width}.png`});
  }
  await page.goto('/workzone/offices/me');await page.getByRole('button',{name:'Ndalo punën në zyrë'}).click();await expect(page.getByRole('button',{name:'Puno në zyrë',exact:true})).toBeVisible();await expect(page).toHaveURL(base+'/workzone/offices/me');
  expect(await prisma.workSession.count({where:{workerId,isLive:true}})).toBe(0);
  await page.goto('/workzone/offices');await expect(page.getByTestId('office-presence-display').locator('header b')).toHaveText('1');
  await login(context,base,'worker',staff.id);await page.goto('/workzone/offices/me');await page.getByRole('button',{name:'Ndalo punën në zyrë'}).click();await expect(page.getByRole('button',{name:'Puno në zyrë',exact:true})).toBeVisible();
  await page.goto('/workzone/offices');await expect(page.getByTestId('office-presence-display').locator('header b')).toHaveText('0');await expect(page.locator('[data-office-entrance][data-office-presence=active]')).toHaveCount(0);
  expect(errors).toEqual([]);
 }finally{await prisma.officeMember.delete({where:{id:member.id}});await prisma.worker.delete({where:{id:staff.id}});}
});
