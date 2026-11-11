import {expect,test,type BrowserContext} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
const companyId='office-e2e-company',baseURL='http://127.0.0.1:3230';
async function login(context:BrowserContext,kind:'admin'|'worker',id:string){
 const account=kind==='admin'?await prisma.user.findUniqueOrThrow({where:{id}}):await prisma.worker.findUniqueOrThrow({where:{id}});
 await context.clearCookies();await context.addCookies([{name:kind==='admin'?'bk_admin_id':'bk_worker_id',value:await createSessionCookie(kind,id,account.sessionEpoch),url:baseURL},{name:'bk_lang',value:'sq',url:baseURL}]);
}
test('team offices reuse login, categories and private work with physical room controls',async({page,context})=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await prisma.companyProfile.upsert({where:{id:companyId},update:{},create:{id:companyId,displayName:'Mira Steel · DEMO',legalName:'Synthetic only',mode:'bau',country:'AL'}});
 for(const [id,name] of [['office-e2e-megi','Megi Demo'],['office-e2e-almet','Almet Demo']])await prisma.user.upsert({where:{id},update:{isActive:true},create:{id,name,email:`${id}@example.test`,companyProfileId:companyId,role:'ADMIN'}});
 const worker=await prisma.worker.upsert({where:{id:'office-team-demo-worker'},update:{status:'active'},create:{id:'office-team-demo-worker',companyProfileId:companyId,firstName:'Lea',lastName:'Demo'}});
 await prisma.officeTask.deleteMany({where:{companyProfileId:companyId,title:'Përgatit dosjen · TEAM DEMO'}});
 await login(context,'admin','office-e2e-megi');await page.goto('/workzone/offices/team');
 await page.getByRole('searchbox').fill('Lea');await page.getByRole('button',{name:/^Lea Demo (—|Projektim)/}).click();
 await page.getByLabel('Emri / funksioni i zyrës').fill('Projektim · DEMO');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
 const member=await prisma.officeMember.findUniqueOrThrow({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:worker.id}}});
 await page.getByRole('link',{name:'Recepsioni',exact:true}).click();await page.getByRole('link',{name:/^Lea Demo (—|Projektim)/}).click();
 await expect(page.getByText('Puna, shënimet dhe Posta personale mbeten private.')).toBeVisible();
 await page.getByRole('link',{name:'Posta',exact:true}).click();await expect(page.locator('select[name=recipientId]')).toHaveValue(member.id);
 await page.goto('/workzone/offices/me/tasks');await page.getByRole('button',{name:'Shto',exact:true}).click();
 await page.getByLabel('Titulli',{exact:true}).fill('Përgatit dosjen · TEAM DEMO');await page.getByLabel('Lloji').selectOption('COMPANY');await page.getByRole('combobox',{name:'Kategoria',exact:true}).selectOption({label:'Tjetër'});await page.getByLabel('Përgjegjësi').selectOption(member.id);await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('button',{name:/^Përgatit dosjen · TEAM DEMO/})).toBeVisible();
 await login(context,'worker',worker.id);await page.goto('/workzone/offices/me/tasks');await expect(page.getByRole('button',{name:/^Përgatit dosjen · TEAM DEMO/})).toBeVisible();
 await page.goto('/workzone/offices/me');await expect(page.getByTestId('office-space')).toBeVisible();
 for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const [width,height] of [[1440,1000],[390,844],[320,740],[760,360]]){await page.setViewportSize({width,height});await page.reload();await expect(page.getByTestId('office-space')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/room-${theme}-${width}.png`});}}
 await page.setViewportSize({width:390,height:844});await page.getByTestId('office-space').getByRole('link',{name:/Hap kalendarin/}).click();await expect(page.getByTestId('plan-close')).toHaveAttribute('href','/workzone/offices/me');await page.getByTestId('plan-close').click();
 await prisma.officeTask.deleteMany({where:{companyProfileId:companyId,title:'Përgatit dosjen · TEAM DEMO'}});
 await login(context,'admin','office-e2e-megi');await page.goto('/workzone/offices/team');await page.getByRole('searchbox').fill('Lea');await page.getByRole('button',{name:/^Lea Demo (—|Projektim)/}).click();await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/team-light-390.png`});
 await page.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
 await login(context,'worker',worker.id);await page.goto('/workzone/offices/me/tasks');await expect(page.getByTestId('office-work')).toHaveCount(0);expect(errors).toEqual([]);
});




