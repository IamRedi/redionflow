import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {seedSteelAssetsWorkshop,cleanupSteelAssetsWorkshop} from '../fixtures/steel-assets-workshop';
import {assertE2ETestDatabase,validateE2ETarget} from '../../scripts/lib/e2e-target';
import {assetCopy} from '../../src/components/company-assets/copy';

const c=assetCopy('sq');
const baseline=process.env.WAREHOUSE_BASELINE==='true';
async function localOnly(context:BrowserContext,origin:string){
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
  await context.addCookies([{name:'bk_lang',value:'sq',url:origin}]);
}
async function fit(page:Page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const dialog of await page.getByRole('dialog').all())expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
}
test('warehouse registration is granted by admin, usable by an engineer and revoked without promoting their role',async({page,context,browser,baseURL})=>{
  test.setTimeout(240000);assertE2ETestDatabase(process.env);
  const origin=validateE2ETarget(baseURL!).baseURL;await localOnly(context,origin);
  let companyId:string|undefined,employee:BrowserContext|undefined;
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const email=`warehouse-${Date.now()}@example.test`;await page.goto('/signup?mode=bau');
    for(const [name,value]of Object.entries({displayName:'Synthetic Assets · DEMO',fullName:'Synthetic Administrator',email,password:'Synthetic-Warehouse-2026!'}))await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
    const seed=await seedSteelAssetsWorkshop(companyId,`registration-${Date.now()}`);
    await prisma.worker.update({where:{id:seed.worker.id},data:{crewRole:'FIELD_ENGINEER'}});
    const capture=async(name:string)=>{await fit(page);if(process.env.WAREHOUSE_EVIDENCE_DIR)await page.screenshot({path:`${process.env.WAREHOUSE_EVIDENCE_DIR}/${baseline?'before':'after'}-${name}.png`});};
    for(const theme of ['light','dark'])for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:640},{width:844,height:390}]){
      await context.addCookies([{name:'bk_theme',value:theme,url:origin}]);await page.setViewportSize(viewport);
      await page.goto('/app/inventory');await expect(page.getByTestId('asset-warehouse')).toBeVisible();
      await capture(`warehouse-${theme}-${viewport.width}`);
      await page.getByTestId('access-key-warehouse').click();await expect(page.getByTestId('access-sheet')).toBeVisible();
      await capture(`key-${theme}-${viewport.width}`);
      await page.keyboard.press('Escape');await expect(page.getByTestId('access-key-warehouse')).toBeFocused();
    }
    if(baseline)return;
    await page.setViewportSize({width:390,height:844});await page.goto('/app/inventory');await page.getByTestId('access-key-warehouse').click();
    const row=page.getByTestId('access-sheet').getByRole('listitem').filter({hasText:seed.worker.firstName});
    await row.getByTestId('access-set-register').click();await expect(row.getByTestId('access-set-register')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('access-key-warehouse')).toContainText('1');
    await capture('granted-key-390');await page.keyboard.press('Escape');
    for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:640}]){
      await page.setViewportSize(viewport);await page.goto(`/workzone/admin-workers/${seed.worker.id}`);
      await page.getByTestId('worker-access-open').click();
      await expect(page.getByTestId('worker-access-warehouse-register')).toHaveAttribute('aria-pressed','true');
      await capture(`profile-${viewport.width}`);await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:780,height:640});await page.goto('/app/inventory');await page.getByTestId('access-key-warehouse').click();
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');await capture('key-text-zoom');
    await page.evaluate(()=>document.documentElement.style.fontSize='');await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});
    employee=await browser.newContext({viewport:{width:390,height:844}});await localOnly(employee,origin);
    const ep=await employee.newPage();ep.on('pageerror',e=>errors.push(e.message));
    await ep.goto('/workzone/login');await ep.locator('input[name=name]').fill(seed.worker.firstName);await ep.locator('input[name=loginCode]').fill(seed.workerCode);await ep.locator('button[type=submit]').click();await expect(ep).toHaveURL(/\/workzone\/profile$/);
    await ep.getByRole('link',{name:c.addAsset,exact:true}).click();await expect(ep).toHaveURL(/\/workzone\/inventory\?register=1$/);
    await expect(ep.getByTestId('access-key-warehouse')).toHaveCount(0);
    await ep.getByLabel(c.name,{exact:true}).fill('Synthetic registered drill');
    const form=ep.locator('form').filter({has:ep.getByLabel(c.quantity,{exact:true})});await form.getByRole('button',{name:c.add,exact:true}).click();
    await expect(ep.getByRole('button',{name:/Synthetic registered drill/})).toBeVisible();
    await expect(ep.getByRole('link',{name:c.printLabels,exact:true})).toBeVisible();
    const labels=await ep.getByRole('link',{name:c.printLabels,exact:true}).getAttribute('href');expect((await employee.request.get(labels!)).status()).toBe(200);
    expect((await employee.request.get(`/workzone/asset-labels?items=inventory:${seed.tool.id}`)).status()).toBe(404);
    await ep.getByRole('button',{name:/Synthetic registered drill/}).click();await expect(ep.getByTestId('asset-detail')).toBeVisible();
    await expect(ep.getByTestId('asset-detail').getByRole('button',{name:c.edit,exact:true})).toHaveCount(0);
    await fit(ep);if(process.env.WAREHOUSE_EVIDENCE_DIR)await ep.screenshot({path:`${process.env.WAREHOUSE_EVIDENCE_DIR}/after-employee-detail-390.png`});
    await page.getByTestId('access-key-warehouse').click();await row.getByTestId('access-set-view').click();await expect(row.getByTestId('access-set-view')).toHaveAttribute('aria-pressed','true');
    await ep.goto('/workzone/inventory');await expect(ep.getByRole('button',{name:c.addAsset,exact:true})).toHaveCount(0);
    await row.getByTestId('access-set-none').click();await expect(row.getByTestId('access-set-none')).toHaveAttribute('aria-pressed','true');
    await ep.reload();await expect(ep.getByText('Nuk ke akses këtu. Aksesin ta jep shefi.')).toBeVisible();
    expect((await prisma.worker.findUniqueOrThrow({where:{id:seed.worker.id}})).crewRole).toBe('FIELD_ENGINEER');
    expect(errors).toEqual([]);
  }finally{await employee?.close();if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});
