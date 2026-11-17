import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { ensureSteelWorkCatalog } from '../../src/lib/steel-work/catalog';
import { elementProcessCopy } from '../../src/components/steel/work-catalog-copy';

test('production shortcut and calculated elements keep actual attribution and compact crystal flows', async ({ page, context }, info) => {
  test.setTimeout(180000); assertE2ETestDatabase(process.env);
  const base=String(info.project.use.baseURL);
  const company=await prisma.companyProfile.create({data:{displayName:'Shortcuts DEMO',legalName:'Synthetic shortcuts only',mode:'bau',country:'AL'}});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  try {
    const admin=await prisma.user.create({data:{companyProfileId:company.id,email:`shortcuts-${company.id}@example.test`,name:'Planner DEMO',role:'ADMIN',isActive:true}});
    const site=await prisma.baustelle.create({data:{companyProfileId:company.id,name:'Shortcut site DEMO',type:'STEEL_ASSEMBLY'}});
    await ensureSteelWorkCatalog(company.id);
    const first=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Ardi',lastName:'DEMO',crewRole:'FACTORY_WORKER'}});
    const second=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Besa',lastName:'DEMO',crewRole:'FACTORY_WORKER'}});
    const part=await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:site.id,list:'part',mark:'p/1',quantity:10,weightKg:2}});
    const assembly=await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:site.id,list:'assembly',mark:'B/1',quantity:3,weightKg:12,processRevision:1,processRoutes:{v:1,factory:['welding','coating'],field:['mounted']},assemblyParts:{v:1,parts:[{mark:'p/1',quantity:2}]}}});
    const old=await prisma.siteElementWork.create({data:{companyProfileId:company.id,elementId:assembly.id,stage:'welding',pieces:2,workerIds:[first.id],workerNames:'Ardi DEMO',checkedByName:'Old DEMO'}});
    await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
    for(const theme of ['light','dark'])for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:width===1440?950:844}); await context.addCookies([{name:'bk_theme',value:theme,url:base}]);
      await page.goto(`/workzone/baustellen/${site.id}`); await page.locator('[data-studio-list-open]').first().click();
      const list=page.getByRole('dialog').last();await expect(list.getByText('B/1',{exact:true}).first()).toBeVisible();
      await list.getByRole('button').filter({has:page.getByText('B/1',{exact:true})}).click();
      await list.getByRole('button',{name:'Përfundo prodhimin',exact:true}).click();
      const modal=page.getByRole('dialog',{name:'B/1 · Përfundo prodhimin',exact:true});await expect(modal.getByText('Punonjësit për proceset e pambaruara')).toBeVisible();
      expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await modal.getByRole('checkbox',{name:'Ardi DEMO',exact:true}).check();
      await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/completion-${theme}-${width}.png`});
      await modal.getByRole('button',{name:'Anulo',exact:true}).click();
    }
    const list=page.getByRole('dialog').last();
    await list.getByRole('button',{name:'Përfundo prodhimin',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'B/1 · Përfundo prodhimin',exact:true});
    await modal.getByRole('checkbox',{name:'Ardi DEMO',exact:true}).check();
    const coating=modal.locator('li').filter({hasText:'Lyerje'});await coating.locator('summary').click();
    await coating.getByRole('checkbox',{name:'Ardi DEMO',exact:true}).uncheck();
    await coating.getByRole('checkbox',{name:'Besa DEMO',exact:true}).check();
    await modal.getByRole('button',{name:'Konfirmo prodhimin',exact:true}).click();
    await expect(modal).not.toBeVisible();
    await expect.poll(()=>prisma.siteElementWork.count({where:{elementId:assembly.id}})).toBe(3);
    expect(await prisma.siteElementWork.findUnique({where:{id:old.id}})).toEqual(old);
    expect((await prisma.siteElementWork.findFirstOrThrow({where:{elementId:assembly.id,stage:'coating'}})).workerIds).toEqual([second.id]);
    await list.getByRole('button',{name:'Kthehu te lista',exact:true}).click();
    await list.getByTestId('material-groups').getByRole('button',{name:/Elementet/}).click();
    await expect(list.getByTestId('remainder-summary')).toContainText('p/1 × 4');
    await list.getByRole('button',{name:'Përditëso Elementet',exact:true}).click();
    await expect.poll(()=>prisma.siteElement.count({where:{remainderOfId:part.id}})).toBe(1);
    await expect(list.getByText('p/1',{exact:true}).first()).toBeVisible();
    await list.getByRole('button').filter({has:page.getByText('p/1',{exact:true})}).click();
    await list.getByRole('button',{name:'Proceset',exact:true}).click();
    const editor=page.getByRole('dialog',{name:elementProcessCopy('sq').title,exact:true});
    await expect(editor.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    await editor.getByRole('checkbox').first().check();
    await editor.getByRole('button',{name:elementProcessCopy('sq').apply,exact:true}).click();
    const derived=await prisma.siteElement.findUniqueOrThrow({where:{remainderOfId:part.id}});
    expect(derived.quantity).toBe(4);expect(derived.processRevision).toBe(2);expect(derived.factoryDoneAt).toBeNull();
    expect((await prisma.siteElement.findUniqueOrThrow({where:{id:part.id}})).quantity).toBe(10);
    expect(errors).toEqual([]);
  }finally{await context.close();await prisma.user.deleteMany({where:{companyProfileId:company.id}});await prisma.companyProfile.delete({where:{id:company.id}});}
});
