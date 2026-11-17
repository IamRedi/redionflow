import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { ensureSteelWorkCatalog } from '../../src/lib/steel-work/catalog';

test('manufacturing becomes ready for loading without a load; only the loading card records shipment', async ({ page, context }, info) => {
  test.setTimeout(180000); assertE2ETestDatabase(process.env);
  const base=String(info.project.use.baseURL), errors:string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await context.route('**/*', r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
  const company=await prisma.companyProfile.create({data:{displayName:'Loading DEMO',legalName:'Synthetic loading only',mode:'bau',country:'AL'}});
  try {
    const admin=await prisma.user.create({data:{companyProfileId:company.id,email:`loading-${company.id}@example.test`,name:'Planner DEMO',role:'ADMIN',isActive:true}});
    const site=await prisma.baustelle.create({data:{companyProfileId:company.id,name:'Loading site DEMO',type:'STEEL_ASSEMBLY'}});
    const worker=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Ardi',lastName:'DEMO',crewRole:'FACTORY_WORKER'}});
    await ensureSteelWorkCatalog(company.id);
    const element=await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:site.id,list:'assembly',mark:'B/LOAD',quantity:3,processRevision:1,processRoutes:{v:1,factory:['coating','loading'],field:['mounted']}}});
    const original=await prisma.siteElementWork.create({data:{companyProfileId:company.id,elementId:element.id,stage:'coating',pieces:1,workerIds:[worker.id],workerNames:'Original DEMO',checkedByName:'Original DEMO'}});
    await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
    for(const theme of ['light','dark'])for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:width===1440?950:844}); await context.addCookies([{name:'bk_theme',value:theme,url:base}]);
      await page.goto(`/workzone/baustellen/${site.id}`);
      await expect(async()=>{if(!await page.getByRole('dialog').count())await page.locator('[data-studio-list-open]').first().click();await expect(page.getByRole('dialog').last()).toBeVisible();}).toPass();
      const list=page.getByRole('dialog').last();
      await list.getByRole('button').filter({has:page.getByText('B/LOAD',{exact:true})}).click();
      await list.getByRole('button',{name:'Përfundo prodhimin',exact:true}).click();
      const modal=page.getByRole('dialog',{name:'B/LOAD · Përfundo prodhimin',exact:true});
      await expect(modal.locator('li')).toHaveCount(1);
      await expect(modal.locator('li')).toContainText('Lyerje');
      await expect(modal.locator('li')).not.toContainText('Ngarkim');
      expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
      await modal.getByRole('checkbox',{name:'Ardi DEMO',exact:true}).check();
      await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/loading-separate-${theme}-${width}.png`});
      await modal.getByRole('button',{name:'Anulo',exact:true}).click();
    }
    const list=page.getByRole('dialog').last();
    await list.getByRole('button',{name:'Përfundo prodhimin',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'B/LOAD · Përfundo prodhimin',exact:true});
    await modal.getByRole('checkbox',{name:'Ardi DEMO',exact:true}).check();
    await modal.getByRole('button',{name:'Konfirmo prodhimin',exact:true}).click();
    await expect(modal).not.toBeVisible();
    await expect(list.getByTestId('production-delivery')).toContainText('Gati për ngarkim 3');
    await expect(list.getByTestId('production-delivery')).toContainText('Ngarkuar 0/3');
    await expect(list.getByRole('button',{name:'Përfundo prodhimin',exact:true})).toHaveCount(0);
    expect(await prisma.siteElementWork.findUnique({where:{id:original.id}})).toEqual(original);
    expect(await prisma.siteElementWork.count({where:{elementId:element.id,stage:'loading'}})).toBe(0);
    expect((await prisma.siteElement.findUniqueOrThrow({where:{id:element.id}})).factoryDoneAt).toBeNull();
    await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/loading-ready-dark-320.png`});
    await list.getByTestId('element-process-card').filter({hasText:'Ngarkim'}).click();
    await list.locator('[data-worker]').filter({hasText:'Ardi DEMO'}).click();
    await list.getByRole('button',{name:/Ngarkim.*3|3.*Ngarkim/}).click();
    await expect(list.getByTestId('production-delivery')).toContainText('Ngarkuar 3/3');
    await expect(list.getByTestId('production-delivery')).toContainText('Gati për ngarkim 0');
    const loads=await prisma.siteElementWork.findMany({where:{elementId:element.id,stage:'loading'}});
    expect(loads).toHaveLength(1); expect(loads[0].pieces).toBe(3); expect(loads[0].checkedByUserId).toBe(admin.id);
    expect(await prisma.siteElementWork.findUnique({where:{id:original.id}})).toEqual(original);
    expect(errors).toEqual([]);
  }finally{await context.close();await prisma.user.deleteMany({where:{companyProfileId:company.id}});await prisma.companyProfile.delete({where:{id:company.id}});}
});
