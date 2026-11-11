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
 await page.getByLabel('Emri / funksioni i zyrës').fill('Projektim · DEMO');await page.getByLabel('Lejo hyrjen me llogarinë ekzistuese').check();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
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
 await page.getByLabel('Lejo hyrjen me llogarinë ekzistuese').uncheck();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
 await login(context,'worker',worker.id);await page.goto('/workzone/offices/me/tasks');await expect(page.getByTestId('office-work')).toHaveCount(0);expect(errors).toEqual([]);
});





test('office drawers show workbooks and upload into the existing permitted site folder',async({page,context})=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const out=process.env.OFFICE_EVIDENCE_DIR!;const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const worker=await prisma.worker.findUniqueOrThrow({where:{id:'office-team-demo-worker'}});
 await prisma.worker.update({where:{id:worker.id},data:{crewRole:'OFFICE',accessLevel:'BASE'}});
 const member=await prisma.officeMember.update({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:worker.id}},data:{enabled:true,workbooksEnabled:true}});
 await prisma.workSession.upsert({where:{id:'office-drawer-session'},update:{},create:{id:'office-drawer-session',workerId:worker.id,startTime:new Date('2026-11-10T07:00:00Z'),endTime:new Date('2026-11-10T15:00:00Z'),totalHours:7.5,breakMinutes:30}});
 const site=await prisma.baustelle.upsert({where:{id:'office-drawer-site'},update:{},create:{id:'office-drawer-site',companyProfileId:companyId,name:'Dosja e fabrikës · DEMO',documents:[],type:'STEEL_ASSEMBLY'}});
 await prisma.accessGrant.upsert({where:{companyProfileId_place_scopeId_workerId:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:worker.id}},update:{level:'act'},create:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:worker.id,level:'act'}});
 await prisma.siteFile.deleteMany({where:{baustelleId:site.id}});
 await login(context,'worker',worker.id);await context.addCookies([{name:'bk_theme',value:'light',url:baseURL}]);await page.setViewportSize({width:390,height:844});await page.goto('/workzone/offices/me');
 await expect(page.getByTestId('office-header-entry').filter({visible:true})).toBeVisible();await page.screenshot({path:`${out}/drawer-light-390.png`});await page.locator('a[href="/workzone/offices/me/workbooks"]').first().click();
 await expect(page.getByRole('heading',{name:'Fletoret e punëtorëve'})).toBeVisible();await page.getByLabel('Kërko punonjës').fill('Lea');await page.getByRole('button',{name:'Shfaq',exact:true}).click();await expect(page.getByRole('row',{name:/Lea Demo/})).toContainText('7.50');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${out}/workbooks-light-390.png`});await page.getByRole('link',{name:'Hap',exact:true}).click();await expect(page).toHaveURL(/worker=office-team-demo-worker/);await expect(page.getByTestId('timesheet-days')).toBeVisible();await page.screenshot({path:`${out}/workbook-light-390.png`});
 await page.goto('/workzone/offices/me/resources');await page.getByRole('link',{name:'Hap dosjen',exact:true}).click();await page.getByRole('button',{name:/Dokumentet/}).click();
 await page.locator('input[type=file][accept*=".docx"]').setInputFiles({name:'Nga-zyra-DEMO.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSynthetic only\n%%EOF')});await expect(page.getByText('Nga-zyra-DEMO.pdf',{exact:true})).toBeVisible();expect(await prisma.siteFile.count({where:{baustelleId:site.id,fileName:'Nga-zyra-DEMO.pdf'}})).toBe(1);await page.screenshot({path:`${out}/office-upload-light-390.png`});
 for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const [width,height]of[[1440,1000],[390,844],[320,740],[760,360]]){await page.setViewportSize({width,height});await page.goto('/workzone/offices/me/resources');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${out}/resources-${theme}-${width}.png`});}}
 await prisma.officeMember.update({where:{id:member.id},data:{workbooksEnabled:false}});await page.goto('/workzone/offices/me/workbooks');await expect(page.getByRole('heading',{name:'Fletoret e punëtorëve'})).toHaveCount(0);expect(pageErrors).toEqual([]);
});
