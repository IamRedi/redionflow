import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
import {removeSecurityTenants} from '../security/fixtures';

const words=JSON.parse(readFileSync(new URL('../../src/locales/sq.json',import.meta.url),'utf8'));
const text=(path:string):string=>path.split('.').reduce((v,k)=>v[k],words);
test('factory Start, material completion, phase and open dashboard share actual records',async({page,context,browser},info)=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const base=String(info.project.use.baseURL),out=process.env.FACTORY_SYNC_EVIDENCE_DIR!,baseline=process.env.FACTORY_SYNC_BASELINE==='true';
 const company=await prisma.companyProfile.create({data:{displayName:'Synthetic factory sync · DEMO',legalName:'Synthetic local only',mode:'bau',country:'AL'}});
 const admin=await prisma.user.create({data:{companyProfileId:company.id,email:`factory-sync-${company.id}@example.test`,name:'Production chief · DEMO',role:'ADMIN'}});
 const worker=await prisma.worker.create({data:{companyProfileId:company.id,firstName:'Arben',lastName:'DEMO',status:'active',crewRole:'FACTORY_WORKER',availability:'AVAILABLE'}});
 const workshop=await prisma.baustelle.create({data:{companyProfileId:company.id,name:'Punishtja Qerekë · DEMO',type:'STEEL_WORKSHOP'}});
 const site=await prisma.baustelle.create({data:{companyProfileId:company.id,name:'Kantier sinkronizimi · DEMO',type:'STEEL_ASSEMBLY'}});
 const definition=await prisma.steelWorkDefinition.create({data:{companyProfileId:company.id,kind:'site',key:'steel-task-sync-demo',label:'Asambim',phaseGroup:'production',linkedProcessKey:'assembly',linkedList:'part'}});
 const tree=await prisma.treeItem.create({data:{baustelleId:site.id,treeId:definition.key,species:'task',diameter:0,status:'todo'}});
 await prisma.steelSiteTask.create({data:{companyProfileId:company.id,baustelleId:site.id,definitionId:definition.id,treeItemId:tree.id,enabled:true}});
 const element=await prisma.siteElement.create({data:{companyProfileId:company.id,baustelleId:site.id,list:'assembly',mark:'F-SYNC-01',quantity:3,weightKg:10,processRoutes:{v:1,factory:['assembly'],field:[]}}});
 const captureOnly=process.env.FACTORY_SYNC_CAPTURE_ONLY==='true';
 if(captureOnly)await prisma.siteElementWork.create({data:{companyProfileId:company.id,elementId:element.id,stage:'assembly',pieces:3,workerIds:[worker.id],checkedByName:'Synthetic confirmation'}});
 const workerContext=await browser.newContext();const employee=await workerContext.newPage();const errors:string[]=[];
 for(const p of [page,employee])p.on('pageerror',e=>errors.push(e.message));
 for(const c of [context,workerContext])await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 try{
  await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',admin.id,admin.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  await workerContext.addCookies([{name:'bk_worker_id',value:await createSessionCookie('worker',worker.id,worker.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);
  if(baseline||captureOnly)await prisma.workSession.create({data:{workerId:worker.id,startTime:new Date(),isLive:true,baustelleId:workshop.id}});
  else{
   await employee.goto('/workzone/profile');
   await employee.getByRole('button',{name:text('workzone.startWork'),exact:true}).click();
   await employee.getByRole('button',{name:text('common.now'),exact:true}).click();
   await expect(employee.getByTestId('worker-current-workplace')).toContainText(workshop.name);
   const clock=await prisma.workSession.findFirstOrThrow({where:{workerId:worker.id,isLive:true}});expect(clock.baustelleId).toBe(workshop.id);
  }
  const siteUrl=`/workzone/baustellen/${site.id}`,profileUrl=`/workzone/admin-workers/${worker.id}`;
  for(const theme of ['light','dark'])for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);
   await page.goto(profileUrl);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(!baseline)await expect(page.getByTestId('worker-current-workplace')).toContainText(workshop.name);
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-profile-${theme}-${width}.png`});
   await page.goto(siteUrl);await page.getByTestId('phase-group-production').click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`${out}/${baseline?'before':'after'}-production-${theme}-${width}.png`});
  }
  if(baseline)return;
  if(captureOnly){
   await page.getByRole('button').filter({has:page.getByText('Asambim',{exact:true})}).click();
   const phase=page.getByRole('dialog').last();await expect.poll(()=>phase.evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
   await expect.poll(()=>phase.locator('div[style*="opacity"]').evaluateAll(ns=>ns.every(n=>!n.getClientRects().length||getComputedStyle(n).opacity==='1'))).toBe(true);
   await page.screenshot({path:`${out}/after-source-completed-phase.png`});expect(errors).toEqual([]);return;
  }
  const dashboard=await context.newPage();dashboard.on('pageerror',e=>errors.push(e.message));await dashboard.goto('/app/dashboard');
  await expect(dashboard.getByTestId('metric-assembled')).toContainText('0');
  await page.goto(siteUrl);
  await page.getByRole('button',{name:new RegExp('^'+text('elements.factoryList'))}).click();
  await page.getByRole('dialog').last().getByRole('button').filter({has:page.getByText(element.mark,{exact:true})}).click();
  await page.getByRole('dialog').last().getByRole('button').filter({has:page.getByText(text('factory.steps.assembly'),{exact:true})}).click();
  const stage=page.getByRole('dialog').last();await stage.locator('.grid-cols-6 button').getByText('3',{exact:true}).click();
  await stage.getByRole('button').filter({hasText:'Arben DEMO'}).click();
  const changedAt=Date.now();await stage.getByRole('button',{name:/Konfirmo/}).click();
  await expect.poll(()=>prisma.siteElementWork.count({where:{elementId:element.id,stage:'assembly'}})).toBe(1);
  await expect(dashboard.getByTestId('metric-assembled')).toContainText('3',{timeout:75000});
  await test.info().attach('automatic-dashboard-refresh',{body:JSON.stringify({elapsedMs:Date.now()-changedAt}),contentType:'application/json'});
  await page.goto(siteUrl);await expect(page.getByTestId('phase-group-production')).toContainText(/1\s*\/\s*1/);
  await page.getByTestId('phase-group-production').click();
  await page.getByRole('button').filter({has:page.getByText('Asambim',{exact:true})}).click();
  const phase=page.getByRole('dialog').last();await expect(phase.getByRole('button',{name:text('steel.markDone'),exact:true})).toHaveCount(0);
  await expect.poll(()=>phase.evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
  await expect.poll(()=>phase.locator('div[style*="opacity"]').evaluateAll(ns=>ns.every(n=>!n.getClientRects().length||getComputedStyle(n).opacity==='1'))).toBe(true);
  await page.screenshot({path:`${out}/after-source-completed-phase.png`});
  await expect(prisma.treeItem.findUniqueOrThrow({where:{id:tree.id}})).resolves.toMatchObject({status:'todo'});
  expect(errors).toEqual([]);
 }finally{await workerContext.close();await removeSecurityTenants([company.id]);}
});
