import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import sharp from 'sharp';
import { prisma } from '../../src/lib/db/prisma';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { assetCopy } from '../../src/components/company-assets/copy';
import { cleanupSteelAssetsWorkshop, seedSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';

const c=assetCopy('sq');
type Seed=Awaited<ReturnType<typeof seedSteelAssetsWorkshop>>;
const detail=(page:Page)=>page.getByTestId('asset-detail');
const currentDialog=(page:Page)=>page.getByRole('dialog').last();
async function noExternalRequests(context:BrowserContext,baseURL:string) {
  const target=validateE2ETarget(baseURL);
  await context.route('**/*',route=>new URL(route.request().url()).origin===target.baseURL?route.continue():route.abort('blockedbyclient'));
}
async function setup(page:Page,context:BrowserContext,info:TestInfo) {
  assertE2ETestDatabase(process.env);
  for(const name of ['OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','WANWAY_APPID','WANWAY_KEY'])expect(Boolean(process.env[name]?.trim()),`${name} must be omitted by the disposable runner`).toBe(false);
  const marker=`assets-${Date.now()}-${info.workerIndex}`;
  const email=`${marker}@example.test`;
  await noExternalRequests(context,info.project.use.baseURL!);
  await context.addCookies([{name:'bk_lang',value:'sq',url:info.project.use.baseURL!},{name:'bk_theme',value:'light',url:info.project.use.baseURL!}]);
  await page.goto('/signup?mode=bau');
  for(const [name,value]of Object.entries({displayName:'Synthetic Assets · DEMO',fullName:'Synthetic Chief',email,password:'Synthetic-Assets-Only-2026!'}))await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
  return {companyId,seed:await seedSteelAssetsWorkshop(companyId,marker)};
}
async function loginWorker(browser:Browser,info:TestInfo,worker:Seed['worker'],code:string) {
  const context=await browser.newContext({baseURL:info.project.use.baseURL});
  await noExternalRequests(context,info.project.use.baseURL!);
  await context.addCookies([{name:'bk_lang',value:'sq',url:info.project.use.baseURL!}]);
  const page=await context.newPage();
  await page.goto('/workzone/login');
  await page.locator('input[name="name"]').fill(`${worker.firstName} ${worker.lastName}`);
  await page.locator('input[name="loginCode"]').fill(code);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/workzone\/profile$/);
  return {context,page};
}
async function openItem(page:Page,name:string) {
  await page.locator('#warehouse-items').getByRole('button').filter({hasText:name}).click();
  await expect(detail(page).getByRole('heading',{name,exact:true})).toBeVisible();
}
async function closeDetail(page:Page) { await currentDialog(page).getByRole('button',{name:c.close,exact:true}).click();await expect(detail(page)).toHaveCount(0); }
async function touch(control:Locator,width:number,height:number) {
  await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(43.5);expect(box!.height).toBeGreaterThanOrEqual(43.5);
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
}
async function readablePrimary(control:Locator) {
  await expect(control).toBeVisible();
  const ratio=await control.evaluate(element=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const context=canvas.getContext('2d')!;
    const luminance=(color:string)=>{
      context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);
      const rgb=[...context.getImageData(0,0,1,1).data].slice(0,3).map(value=>{const s=value/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
      return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
    };
    const style=getComputedStyle(element),foreground=luminance(style.color),background=luminance(style.backgroundColor);
    return(Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}
async function production(companyId:string) {
  return {elements:await prisma.siteElement.findMany({where:{companyProfileId:companyId},orderBy:{id:'asc'}}),work:await prisma.siteElementWork.findMany({where:{companyProfileId:companyId},orderBy:{id:'asc'}})};
}

test('warehouse separates individual clothing, confirmed handovers and worker loss decisions',async({page,context,browser},info)=>{
  test.setTimeout(180_000);let companyId:string|undefined;let workerContext:BrowserContext|undefined;
  try{
    const fixture=await setup(page,context,info);companyId=fixture.companyId;const {seed}=fixture;
    await page.goto('/app/inventory');
    await expect(page.getByRole('tab',{name:c.tools,exact:true})).toHaveAttribute('aria-selected','true');
    await openItem(page,seed.tool.name);
    await detail(page).getByRole('button',{name:c.handover,exact:true}).click();
    await detail(page).getByRole('combobox',{name:c.worker,exact:true}).selectOption(seed.worker.id);
    await detail(page).getByRole('combobox',{name:c.site,exact:true}).selectOption(seed.site.id);
    await detail(page).getByRole('button',{name:c.confirm,exact:true}).click();
    await expect.poll(()=>prisma.companyAssetHandover.count({where:{companyProfileId:companyId,status:'pending'}})).toBe(1);
    expect((await prisma.companyOperationalAsset.findUniqueOrThrow({where:{inventoryItemId:seed.tool.id}})).holderWorkerId).toBeNull();
    // Basic workers need an explicit viewing key to enter the shared warehouse.
    await prisma.accessGrant.create({data:{companyProfileId:fixture.companyId,workerId:seed.worker.id,place:'warehouse',scopeId:'',level:'view'}});
    const worker=await loginWorker(browser,info,seed.worker,seed.workerCode);workerContext=worker.context;
    await worker.page.goto('/workzone/inventory');
    await expect(worker.page.getByRole('button',{name:c.addAsset,exact:true})).toHaveCount(0);
    await worker.page.getByRole('button',{name:c.confirm,exact:true}).click();
    await expect.poll(async()=>(await prisma.companyOperationalAsset.findUniqueOrThrow({where:{inventoryItemId:seed.tool.id}})).holderWorkerId).toBe(seed.worker.id);
    await openItem(worker.page,seed.tool.name);
    await expect(detail(worker.page).getByRole('option',{name:c.invoice,exact:true})).toHaveCount(0);
    await detail(worker.page).getByRole('button',{name:c.reportLost,exact:true}).click();
    await detail(worker.page).getByLabel(c.note,{exact:true}).fill('Synthetic loss report for confirmation.');
    await detail(worker.page).getByRole('button',{name:c.report,exact:true}).click();
    await expect.poll(()=>prisma.companyAssetIncident.count({where:{companyProfileId:companyId,kind:'lost',status:'pending'}})).toBe(1);
    expect((await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:seed.tool.id}})).isActive).toBe(true);
    await page.reload();await openItem(page,seed.tool.name);
    await detail(page).getByLabel(c.note,{exact:true}).fill('Synthetic chief confirmed the loss.');
    await detail(page).getByRole('button',{name:c.approve,exact:true}).click();
    await expect.poll(async()=>(await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:seed.tool.id}})).isActive).toBe(false);
    await detail(page).getByRole('button',{name:c.restore,exact:true}).click();
    await detail(page).getByLabel(c.note,{exact:true}).fill('Synthetic item found and checked.');
    await detail(page).getByRole('button',{name:c.restore,exact:true}).last().click();
    await expect.poll(async()=>(await prisma.companyInventoryItem.findUniqueOrThrow({where:{id:seed.tool.id}})).isActive).toBe(true);
    await expect(detail(page).getByRole('list').last()).toContainText('Synthetic Chief');
    await closeDetail(page);
    await page.getByRole('tab',{name:c.clothing,exact:true}).click();
    await page.getByRole('button',{name:c.addAsset,exact:true}).click();
    await page.getByLabel(c.name,{exact:true}).fill('Synthetic batch vest');await page.getByLabel(c.size,{exact:true}).fill('XL');await page.getByLabel(c.quantity,{exact:true}).fill('3');
    await page.getByRole('button',{name:c.add,exact:true}).click();
    await expect.poll(()=>prisma.companyInventoryItem.count({where:{companyProfileId:companyId,name:'Synthetic batch vest',sizeLabel:'XL'}})).toBe(3);
    const rows=await prisma.companyInventoryItem.findMany({where:{companyProfileId:companyId,name:'Synthetic batch vest'}});expect(new Set(rows.map(row=>row.itemCode)).size).toBe(3);expect(new Set(rows.map(row=>row.barcode)).size).toBe(3);
    await page.screenshot({path:info.outputPath('warehouse-confirmed-light-desktop.png')});
  }finally{await workerContext?.close().catch(()=>undefined);if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});

