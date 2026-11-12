import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';
import { workCatalogCopy } from '../../src/components/steel/work-catalog-copy';

test('legacy work art adopts photography without changing originals, grants or generating on read', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  expect(Boolean(process.env.OPENAI_API_KEY?.trim())).toBe(false);
  const c = workCatalogCopy('sq'), email = `photo-style-${Date.now()}@example.test`;
  let companyId: string | undefined;
  try {
    await context.addCookies([{name:'bk_lang',value:'sq',url:info.project.use.baseURL!}]);
    await page.goto('/signup?mode=bau');
    await page.locator('[name=displayName]').fill('Aurora Steel · DEMO');
    await page.locator('[name=fullName]').fill('Admin Demo');
    await page.locator('[name=email]').fill(email);
    await page.locator('[name=password]').fill('Synthetic-Photo-Style-123!');
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
    const seed=await seedSteelWorkCatalog(companyId);
    const bytes=await sharp({create:{width:32,height:24,channels:3,background:'#215e51'}}).webp().toBuffer();
    const rows=[];
    for(const [index,label] of ['Montim Ulluk ujë mbledhës','Montim Ristelim','Kontrolli i objektit','Foto origjinale demo','Foto AI e re demo','Pastrimi demo'].entries()) {
      const row=await prisma.steelWorkDefinition.create({data:{companyProfileId:companyId,key:`steel-task-photo-fixture-${index}`,kind:'site',label,...(index===5?{linkedProcessKey:'cleaning'}:{}),visualStatus:index===3?'photo':'generated',visualUpdatedAt:new Date()}});
      await prisma.steelWorkVisual.create({data:{companyProfileId:companyId,definitionId:row.id,mime:index===5?'image/svg+xml':'image/webp',data:bytes,...(index===4?{scene:{style:'alsteel-industrial-photo-v2'}}:{})}});
      rows.push(row);
    }
    const grantCount=await prisma.accessGrant.count({where:{companyProfileId:companyId}});
    await page.goto(`/workzone/baustellen/${seed.sites.aurora.id}`);
    const dialog=page.getByRole('dialog').last();
    for(const [index,row] of rows.entries()) {
      const response=await context.request.get(`/api/steel-work-visuals/${row.id}`);
      expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('private, no-store');
      const body=await response.body();
      if(index<3) expect(body.equals(readFileSync(`public/steel-studio-v1/${['gutter','purlins','inspection'][index]}.webp`))).toBe(true);
      else if(index===5) expect(await sharp(body).metadata()).toMatchObject({format:'webp',width:400,height:400});
      else expect(body.equals(bytes)).toBe(true);
      expect(Buffer.from((await prisma.steelWorkVisual.findUniqueOrThrow({where:{definitionId:row.id}})).data!).equals(bytes)).toBe(true);
    }
    for(const [width,height,theme] of [[1440,900,'light'],[390,844,'light'],[320,640,'dark'],[760,390,'dark']] as const) {
      await page.setViewportSize({width,height});
      await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');},theme);
      await page.getByRole('button',{name:'Shto detyrë',exact:true}).click();
      await dialog.getByRole('searchbox').fill('Montim');
      for(const row of rows.slice(0,2)) {
        const image=dialog.getByRole('listitem').filter({hasText:row.label}).getByRole('img');
        await expect(image).toBeVisible();
        await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
        expect(await image.evaluate(el=>getComputedStyle(el).objectFit)).toBe('cover');
      }
      expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      await dialog.getByRole('button',{name:`${c.edit}: ${rows[0].label}`,exact:true}).focus();
      await page.screenshot({path:info.outputPath(`photos-${width}-${theme}.png`),fullPage:true});
      await dialog.getByRole('button',{name:c.close,exact:true}).click();
    }
    expect(await prisma.accessGrant.count({where:{companyProfileId:companyId}})).toBe(grantCount);
    expect(await prisma.auditLog.count({where:{companyProfileId:companyId,action:'steel.visual_generated'}})).toBe(0);
  } finally {
    if(companyId) await prisma.companyProfile.delete({where:{id:companyId}});
  }
});
