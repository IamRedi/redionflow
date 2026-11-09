import { test, expect } from '@playwright/test';
import { createECDH } from 'node:crypto';
import { prisma } from '../../src/lib/db/prisma';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
const baseline = process.env.STEEL_PLAN_HOURS_BASELINE === 'true';
const evidence = (name: string) => `${process.env.STEEL_PLAN_HOURS_EVIDENCE_DIR ?? test.info().outputDir}/${name}`;
test('steel card counts the visible task and the existing bell enables/tests a device', async ({ page, context, baseURL }) => {
 test.setTimeout(150000); assertE2ETestDatabase(process.env); const origin = validateE2ETarget(baseURL!).baseURL;
 await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
 await context.addCookies([{name:'bk_lang',value:'sq',url:origin}]);
 let companyId: string | undefined;
 try {
  const email=`notification-${Date.now()}@example.test`;
  await page.goto('/signup?mode=bau');
  for (const [name,value] of Object.entries({displayName:'Synthetic flow',fullName:'Synthetic Chief',email,password:'Synthetic-Push-Only-2026!'})) await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
  const admin=await prisma.user.findUniqueOrThrow({where:{email}}); companyId=admin.companyProfileId!;
  const seed=await seedSteelAssetsWorkshop(companyId,`push-${Date.now()}`);
  const def=await prisma.steelWorkDefinition.create({data:{companyProfileId:companyId,key:'steel-task-synthetic-finished',kind:'site',label:'Montim demo'}});
  const task=await prisma.treeItem.create({data:{baustelleId:seed.site.id,treeId:def.key,species:'task',diameter:0,status:'done'}});
  await prisma.steelSiteTask.create({data:{companyProfileId:companyId,baustelleId:seed.site.id,definitionId:def.id,treeItemId:task.id}});
  await prisma.treeItem.create({data:{baustelleId:seed.site.id,treeId:'1',species:'Imported generic',diameter:0,status:'todo'}});
  for (const width of [1440,360]) for (const theme of ['light','dark']) {
   await page.setViewportSize({width,height:900});await context.addCookies([{name:'bk_theme',value:theme,url:origin}]); await page.goto('/workzone');
   if(!baseline) { await expect(page.getByTestId('daily-archive')).toContainText('1/1 (100%)'); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
   await page.getByRole('heading',{name:'Arkiva ditore',exact:true}).scrollIntoViewIfNeeded();
   await page.screenshot({path:evidence(`${baseline?'before':'after'}-progress-${theme}-${width}.png`)});
   if(!baseline) {
    await page.getByTestId('notification-bell').click(); await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button',{name:'Provo për ekipin',exact:true})).toBeVisible();
    await page.screenshot({path:evidence(`after-bell-${theme}-${width}.png`)});
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByTestId('notification-bell')).toBeFocused();
   }
  }
  if(baseline)return;
  const key=createECDH('prime256v1');key.generateKeys();
  const subscription={endpoint:'https://web.push.apple.com/synthetic-browser-test',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')}};
  await page.addInitScript(s=>{
   Object.defineProperty(window,'Notification',{value:{permission:'granted',requestPermission:async()=> 'granted'},configurable:true});
   Object.defineProperty(window,'PushManager',{value:class{},configurable:true});
   const sub={toJSON:()=>s,options:{},unsubscribe:async()=>true};const registration={pushManager:{getSubscription:async()=>sub,subscribe:async()=>sub}};
   Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration},configurable:true});
  },subscription);
  await page.goto('/workzone');await page.getByTestId('notification-bell').click();
  await page.getByRole('button',{name:'Aktivizo njoftimet',exact:true}).click();
  await expect(page.getByTestId('notification-dialog').getByRole('status')).toContainText('Njoftimet jane aktive');
  expect(await prisma.notificationSubscription.count({where:{userId:admin.id}})).toBe(1);
  await page.route('**/api/notifications/test',route=>route.fulfill({json:{ok:true,sent:1,failed:0}}));
  await page.getByRole('button',{name:'Provo në këtë pajisje',exact:true}).click();await expect(page.getByTestId('notification-dialog').getByRole('status')).toContainText('Prova u dërgua');
  await page.keyboard.press('Escape');
  await context.clearCookies();await context.addCookies([{name:'bk_lang',value:'sq',url:origin}]);
  await page.goto('/workzone/login');await page.locator('input[name=name]').fill(`${seed.worker.firstName} ${seed.worker.lastName}`);await page.locator('input[name=loginCode]').fill(seed.workerCode);await page.locator('button[type=submit]').click();await expect(page).toHaveURL(/\/workzone\/profile$/);
  await page.goto('/workzone');await page.getByTestId('notification-bell').click();await expect(page.getByRole('button',{name:'Provo për ekipin',exact:true})).toHaveCount(0);
 }finally{if(companyId){const ids=[...(await prisma.user.findMany({where:{companyProfileId:companyId},select:{id:true}})),...(await prisma.worker.findMany({where:{companyProfileId:companyId},select:{id:true}}))].map(r=>r.id);await prisma.notificationSubscription.deleteMany({where:{userId:{in:ids}}});await prisma.notificationSettings.deleteMany({where:{userId:{in:ids}}});await cleanupSteelAssetsWorkshop(companyId);}}
});
