import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {assertE2ETestDatabase,validateE2ETarget} from '../../scripts/lib/e2e-target';
import {seedSteelAssetsWorkshop,cleanupSteelAssetsWorkshop} from '../fixtures/steel-assets-workshop';
import {assetCopy} from '../../src/components/company-assets/copy';
const c=assetCopy('sq'),baseline=process.env.CLOTHING_BASELINE==='true';
async function localOnly(context:BrowserContext,origin:string){await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));await context.addCookies([{name:'bk_lang',value:'sq',url:origin}]);}
async function fit(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test('clothing groups show complete stock and custody, keep XLS hidden and retain confirmed individual handovers',async({page,context,browser,baseURL})=>{
 test.setTimeout(240000);assertE2ETestDatabase(process.env);const origin=validateE2ETarget(baseURL!).baseURL;await localOnly(context,origin);let companyId:string|undefined,employee:BrowserContext|undefined;
 try{
  const marker=`clothing-${Date.now()}`,email=marker+'@example.test';await page.goto('/signup?mode=bau');
  for(const [name,value]of Object.entries({displayName:'Synthetic Assets · DEMO',fullName:'Synthetic Chief',email,password:'Synthetic-Clothing-2026!'}))await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('button[type=submit]').click();await expect(page).toHaveURL(/\/app\/dashboard$/);companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
  const seed=await seedSteelAssetsWorkshop(companyId,marker);await prisma.companyInventoryItem.delete({where:{id:seed.clothing.id}});
  for(const [name,size,quantity,held]of [['Jacket · DEMO','M',35,10],['Jacket · DEMO','L',2,1],['Gloves · DEMO',null,3,0],['Boots · DEMO','42',1,1]] as const){
   for(let n=0;n<quantity;n++){const holder=n<held?seed.worker.id:null,item=await prisma.companyInventoryItem.create({data:{companyProfileId:companyId,category:'CLOTHING',name,sizeLabel:size,itemCode:`XLS-${marker}-${name}-${size}-${n}`}});
    await prisma.companyOperationalAsset.create({data:{companyProfileId:companyId,inventoryItemId:item.id,holderWorkerId:holder}});
    if(holder)await prisma.workerAssetItem.create({data:{workerId:holder,companyInventoryItemId:item.id,kind:'CLOTHING',itemName:name,itemCode:item.itemCode,sizeLabel:size,isPrivate:false,status:'ACTIVE',createdByRole:'ADMIN',createdByName:'Synthetic import'}});
   }
  }
  const original=await prisma.companyInventoryItem.findMany({where:{companyProfileId:companyId},orderBy:{id:'asc'}});
  const originalAssignments=await prisma.workerAssetItem.findMany({where:{worker:{companyProfileId:companyId}},orderBy:{id:'asc'}});
  for(const [width,height,theme]of [[1440,900,'light'],[390,844,'dark'],[320,740,'light'],[760,390,'dark']] as const){
   await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:origin}]);await page.goto('/app/inventory');await page.getByRole('tab',{name:c.clothing,exact:true}).click();await expect(page.getByRole('tabpanel').locator('p.tabular-nums')).toContainText('41');
   if(!baseline){await expect(page.getByTestId('clothing-group')).toHaveCount(4);await expect(page.getByRole('tabpanel')).not.toContainText('XLS-');const m=page.getByTestId('clothing-group').filter({hasText:'Jacket · DEMO'}).filter({hasText:/Masa: M/});await expect(m.getByTestId('clothing-reserve')).toHaveText('25');await expect(m.getByTestId('clothing-assigned')).toHaveText('10');}
   await fit(page);if(process.env.CLOTHING_EVIDENCE_DIR)await page.screenshot({path:`${process.env.CLOTHING_EVIDENCE_DIR}/${baseline?'before':'after'}-${width}-${theme}.png`});
  }
  expect(await prisma.companyInventoryItem.findMany({where:{companyProfileId:companyId},orderBy:{id:'asc'}})).toEqual(original);expect(await prisma.workerAssetItem.findMany({where:{worker:{companyProfileId:companyId}},orderBy:{id:'asc'}})).toEqual(originalAssignments);
  if(baseline)return;
  await page.setViewportSize({width:390,height:844});const group=page.getByTestId('clothing-group').filter({hasText:'Jacket · DEMO'}).filter({hasText:/Masa: M/});await group.click();await expect(page.getByTestId('clothing-unit')).toHaveCount(30);await expect(page.getByRole('tabpanel')).not.toContainText('XLS-');await page.getByRole('button',{name:c.next,exact:true}).click();await expect(page.getByTestId('clothing-unit')).toHaveCount(5);await page.getByRole('button',{name:c.previous,exact:true}).click();await expect(page.getByTestId('clothing-unit')).toHaveCount(30);
  await page.getByTestId('clothing-unit').filter({hasText:c.available}).first().click();const detail=page.getByTestId('asset-detail');await expect(detail).toBeVisible();await expect(detail).not.toContainText('XLS-');await detail.getByTestId('asset-codes').locator('summary').click();await expect(detail.getByTestId('asset-codes')).not.toContainText('XLS-');await detail.getByRole('button',{name:c.handover,exact:true}).click();await detail.getByRole('combobox',{name:c.worker,exact:true}).selectOption(seed.worker.id);await detail.getByRole('button',{name:c.confirm,exact:true}).click();
  await expect.poll(()=>prisma.companyAssetHandover.count({where:{companyProfileId:companyId,status:'pending'}})).toBe(1);const handover=await prisma.companyAssetHandover.findFirstOrThrow({where:{companyProfileId:companyId,status:'pending'}});expect((await prisma.companyOperationalAsset.findUniqueOrThrow({where:{id:handover.assetId}})).holderWorkerId).toBeNull();
  await prisma.accessGrant.create({data:{companyProfileId:companyId,workerId:seed.worker.id,place:'warehouse',scopeId:'',level:'view'}});
  employee=await browser.newContext({baseURL});await localOnly(employee,origin);const ep=await employee.newPage();await ep.goto('/workzone/login');await ep.locator('input[name=name]').fill(seed.worker.firstName);await ep.locator('input[name=loginCode]').fill(seed.workerCode);await ep.locator('button[type=submit]').click();await expect(ep).toHaveURL(/\/workzone\/profile$/);await ep.goto('/workzone/inventory');await ep.getByRole('button',{name:c.confirm,exact:true}).click();await expect.poll(async()=>(await prisma.companyOperationalAsset.findUniqueOrThrow({where:{id:handover.assetId}})).holderWorkerId).toBe(seed.worker.id);
  await page.goto('/app/inventory');await page.getByRole('tab',{name:c.clothing,exact:true}).click();await expect(group.getByTestId('clothing-reserve')).toHaveText('24');await expect(group.getByTestId('clothing-assigned')).toHaveText('11');await fit(page);
  await page.getByRole('searchbox').fill('Gloves');await expect(page.getByTestId('clothing-group')).toHaveCount(1);await expect(page.getByTestId('clothing-group')).toContainText(c.noSize);await page.getByRole('searchbox').fill('');await expect(page.getByTestId('clothing-group')).toHaveCount(4);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');await fit(page);await page.getByTestId('clothing-group').first().click();await expect(page.getByTestId('clothing-unit').first()).toBeVisible();await fit(page);await page.evaluate(()=>document.documentElement.style.fontSize='');
  expect(await prisma.companyInventoryItem.findMany({where:{companyProfileId:companyId},orderBy:{id:'asc'}})).toEqual(original);
 }finally{await employee?.close();if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});
