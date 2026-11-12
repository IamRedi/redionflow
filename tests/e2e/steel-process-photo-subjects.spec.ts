import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';
import { seedSteelWorkCatalog } from '../fixtures/steel-work-catalog';
import { workCatalogCopy } from '../../src/components/steel/work-catalog-copy';

type Example = { label: string; group: 'production' | 'assembly'; file?: string; panel?: number; linked?: string };
const examples: Example[] = [
  { label:'Prerje',group:'production',file:'cutting' },
  { label:'Asambim',group:'production',panel:1,linked:'assembly' },
  { label:'Saldim',group:'production',panel:2,linked:'assembly' },
  { label:'Pastrim',group:'production',panel:3 },
  { label:'Lyerje',group:'production',panel:4 },
  { label:'Ngarkim',group:'production',panel:5 },
  { label:'Gati per ngarkese',group:'production',file:'staging' },
  { label:'Vendosja e piolave',group:'production',file:'stud-welding' },
  { label:'Bazamenti',group:'assembly',file:'foundation' },
  { label:'Bazamenti dhe bulona ankerimit',group:'assembly',file:'foundation-anchors' },
  { label:'Montimi i kolonave',group:'assembly',file:'columns' },
  { label:'Montimi i kapriatave',group:'assembly',file:'trusses' },
  { label:'Montim paneli mbulese',group:'assembly',file:'roof-panels' },
  { label:'Montim panel veshje',group:'assembly',file:'wall-panels' },
  { label:'Montim borde',group:'assembly',file:'roof-trim' },
  { label:'Montim shkalle',group:'assembly',file:'stairs' },
  { label:'Plotesim me vida paneli',group:'assembly',file:'panel-screws' },
  { label:'Shpimi',group:'assembly',file:'drilling' },
  { label:'Shtrëngim bulonash',group:'assembly',file:'bolting' },
  { label:'Pranim',group:'assembly',file:'receiving' },
];

test('task photos describe the operation consistently across sites, cards and catalog without replacing stored originals', async ({ page, context }, info) => {
  assertE2ETestDatabase(process.env);
  expect(Boolean(process.env.OPENAI_API_KEY?.trim())).toBe(false);
  const email=`subject-${Date.now()}@example.test`, c=workCatalogCopy('sq');
  let companyId: string | undefined;
  try {
    await context.addCookies([{name:'bk_lang',value:'sq',url:info.project.use.baseURL!},{name:'bk_theme',value:'light',url:info.project.use.baseURL!}]);
    await page.goto('/signup?mode=bau');
    await page.locator('[name=displayName]').fill('Aurora Steel · DEMO');
    await page.locator('[name=fullName]').fill('Admin Demo');
    await page.locator('[name=email]').fill(email);
    await page.locator('[name=password]').fill('Synthetic-Subjects-123!');
    await page.locator('button[type=submit]').click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
    const seed=await seedSteelWorkCatalog(companyId), sites=[seed.sites.aurora.id,seed.sites.vega.id];
    const original=await sharp({create:{width:32,height:24,channels:3,background:'#a45020'}}).webp().toBuffer();
    const rows=[];
    for(const [index,example] of examples.entries()) {
      const row=await prisma.steelWorkDefinition.create({data:{companyProfileId:companyId,key:`steel-task-subject-fixture-${index}`,kind:'site',label:example.label,phaseGroup:example.group,linkedProcessKey:example.linked??null,visualStatus:example.label==='Saldim'?'error':'generated',visualUpdatedAt:new Date()}});
      await prisma.steelWorkVisual.create({data:{companyProfileId:companyId,definitionId:row.id,mime:'image/webp',data:original}});
      rows.push(row);
      for(const siteId of sites) {
        const item=await prisma.treeItem.create({data:{baustelleId:siteId,treeId:row.key,species:'task',diameter:0,status:'todo',notes:JSON.stringify({label:row.label})}});
        await prisma.steelSiteTask.create({data:{companyProfileId:companyId,baustelleId:siteId,definitionId:row.id,treeItemId:item.id,enabled:true,position:20+index}});
      }
    }
    for(const [index,example] of examples.entries()) {
      const response=await context.request.get(`/api/steel-work-visuals/${rows[index].id}`);
      expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('private, no-store');
      const expected=example.file?readFileSync(`public/steel-process-photos-v1/${example.file}.webp`):await sharp(readFileSync('public/steel-studio-v1/processes.webp')).extract({left:example.panel!%3*400,top:Math.floor(example.panel!/3)*400,width:400,height:400}).webp({quality:80}).toBuffer();
      expect((await response.body()).equals(expected),example.label).toBe(true);
    }
    // Originals and explicit current-style AI generations always win over defaults.
    for(const status of ['photo','generated']) {
      const row=await prisma.steelWorkDefinition.create({data:{companyProfileId:companyId,key:`steel-task-subject-preserve-${status}`,kind:'site',label:`Saldim ${status}`,visualStatus:status,visualUpdatedAt:new Date()}});
      await prisma.steelWorkVisual.create({data:{companyProfileId:companyId,definitionId:row.id,mime:'image/webp',data:original,...(status==='generated'?{scene:{style:'alsteel-industrial-photo-v2'}}:{})}});
      expect((await (await context.request.get(`/api/steel-work-visuals/${row.id}`)).body()).equals(original)).toBe(true);
    }
    for(const [siteIndex,width,height,theme] of [[0,1440,1000,'light'],[1,390,844,'dark'],[0,320,740,'light'],[1,760,390,'dark']] as const) {
      await context.addCookies([{name:'bk_theme',value:theme,url:info.project.use.baseURL!}]);
      await page.setViewportSize({width,height});
      await page.goto(`/workzone/baustellen/${sites[siteIndex]}`);
      for(const group of ['production','assembly'] as const) {
        await page.getByTestId(`phase-group-${group}`).click();
        const first=page.locator('[data-studio-phase-card]').filter({has:page.getByText(group==='production'?'Saldim':'Bazamenti dhe bulona ankerimit',{exact:true})});
        await first.scrollIntoViewIfNeeded();
        const image=first.locator('[data-steel-work-visual] img');
        await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).complete&&(el as HTMLImageElement).naturalWidth>0)).toBe(true);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:info.outputPath(`${group}-${siteIndex}-${width}-${theme}.png`),fullPage:false});
        if(group==='production') {
          await page.getByRole('button',{name:'Shto detyrë',exact:true}).click();
          const dialog=page.getByRole('dialog').last();
          await dialog.getByRole('searchbox').fill('Saldim');
          const row=dialog.getByRole('listitem').filter({has:page.getByText('Saldim',{exact:true})});
          await expect(row.getByRole('img')).toHaveAttribute('src',new RegExp(`/api/steel-work-visuals/${rows[2].id}`));
          await dialog.getByRole('button',{name:c.close,exact:true}).click();
        }
        await page.getByRole('button',{name:'Grupet',exact:true}).click();
      }
    }
    for(const row of rows) expect(Buffer.from((await prisma.steelWorkVisual.findUniqueOrThrow({where:{definitionId:row.id}})).data!).equals(original)).toBe(true);
    expect((await prisma.steelWorkDefinition.findUniqueOrThrow({where:{id:rows[2].id}})).linkedProcessKey).toBe('assembly');
    expect(await prisma.auditLog.count({where:{companyProfileId:companyId,action:'steel.visual_generated'}})).toBe(0);
  } finally {
    if(companyId) await prisma.companyProfile.delete({where:{id:companyId}});
  }
});
