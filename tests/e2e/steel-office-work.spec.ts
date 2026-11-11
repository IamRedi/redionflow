import { expect,test,type BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

test.use({actionTimeout:30_000});
const companyId='office-e2e-company',baseURL='http://127.0.0.1:3230';
async function login(context:BrowserContext,id:string){
  const account=await prisma.user.findUniqueOrThrow({where:{id},select:{sessionEpoch:true}});
  await context.clearCookies();await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',id,account.sessionEpoch),url:baseURL},{name:'bk_lang',value:'sq',url:baseURL}]);
}
test('private office work, mail and predictable return routes on desktop and phone',async({page,context})=>{
  test.setTimeout(300_000);assertE2ETestDatabase(process.env);
  expect(process.env.VIRTUAL_OFFICE_WORK_ENABLED).toBe('true');
  const output=process.env.OFFICE_EVIDENCE_DIR!;const errors:string[]=[];page.on('pageerror',e=>errors.push(`${page.url()}: ${e.message}`));
  await prisma.companyProfile.upsert({where:{id:companyId},update:{},create:{id:companyId,displayName:'Mira Steel · DEMO',legalName:'Mira Demo',mode:'bau',country:'AL'}});
  for(const[id,name]of[['office-e2e-megi','Megi Demo'],['office-e2e-almet','Almet Demo'],['office-e2e-other','Other Admin']])await prisma.user.upsert({where:{id},update:{isActive:true},create:{id,name,email:`${id}@example.test`,companyProfileId:companyId,role:'ADMIN',isActive:true,passwordHash:hashPassword('synthetic-only-unused')}});
  const where={companyProfileId:companyId};await prisma.officeAttachment.deleteMany({where});await prisma.officeMessage.deleteMany({where});await prisma.officeThread.deleteMany({where});await prisma.officeTask.deleteMany({where});await prisma.officeCategory.deleteMany({where});
  const sessions=await prisma.workSession.count({where:{worker:{companyProfileId:companyId}}});
  await login(context,'office-e2e-megi');await page.setViewportSize({width:1440,height:1000});
  await page.goto('/workzone/offices/me/tasks');const work=page.getByTestId('office-work');await expect(work).toBeVisible();
  await work.getByText('Kategoritë e punës',{exact:true}).click();await work.getByRole('button',{name:'Vendos kategoritë fillestare'}).click();await expect(work.getByRole('status')).toHaveText('U ruajt.',{timeout:30_000});
  await work.getByRole('button',{name:'Shto',exact:true}).click();await work.getByLabel('Titulli',{exact:true}).fill('Kontrollo ofertën · DEMO');await work.getByLabel('Përshkrimi').fill('Shënim personal për provën lokale.');await work.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(work.getByRole('button',{name:/^Kontrollo ofertën · DEMO/})).toBeVisible();
  await work.getByRole('button',{name:'Shto',exact:true}).click();await work.getByLabel('Titulli',{exact:true}).fill('Dosja e ofertës · DEMO');await work.getByLabel('Lloji').selectOption('NOTE');await work.getByRole('button',{name:'Ruaj',exact:true}).click();await work.getByRole('button',{name:/^Dosja e ofertës/}).click();await work.getByLabel('Lloji').selectOption('COMPANY');await work.getByRole('combobox',{name:'Kategoria',exact:true}).selectOption({label:'Modelim · Për oferta'});await work.getByLabel('Përgjegjësi').selectOption('office-e2e-almet');await expect(work.getByRole('button',{name:'Ruaj',exact:true})).toBeDisabled();await work.getByRole('checkbox').check();await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/task-sharing-light-390.png`});await work.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(work.getByRole('button',{name:/^Dosja e ofertës/})).toBeVisible();
  for(const theme of ['light','dark']){
    await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);
    for(const[width,height]of[[1440,1000],[390,844],[320,740],[760,360]]){
      await page.setViewportSize({width,height});await page.reload();await expect(work).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      expect(await work.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
      await page.screenshot({path:`${output}/tasks-${theme}-${width}.png`});
    }
  }
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.documentElement.style.zoom='2';});expect(await work.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await work.getByRole('link',{name:'Zyra ime',exact:true}).focus();await expect(work.getByRole('link',{name:'Zyra ime',exact:true})).toBeFocused();await page.screenshot({path:`${output}/tasks-dark-zoom.png`});await page.evaluate(()=>{document.documentElement.style.zoom='';});
  await page.setViewportSize({width:390,height:844});await work.getByRole('link',{name:'Plani ditor'}).click();await expect(page.getByTestId('plan-close')).toHaveAttribute('href','/workzone/offices/me');
  await page.getByTestId('plan-header').getByRole('link',{name:'Dita tjetër'}).click();await expect(page).toHaveURL(/office=desk/);await page.getByTestId('plan-close').click();await expect(page.getByTestId('office-space')).toBeVisible();
  await page.goto('/app/baustellen?office=desk');await expect(page.getByTestId('office-return').getByRole('link',{name:'Zyra ime'})).toBeVisible();await page.getByTestId('office-return').getByRole('link',{name:'Zyra ime'}).click();await expect(page).toHaveURL(/offices\/me$/);
  await page.goto('/workzone/offices/me/mail');await work.getByRole('button',{name:'Shkruaj'}).click();await work.getByLabel('Subjekti').fill('Ofertë për shqyrtim · DEMO');await work.getByLabel('Mesazhi',{exact:true}).fill('Përshëndetje, dokumenti është bashkëngjitur.');await work.locator('input[type=file]').setInputFiles({name:'Oferte-DEMO.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSynthetic only\n%%EOF')});await work.getByRole('button',{name:'Dërgo',exact:true}).click();await expect(work.getByRole('heading',{name:'Ofertë për shqyrtim · DEMO'})).toBeVisible();
  const file=work.getByRole('link',{name:/Oferte-DEMO.pdf/});const fileHref=await file.getAttribute('href');expect(fileHref).toBeTruthy();expect((await context.request.get(fileHref!)).status()).toBe(200);
  await expect(work).toHaveAttribute('aria-busy','false');await page.screenshot({path:`${output}/mail-dark-390.png`});
  await login(context,'office-e2e-almet');await page.goto('/workzone/offices/me/tasks');await expect(work.getByRole('button',{name:/Kontrollo ofertën/})).toHaveCount(0);
  await page.goto('/workzone/offices/me/mail');await work.getByRole('button',{name:/Ofertë për shqyrtim/}).click();await work.getByLabel('Përgjigju').fill('E lexova. Faleminderit.');await work.getByRole('button',{name:'Dërgo',exact:true}).click();await expect(work.getByText('E lexova. Faleminderit.',{exact:true})).toBeVisible();
  await context.addCookies([{name:'bk_theme',value:'light',url:baseURL}]);await page.reload();await work.getByRole('button',{name:/Ofertë për shqyrtim/}).click();await expect(work.getByRole('heading',{name:'Ofertë për shqyrtim · DEMO'})).toBeVisible();await expect(work).toHaveAttribute('aria-busy','false');await page.screenshot({path:`${output}/mail-light-390.png`});
  await login(context,'office-e2e-other');expect((await context.request.get(fileHref!)).status()).toBe(404);await page.goto('/workzone/offices/me/tasks');await expect(page.getByTestId('office-work')).toHaveCount(0);
  expect(await prisma.workSession.count({where:{worker:{companyProfileId:companyId}}})).toBe(sessions);expect(errors).toEqual([]);
});
