import { expect, test, type BrowserContext } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { hashPassword } from '../../src/lib/auth/password';
import { createSessionCookie } from '../../src/lib/auth/session-cookie';
import { assertE2ETestDatabase } from '../../scripts/lib/e2e-target';

const companyId = 'office-e2e-company';
const baseURL = 'http://127.0.0.1:3230';
test.use({ actionTimeout: 30_000 });
async function login(context: BrowserContext, id: string, kind: 'admin' | 'worker' = 'admin') {
  // Database security triggers can advance epochs when a repeated fixture is reactivated.
  const account = kind === 'admin'
    ? await prisma.user.findUniqueOrThrow({ where: { id }, select: { sessionEpoch: true } })
    : await prisma.worker.findUniqueOrThrow({ where: { id }, select: { sessionEpoch: true } });
  await context.clearCookies();
  await context.addCookies([
    { name: kind === 'admin' ? 'bk_admin_id' : 'bk_worker_id', value: await createSessionCookie(kind, id, account.sessionEpoch), url: baseURL },
    { name: 'bk_lang', value: 'sq', url: baseURL },
  ]);
}
async function denied(context: BrowserContext, path = '/workzone/offices') {
  const response = await context.request.get(path);
  expect(response.status()).toBeLessThan(500);
  const html = await response.text();
  expect(html).not.toContain('data-testid="office-space"');
  expect(html).toContain('Faqja nuk u gjet');
}
test('office reception, private visit, access and responsive shell', async ({ page, context }) => {
  assertE2ETestDatabase(process.env);
  expect(process.env.VIRTUAL_OFFICE_ACCESS_JSON).toContain(companyId);
  test.setTimeout(300_000);
  const baseline = process.env.OFFICE_BASELINE === 'true';
  const output = process.env.OFFICE_EVIDENCE_DIR!;
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  // Idempotent synthetic fixture, confined to the managed local test database.
  await prisma.companyProfile.upsert({ where:{ id:companyId }, update:{}, create:{ id:companyId, displayName:'Mira Steel · DEMO', legalName:'Mira Demo', mode:'bau', country:'AL' } });
  await prisma.companyProfile.upsert({ where:{ id:'office-e2e-other-company' }, update:{}, create:{ id:'office-e2e-other-company', displayName:'Other DEMO', legalName:'Other DEMO', mode:'bau' } });
  for (const [id,name,company] of [['office-e2e-megi','Megi Demo',companyId],['office-e2e-almet','Almet Demo',companyId],['office-e2e-other','Other Admin',companyId],['office-e2e-foreign','Megi Demo','office-e2e-other-company']]) {
    await prisma.user.upsert({ where:{id}, update:{ isActive:true,sessionEpoch:0,companyProfileId:company }, create:{ id, name, email:`${id}@example.test`, companyProfileId:company, role:'ADMIN', isActive:true, passwordHash:hashPassword('synthetic-only-unused-password') } });
  }
  await prisma.worker.upsert({ where:{id:'office-e2e-worker-megi'}, update:{status:'active'}, create:{id:'office-e2e-worker-megi',companyProfileId:companyId,firstName:'Megi',lastName:'Demo'} });
  await prisma.baustelle.upsert({where:{id:'office-e2e-factory'},update:{},create:{id:'office-e2e-factory',companyProfileId:companyId,name:'Factory DEMO',type:'STEEL_WORKSHOP'} });
  const sessionCount = await prisma.workSession.count({ where:{worker:{companyProfileId:companyId}} });
  await prisma.user.update({where:{id:'office-e2e-other'},data:{isOwner:true}});
  await login(context,'office-e2e-megi');
  for (const theme of ['light','dark']) {
    await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);
    for (const [width,height] of [[1440,1000],[390,844],[320,740],[760,360]]) {
      await page.setViewportSize({width,height});
      if (baseline) {
        await page.goto('/workzone');
        await expect(page.getByTestId('app-workspace-scroll')).toBeVisible();
        await expect(page.getByTestId('office-entry')).toHaveCount(0);
        await page.screenshot({path:`${output}/before-${theme}-${width}.png`});
        continue;
      }
      await page.goto('/workzone/offices');
      await expect(page.getByRole('heading',{name:'Mirë se erdhët në zyrë.'})).toBeVisible({timeout:30_000});
      await expect(page.getByTestId('fleet-dock-open')).toBeVisible({timeout:30_000});
      await page.screenshot({path:`${output}/reception-${theme}-${width}.png`});
      await page.getByTestId('office-door').click();
      await expect(page.getByRole('heading',{name:'Zyra e Megit'})).toBeVisible({timeout:30_000});
      await page.screenshot({path:`${output}/desk-${theme}-${width}.png`});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const scroller = page.getByTestId('app-workspace-scroll');
      await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});
      await expect(page.getByRole('link',{name:'by RediON',exact:true})).toBeVisible();
      const profile = page.getByTestId('office-space').getByRole('link',{name:'Profili im',exact:true});
      await expect(profile).toBeVisible();
      await profile.focus();
      await expect(profile).toBeFocused();
    }
  }
  if (baseline) { expect(errors).toEqual([]); return; }
  await page.setViewportSize({width:390,height:844});
  await page.goto('/workzone');
  await page.getByTestId('office-entry').click();
  await expect(page.getByTestId('office-door')).toBeVisible();
  await page.goto('/app/dashboard');
  await expect(page.getByTestId('office-entry')).toBeVisible();
  // Almet can enter reception, but sees no Megi desktop links/private payload.
  await login(context,'office-e2e-almet');
  await page.goto('/workzone/offices/megi');
  await expect(page.getByText(/Puna dhe shënimet personale/)).toBeVisible();
  await expect(page.getByTestId('office-space').getByRole('link',{name:'Profili im',exact:true})).toHaveCount(0);
  await page.screenshot({path:`${output}/visitor-mobile.png`});
  // Every direct route is guarded, including other administrators/owners and tenant.
  for (const id of ['office-e2e-other','office-e2e-foreign']) {
    await login(context,id);
    for (const path of ['/workzone/offices','/workzone/offices/megi']) {
      await denied(context,path);
    }
  }
  await login(context,'office-e2e-worker-megi','worker');
  await page.goto('/workzone/offices/megi');
  await expect(page.getByTestId('office-space')).toBeVisible();
  await expect(page.getByTestId('office-space').locator('a[href="/app/dashboard"]')).toHaveCount(0);
  // Mixed roles fail closed.
  const megi = await prisma.user.findUniqueOrThrow({where:{id:'office-e2e-megi'},select:{sessionEpoch:true}});
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin','office-e2e-megi',megi.sessionEpoch),url:baseURL}]);
  await denied(context);
  await login(context,'office-e2e-megi');
  await prisma.user.update({where:{id:'office-e2e-megi'},data:{sessionEpoch:{increment:1}}});
  await denied(context);
  await login(context,'office-e2e-megi');
  await prisma.user.update({where:{id:'office-e2e-megi'},data:{isActive:false}});
  await denied(context);
  await prisma.user.update({where:{id:'office-e2e-megi'},data:{isActive:true}});
  await context.clearCookies();
  await context.addCookies([{name:'bk_lang',value:'sq',url:baseURL}]);
  await denied(context);
  expect(await prisma.workSession.count({where:{worker:{companyProfileId:companyId}}})).toBe(sessionCount);
  expect(errors).toEqual([]);
});