test('mechanic repairs with external provider and private evidence before tested ready',async({page,context,browser},info)=>{
  test.setTimeout(180_000);let companyId:string|undefined;const other:BrowserContext[]=[];
  try{
    const fixture=await setup(page,context,info);companyId=fixture.companyId;const {seed}=fixture;
    const before=await production(companyId);
    const worker=await loginWorker(browser,info,seed.worker,seed.workerCode);other.push(worker.context);
    await worker.page.goto('/workzone');await worker.page.getByTestId('fleet-dock-open').click();await worker.page.locator(`[data-machine-id="${seed.machines[0].id}"]`).click();await worker.page.getByTestId('fleet-machine-workshop').click();await detail(worker.page).getByRole('button',{name:c.sendWorkshop,exact:true}).click();
    await detail(worker.page).getByLabel(c.note,{exact:true}).fill('Synthetic brake inspection required.');await detail(worker.page).getByRole('button',{name:c.report,exact:true}).click();
    await expect.poll(()=>prisma.companyAssetRepair.count({where:{companyProfileId:companyId,phase:'reported'}})).toBe(1);
    const mechanic=await loginWorker(browser,info,seed.mechanic,seed.mechanicCode);other.push(mechanic.context);
    await mechanic.page.goto('/workzone/workshop');
    await mechanic.page.getByTestId('workshop-workspace').getByRole('button').filter({hasText:seed.machines[0].name}).click();
    await detail(mechanic.page).getByTestId('service-repair').locator('summary').filter({hasText:c.repairNote}).click();
    const draftNote=detail(mechanic.page).getByRole('textbox',{name:c.repairNote,exact:true});await draftNote.fill('Synthetic note retained through reception.');
    await detail(mechanic.page).getByRole('button',{name:c.allDetails,exact:true}).click();await expect(draftNote).toHaveValue('Synthetic note retained through reception.');
    await detail(mechanic.page).getByRole('button',{name:c.fewerDetails,exact:true}).click();await expect(draftNote).toHaveValue('Synthetic note retained through reception.');
    await detail(mechanic.page).getByRole('button',{name:c.receive,exact:true}).click();await expect(detail(mechanic.page).getByRole('button',{name:c.startRepair,exact:true})).toBeEnabled();
    await expect(draftNote).toHaveValue('Synthetic note retained through reception.');
    await detail(mechanic.page).getByRole('button',{name:c.startRepair,exact:true}).click();await expect(draftNote).toHaveValue('Synthetic note retained through reception.');
    const draftForm=detail(mechanic.page).locator('form').filter({has:mechanic.page.getByRole('textbox',{name:c.repairNote,exact:true})});await expect(draftForm).toHaveCount(1);
    await draftForm.getByRole('button',{name:c.save,exact:true}).click();
    await detail(mechanic.page).getByText(c.serviceRoute,{exact:true}).click();await detail(mechanic.page).getByRole('combobox',{name:c.location,exact:true}).selectOption('external');await detail(mechanic.page).getByLabel(c.provider,{exact:true}).fill('Aurora Repair · DEMO');
    const locationForm=detail(mechanic.page).locator('form').filter({has:mechanic.page.getByRole('combobox',{name:c.location,exact:true})});await locationForm.getByLabel(c.note,{exact:true}).fill('Synthetic external booking.');await locationForm.getByRole('button',{name:c.save,exact:true}).click();
    await expect.poll(async()=>(await prisma.companyAssetRepair.findFirstOrThrow({where:{companyProfileId:companyId}})).location).toBe('external');
    await expect(detail(mechanic.page).getByRole('button',{name:c.markReady,exact:true})).toBeDisabled();
    await detail(mechanic.page).getByText(c.serviceEvidence,{exact:true}).click();await detail(mechanic.page).getByRole('combobox',{name:c.files,exact:true}).selectOption('invoice');
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
    await detail(mechanic.page).getByTestId('asset-file-input').setInputFiles({name:'synthetic-repair.pdf',mimeType:'application/pdf',buffer:pdf});
    await expect(detail(mechanic.page).getByRole('link',{name:/synthetic-repair.pdf/})).toBeVisible();
    const invoice=await prisma.companyAssetFile.findFirstOrThrow({where:{companyProfileId:companyId,kind:'invoice'}});
    expect((await worker.context.request.get(`/api/company-assets/files/${invoice.id}`)).status()).toBe(404);
    const png=await sharp({create:{width:240,height:160,channels:3,background:'#f97316'}}).withMetadata().png().toBuffer();
    // Capturing a receipt must keep the selected invoice classification/private access.
    await detail(mechanic.page).getByTestId('asset-camera-input').setInputFiles({name:'synthetic-camera-invoice.png',mimeType:'image/png',buffer:png});
    await expect.poll(()=>prisma.companyAssetFile.count({where:{companyProfileId:companyId,kind:'invoice',name:'synthetic-camera-invoice.webp'}})).toBe(1);
    const cameraInvoice=await prisma.companyAssetFile.findFirstOrThrow({where:{companyProfileId:companyId,kind:'invoice',name:'synthetic-camera-invoice.webp'}});
    expect(cameraInvoice.mime).toBe('image/webp');
    expect((await worker.context.request.get(`/api/company-assets/files/${cameraInvoice.id}`)).status()).toBe(404);
    await detail(mechanic.page).getByRole('combobox',{name:c.files,exact:true}).selectOption('photo');await detail(mechanic.page).getByTestId('asset-file-input').setInputFiles({name:'synthetic-checked.png',mimeType:'image/png',buffer:png});
    await expect.poll(()=>prisma.companyAssetFile.count({where:{companyProfileId:companyId,kind:'photo'}})).toBe(1);
    const photo=await prisma.companyAssetFile.findFirstOrThrow({where:{companyProfileId:companyId,kind:'photo'}});expect(photo.mime).toBe('image/webp');expect(photo.size).toBeLessThanOrEqual(180000);
    await detail(mechanic.page).getByRole('checkbox',{name:c.tested,exact:true}).check();await detail(mechanic.page).getByRole('button',{name:c.markReady,exact:true}).click();
    await expect.poll(async()=>(await prisma.companyAssetRepair.findFirstOrThrow({where:{companyProfileId:companyId}})).phase).toBe('ready');
    await detail(mechanic.page).getByRole('button',{name:c.allDetails,exact:true}).click();await expect(detail(mechanic.page).getByRole('heading',{name:c.history,exact:true})).toBeVisible();
    expect(await prisma.companyAssetEvent.count({where:{companyProfileId:companyId,type:'repair.ready',actorName:`${seed.mechanic.firstName} ${seed.mechanic.lastName}`}})).toBe(1);
    await closeDetail(mechanic.page);await expect(mechanic.page.locator('#workshop-phase-ready')).toContainText(seed.machines[0].name);
    expect(await production(companyId)).toEqual(before);
    await mechanic.page.screenshot({path:info.outputPath('workshop-ready-light-desktop.png')});
  }finally{for(const item of other)await item.close();if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});

test('fleet grid and workshop stay usable at desktop and narrow sizes in both themes',async({page,context},info)=>{
  test.setTimeout(240_000);let companyId:string|undefined;
  try{
    const fixture=await setup(page,context,info);companyId=fixture.companyId;const {seed}=fixture;
    await prisma.companyInventoryItem.createMany({data:Array.from({length:29},(_,index)=>({companyProfileId:companyId!,category:'WORK_TOOL' as const,itemCode:`SCROLL-${companyId}-${index}`,name:`ZZ Scroll Tool ${String(index+1).padStart(2,'0')} · DEMO`}))});
    const garmentCode=`SYNTHETIC-CLOTHING-${companyId}`;
    await prisma.companyInventoryItem.update({where:{id:seed.clothing.id},data:{barcode:garmentCode}});
    // Populated bays and two visits for one asset exercise exact historical job selection.
    const visualJobs=[];
    for (const [index,phase] of ['reported','received','repairing','ready'].entries()) {
      const asset=await prisma.companyOperationalAsset.create({data:{companyProfileId:companyId,machineId:seed.machines[index+2].id}});
      const job=await prisma.companyAssetRepair.create({data:{companyProfileId:companyId,assetId:asset.id,phase,problem:`Synthetic ${phase} service`,reportedByKey:'synthetic',reportedByName:'Synthetic Operator',...(phase==='ready'?{tested:true,repairNote:'Synthetic completed service'}:{})}});
      visualJobs.push(job);
    }
    const historical=await prisma.companyAssetRepair.create({data:{companyProfileId:companyId,assetId:visualJobs[0].assetId,phase:'ready',problem:'Earlier synthetic oil service',repairNote:'Historical evidence only',tested:true,reportedByKey:'synthetic',reportedByName:'Synthetic Operator',createdAt:new Date('2026-01-01T10:00:00Z')}});
    await page.goto('/workzone');
    for(const theme of ['light','dark'])for(const width of [1440,390,360]){
      const height=width===1440?1000:844;await page.setViewportSize({width,height});
      await context.addCookies([{name:'bk_theme',value:theme,url:info.project.use.baseURL!}]);await page.reload();
      await expect(page.getByTestId('fleet-dock-open')).toBeVisible();await expect(page.getByTestId('workshop-dock-open')).toBeVisible();
      await page.screenshot({path:info.outputPath(`assets-before-${theme}-${width}.png`)});
      await page.getByTestId('fleet-dock-open').click();const picker=page.getByTestId('fleet-picker');
      if(width<500)expect(await picker.getByTestId('fleet-card-grid').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3);
      await expect(picker.locator(`[data-machine-id="${seed.machines[0].id}"]`)).toContainText('ZZ 001 DM');await expect(picker.locator(`[data-machine-id="${seed.machines[1].id}"]`)).toContainText('ZZ 002 DM');
      await page.screenshot({path:info.outputPath(`fleet-grid-${theme}-${width}.png`)});
      await picker.getByTestId('fleet-search').fill('ZZ 001 DM');await expect(picker.locator('[data-machine-id]')).toHaveCount(1);await touch(picker.locator('[data-machine-id]'),width,height);
      await page.screenshot({path:info.outputPath(`fleet-picker-${theme}-${width}.png`)});await picker.locator('[data-machine-id]').click();
      const machine=page.getByTestId('fleet-machine-card');await expect(machine).toBeVisible();
      await expect(machine.locator(`a[href="/workzone/fuel?machine=${seed.machines[0].id}"]`)).toBeVisible();await expect(machine.locator('a[href*="google.com/maps"]')).toBeVisible();
      await touch(machine.getByTestId('fleet-machine-workshop'),width,height);await touch(machine.getByTestId('fleet-machine-edit'),width,height);expect(await machine.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`fleet-machine-${theme}-${width}.png`)});
      await machine.getByTestId('fleet-machine-edit').click();const editor=page.getByTestId('machine-editor');await expect(editor).toBeVisible();
      expect(await currentDialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
      if(theme==='light'&&width===1440){
        await editor.locator('input[name="model"]').fill('Aurora 2027');await editor.locator('input[name="insuranceDate"]').fill('2027-11-06');
        const photo=await sharp({create:{width:240,height:160,channels:3,background:'#f97316'}}).png().toBuffer();
        const cover=editor.getByTestId(`asset-photo-machine-${seed.machines[0].id}`);
        await cover.locator('input[data-photo-input="upload"]').setInputFiles({name:'synthetic-vehicle.png',mimeType:'image/png',buffer:photo});
        await expect(cover.locator('img')).toHaveAttribute('src',/api\/asset-photos/);
        const pdf=Buffer.from('%PDF-1.4\nSynthetic insurance\n%%EOF');
        await editor.locator('summary').filter({hasText:c.files}).click();await editor.getByRole('combobox',{name:c.files,exact:true}).selectOption('document');
        await editor.getByTestId('asset-file-input').setInputFiles({name:'synthetic-insurance.pdf',mimeType:'application/pdf',buffer:pdf});
        await expect(editor.getByRole('link',{name:/synthetic-insurance.pdf/})).toBeVisible();
        await editor.getByRole('button',{name:c.save,exact:true}).click();await expect(editor).toHaveCount(0);
        await expect(machine).toContainText('Aurora 2027');await expect(machine).toContainText('6.11.2027');
        const paper=await prisma.companyAssetFile.findFirstOrThrow({where:{companyProfileId:companyId,name:'synthetic-insurance.pdf'}});expect(paper.repairId).toBeNull();
        await machine.getByTestId('fleet-machine-edit').click();await expect(editor).toBeVisible();
      }
      await expect(editor.getByTestId('asset-detail')).toBeVisible();await page.screenshot({path:info.outputPath(`vehicle-edit-${theme}-${width}.png`)});await page.keyboard.press('Escape');await expect(machine.getByTestId('fleet-machine-edit')).toBeFocused();
      await machine.getByTestId('fleet-machine-workshop').click();await expect(detail(page).getByRole('button',{name:c.sendWorkshop,exact:true})).toBeVisible();await expect(detail(page).getByRole('button',{name:c.serviceHistory,exact:true})).toBeVisible();
      await expect(detail(page).getByRole('heading',{name:c.history,exact:true})).toHaveCount(0);
      await page.screenshot({path:info.outputPath(`vehicle-service-${theme}-${width}.png`)});await page.keyboard.press('Escape');await expect(machine.getByTestId('fleet-machine-workshop')).toBeFocused();await page.keyboard.press('Escape');
      await expect(picker.locator('[data-machine-id]')).toBeFocused();await page.keyboard.press('Escape');
      await page.getByTestId('workshop-dock-open').click();await expect(page.getByTestId('workshop-workspace')).toBeVisible();
      expect(await currentDialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.getByTestId('workshop-repair-card').first()).toBeVisible();await page.screenshot({path:info.outputPath(`workshop-${theme}-${width}.png`)});
      if(width===1440){
        await page.getByTestId('workshop-workspace').locator(`[data-repair-id="${historical.id}"]`).click();
        await expect(detail(page).getByTestId('service-repair')).toHaveAttribute('data-repair-id',historical.id);await expect(detail(page)).toContainText('Historical evidence only');await expect(detail(page).getByRole('button',{name:c.receive,exact:true})).toHaveCount(0);
        await detail(page).getByRole('button',{name:c.openRepair,exact:true}).click();await expect(detail(page).getByTestId('service-repair')).toHaveAttribute('data-repair-id',visualJobs[0].id);await expect(detail(page).getByRole('button',{name:c.receive,exact:true})).toBeVisible();
        await page.screenshot({path:info.outputPath(`service-job-${theme}.png`)});await page.keyboard.press('Escape');
      }
      if(width===1440&&theme==='light'){
        await page.getByTestId('workshop-workspace').getByRole('button',{name:c.scan,exact:true}).click();
        await currentDialog(page).getByRole('textbox').fill(garmentCode);await currentDialog(page).getByRole('button',{name:c.find,exact:true}).click();
        await expect(detail(page).getByRole('heading',{name:seed.clothing.name,exact:true})).toBeVisible();
        await expect(detail(page).getByRole('button',{name:c.sendWorkshop,exact:true})).toHaveCount(0);
        await expect(detail(page).getByRole('button',{name:c.serviceHistory,exact:true})).toBeVisible();await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('workshop-dock-open')).toBeFocused();
      await page.goto('/app/inventory');await expect(page.getByRole('tab',{name:c.clothing,exact:true})).toBeVisible();await readablePrimary(page.getByRole('button',{name:c.addAsset,exact:true}));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`warehouse-${theme}-${width}.png`)});await page.goto('/workzone');
    }
    // One bounded short-window / text-enlargement state for the touched native dialogs.
    await page.setViewportSize({width:844,height:390});
    const zoom=await page.addStyleTag({content:'html { font-size: 200% !important; }'});
    await page.getByTestId('fleet-dock-open').click();
    expect(await currentDialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await touch(currentDialog(page).getByRole('button',{name:c.close,exact:true}),844,390);
    await page.screenshot({path:info.outputPath('fleet-landscape-text-zoom.png')});
    await page.getByTestId('fleet-picker').locator('[data-machine-id]').first().click();
    await page.getByTestId('fleet-machine-edit').click();
    const zoomEditor=page.getByTestId('machine-editor');await expect(zoomEditor).toBeVisible();
    expect(await currentDialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await touch(zoomEditor.getByRole('button',{name:c.save,exact:true}),844,390);
    await page.screenshot({path:info.outputPath('vehicle-edit-landscape-text-zoom.png')});
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await page.getByTestId('workshop-dock-open').click();
    await expect(page.getByTestId('workshop-workspace')).toBeVisible();
    expect(await currentDialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await touch(currentDialog(page).getByRole('button',{name:c.close,exact:true}),844,390);
    await page.screenshot({path:info.outputPath('workshop-landscape-text-zoom.png')});
    await page.keyboard.press('Escape');
    await zoom.evaluate(element=>element.remove());
    // Check the actual scrolling underlay once; do not alter the accepted header/footer.
    await page.setViewportSize({width:390,height:500});
    const main=page.getByTestId('app-workspace-scroll');
    await main.press('PageDown');
    await expect.poll(()=>main.evaluate(element=>element.scrollTop)).toBeGreaterThan(100);
    const underlay=await page.evaluate(()=>{
      const main=document.querySelector('[data-testid="app-workspace-scroll"]')!;
      const content=main.firstElementChild!;
      const header=document.querySelector('[data-testid="admin-topbar"],[data-testid="workzone-topbar"]')!;
      const h=header.getBoundingClientRect(),m=main.getBoundingClientRect();
      const x=m.left+m.width/2,y=h.bottom-2;
      const hit=document.elementFromPoint(x,y);
      const logo=header.querySelector('button,a')!,l=logo.getBoundingClientRect();
      const logoHit=document.elementFromPoint(l.x+l.width/2,l.y+l.height/2);
      return {headerBackground:getComputedStyle(header).backgroundColor,contentTop:content.getBoundingClientRect().top,headerBottom:h.bottom,contentBehind:document.elementsFromPoint(x,y).some(element=>element===content||content.contains(element)),emptyAreaPassesClicks:!!hit&&main.contains(hit),logoAboveContent:logoHit===logo||!!logoHit&&logo.contains(logoHit)};
    });
    expect(underlay.headerBackground).toBe('rgba(0, 0, 0, 0)');
    expect(underlay.contentTop).toBeLessThan(underlay.headerBottom);
    expect(underlay.contentBehind).toBe(true);
    expect(underlay.emptyAreaPassesClicks).toBe(true);
    expect(underlay.logoAboveContent).toBe(true);
    await page.screenshot({path:info.outputPath('workzone-underlay-390-short.png')});
    // A same-query refresh preserves the actual card node, opener focus and scroll.
    await page.setViewportSize({width:390,height:844});await page.goto('/app/inventory');
    const warehouse=page.getByTestId('asset-warehouse');
    const scrollCard=page.locator('#warehouse-items').getByRole('button').filter({hasText:'ZZ Scroll Tool 29 · DEMO'});
    await scrollCard.scrollIntoViewIfNeeded();
    const cardHandle=await scrollCard.elementHandle();expect(cardHandle).not.toBeNull();
    const listScroll=page.getByTestId('app-workspace-scroll');
    const priorScroll=await listScroll.evaluate(element=>element.scrollTop);expect(priorScroll).toBeGreaterThan(100);
    await scrollCard.click();await expect(detail(page).getByRole('heading',{name:'ZZ Scroll Tool 29 · DEMO',exact:true})).toBeVisible();
    await closeDetail(page);
    await expect(warehouse).toHaveAttribute('aria-busy','false');
    expect(await cardHandle!.evaluate(element=>element.isConnected)).toBe(true);
    await expect(scrollCard).toBeFocused();
    expect(Math.abs(await listScroll.evaluate(element=>element.scrollTop)-priorScroll)).toBeLessThanOrEqual(2);
    await page.screenshot({path:info.outputPath('warehouse-refresh-retains-scroll.png')});
    // A different category must hide the old tools while its real response is delayed.
    let releaseCategory=()=>{};
    const categoryResponse=new Promise<void>(resolve=>{releaseCategory=resolve;});
    const delayCategory=async(route:Route)=>{
      if(route.request().method()==='POST'&&route.request().postData()?.includes('"category":"clothing"'))await categoryResponse;
      await route.fallback();
    };
    await page.route('**/app/inventory',delayCategory);
    try{
      await page.getByRole('tab',{name:c.clothing,exact:true}).click();
      await expect(warehouse).toHaveAttribute('aria-busy','true');
      await expect(scrollCard).toHaveCount(0);
    }finally{
      // Keep the handler until page teardown; removing it while the paused
      // fallback resumes can dispatch the same request to the context twice.
      releaseCategory();
    }
    await expect(page.locator('#warehouse-items').getByRole('button').filter({hasText:seed.clothing.name})).toBeVisible();
    await expect(warehouse).toHaveAttribute('aria-busy','false');
  }finally{if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});
