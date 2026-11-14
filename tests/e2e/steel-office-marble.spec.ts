import '../fixtures/office-e2e';
import {expect,test} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';

test('reception attendance is legible shell-free lettering anchored on the marble',async({page,context},info)=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const base=String(info.project.use.baseURL),out=process.env.OFFICE_EVIDENCE_DIR!,companyId='office-e2e-company',adminId='office-e2e-megi',workerId='office-e2e-worker-megi';
 await prisma.companyProfile.upsert({where:{id:companyId},update:{mode:'bau'},create:{id:companyId,displayName:'Office Studio · DEMO',legalName:'Synthetic local only',mode:'bau'}});
 const admin=await prisma.user.upsert({where:{id:adminId},update:{isActive:true},create:{id:adminId,email:'office-presence-chief@example.test',companyProfileId:companyId,name:'Chief · DEMO',role:'ADMIN'}});
 await prisma.worker.upsert({where:{id:workerId},update:{status:'active',availability:'AVAILABLE'},create:{id:workerId,companyProfileId:companyId,firstName:'Office',lastName:'Demo',crewRole:'OFFICE'}});
 const staff=await Promise.all(['Elira','Pranvera'].map(firstName=>prisma.worker.create({data:{companyProfileId:companyId,firstName,lastName:'Demo',crewRole:'OFFICE'}})));
 try{
  await prisma.officeMember.createMany({data:staff.map(w=>({companyProfileId:companyId,workerId:w.id,title:'Studio · DEMO',enabled:true}))});
  await prisma.workSession.deleteMany({where:{worker:{companyProfileId:companyId}}});
  await prisma.workSession.createMany({data:[workerId,...staff.map(w=>w.id)].map(id=>({workerId:id,isLive:true,workplace:'OFFICE',startTime:new Date(Date.now()-60000)}))});
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',adminId,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const[width,height,theme]of[[1440,900,'light'],[390,844,'dark'],[320,740,'light'],[760,360,'dark']] as const){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);await page.goto('/workzone/offices');
   const display=page.getByTestId('office-presence-display');await expect(display.locator('header b')).toHaveText('3');
   expect(await display.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow,blur:s.backdropFilter};})).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none',blur:'none'});
   await expect(display.locator('a,svg')).toHaveCount(0);
   const b=await display.boundingBox();expect(b!.x).toBeGreaterThan(width*.45);expect(b!.x).toBeLessThan(width*.7);expect(b!.y).toBeGreaterThan(height*.6);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await page.screenshot({path:`${out}/marble-${theme}-${width}.png`});
   const more=display.locator('summary');await more.click();await expect(display.locator('details')).toHaveAttribute('open','');await expect(display.locator('details li')).toHaveCount(3);expect(await more.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);await page.screenshot({path:`${out}/marble-expanded-${theme}-${width}.png`});await more.click();
  }
  expect(errors).toEqual([]);
 }finally{await prisma.officeMember.deleteMany({where:{workerId:{in:staff.map(w=>w.id)}}});await prisma.worker.deleteMany({where:{id:{in:staff.map(w=>w.id)}}});await prisma.workSession.deleteMany({where:{workerId}});}
});
