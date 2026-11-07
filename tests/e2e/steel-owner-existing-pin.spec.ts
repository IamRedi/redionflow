import {test,expect,type BrowserContext} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {seedSteelAssetsWorkshop,cleanupSteelAssetsWorkshop} from '../fixtures/steel-assets-workshop';
import {assertE2ETestDatabase,validateE2ETarget} from '../../scripts/lib/e2e-target';
test('the explicitly converted owner keeps their existing code and receives full admin access; ordinary workers do not',async({page,context,browser,baseURL})=>{
 test.setTimeout(90000);assertE2ETestDatabase(process.env);const origin=validateE2ETarget(baseURL!).baseURL;
 const localOnly=async(c:BrowserContext)=>{await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));await c.addCookies([{name:'bk_lang',value:'sq',url:origin}]);};
 await localOnly(context);let companyId:string|undefined,ownerContext:BrowserContext|undefined,workerContext:BrowserContext|undefined;
 try{
  const email=`owner-fix-${Date.now()}@example.test`;await page.goto('/signup?mode=bau');
  for(const [name,value]of Object.entries({displayName:'Synthetic owner conversion',fullName:'Original Administrator',email,password:'Synthetic-Owner-Only-2026!'}))await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('button[type=submit]').click();await expect(page).toHaveURL(/\/app\/dashboard$/);companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
  const seed=await seedSteelAssetsWorkshop(companyId,`owner-fix-${Date.now()}`);
  const worker=await prisma.worker.update({where:{id:seed.worker.id},data:{firstName:'Converted',lastName:'Owner',crewRole:'OFFICE'}});
  const owner=await prisma.user.create({data:{companyProfileId:companyId,name:'Converted Owner',email:`converted-${Date.now()}@example.test`,role:'ADMIN',isOwner:true,isActive:false}});
  ownerContext=await browser.newContext();await localOnly(ownerContext);const op=await ownerContext.newPage();
  await op.goto('/workzone/login');await op.locator('input[name=name]').fill('Converted');await op.locator('input[name=loginCode]').fill(seed.workerCode);await op.locator('button[type=submit]').click();await expect(op).toHaveURL(/\/workzone\/profile$/);
  await prisma.$transaction(async tx=>{await tx.user.update({where:{id:owner.id},data:{isActive:true,loginPinHash:worker.loginCodeHash}});await tx.worker.update({where:{id:worker.id},data:{loginCodeHash:null,loginCode:null}});});
  expect((await prisma.worker.findUniqueOrThrow({where:{id:worker.id}})).sessionEpoch).toBeGreaterThan(worker.sessionEpoch);
  await op.goto('/workzone/profile');await expect(op).toHaveURL(/\/workzone\/login/);
  await op.locator('input[name=name]').fill('Converted');await op.locator('input[name=loginCode]').fill(seed.workerCode);await op.locator('button[type=submit]').click();await expect(op).toHaveURL(/\/app\/dashboard$/);await expect(op.getByTestId('steel-dashboard')).toBeVisible();
  const cookies=await ownerContext.cookies();expect(cookies.some(c=>c.name==='bk_admin_id')).toBe(true);expect(cookies.some(c=>c.name==='bk_worker_id')).toBe(false);
  await op.goto('/app/profile');await expect(op.getByTestId('owner-pin-form')).toBeVisible();
  await op.goto(`/workzone/baustellen/${seed.site.id}`);await expect(op.getByTestId('site-document-access-open')).toBeVisible();
  workerContext=await browser.newContext();await localOnly(workerContext);const wp=await workerContext.newPage();await wp.goto('/workzone/login');await wp.locator('input[name=name]').fill(seed.mechanic.firstName);await wp.locator('input[name=loginCode]').fill(seed.mechanicCode);await wp.locator('button[type=submit]').click();await expect(wp).toHaveURL(/\/workzone\/profile$/);
  expect((await workerContext.cookies()).some(c=>c.name==='bk_admin_id')).toBe(false);await wp.goto(`/workzone/baustellen/${seed.site.id}`);await expect(wp.getByTestId('site-document-access-open')).toHaveCount(0);
 }finally{await ownerContext?.close();await workerContext?.close();if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});
