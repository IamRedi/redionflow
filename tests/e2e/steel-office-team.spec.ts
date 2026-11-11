import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';
const companyId='office-e2e-company',baseURL='http://127.0.0.1:3230';
async function login(context:BrowserContext,kind:'admin'|'worker',id:string){
 const account=kind==='admin'?await prisma.user.findUniqueOrThrow({where:{id}}):await prisma.worker.findUniqueOrThrow({where:{id}});
 await context.clearCookies();await context.addCookies([{name:kind==='admin'?'bk_admin_id':'bk_worker_id',value:await createSessionCookie(kind,id,account.sessionEpoch),url:baseURL},{name:'bk_lang',value:'sq',url:baseURL}]);
}
async function verifyRoomTargets(page:Page,width:number,height:number){
await expect.poll(()=>page.getByTestId('office-interior').locator('img').evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0)).toBe(true);const targets=await page.getByTestId('office-interior').locator('a').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));for(const r of targets){expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.x).toBeGreaterThanOrEqual(-1);expect(r.y).toBeGreaterThanOrEqual(-1);expect(r.right).toBeLessThanOrEqual(width+1);expect(r.bottom).toBeLessThanOrEqual(height+1);}for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y).toBe(true);}
const calendar=page.getByTestId('office-interior').getByRole('link',{name:'Plani ditor',exact:true});if(await calendar.count()){expect(await calendar.evaluate(a=>{const box=a.getBoundingClientRect();return [...a.querySelectorAll('i,b,strong,small')].every(i=>{const r=i.getBoundingClientRect();return !r.width||(r.bottom<=box.bottom+1&&r.top>=box.top-1);});})).toBe(true);}
}
test('team offices reuse login, categories and private work with physical room controls',async({page,context})=>{
 test.setTimeout(180000);assertE2ETestDatabase(process.env);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await prisma.companyProfile.upsert({where:{id:companyId},update:{},create:{id:companyId,displayName:'Mira Steel · DEMO',legalName:'Synthetic only',mode:'bau',country:'AL'}});
 for(const [id,name] of [['office-e2e-megi','Megi Demo'],['office-e2e-almet','Almet Demo']])await prisma.user.upsert({where:{id},update:{isActive:true},create:{id,name,email:`${id}@example.test`,companyProfileId:companyId,role:'ADMIN'}});
 const worker=await prisma.worker.upsert({where:{id:'office-team-demo-worker'},update:{status:'active',firstName:'Lea',lastName:'Demo'},create:{id:'office-team-demo-worker',companyProfileId:companyId,firstName:'Lea',lastName:'Demo'}});
 await prisma.officeMember.updateMany({where:{companyProfileId:companyId,workerId:worker.id},data:{workProfile:'GENERAL',assistantEnabled:false}});
 await prisma.officeTask.deleteMany({where:{companyProfileId:companyId,title:'Përgatit dosjen · TEAM DEMO'}});
 await login(context,'admin','office-e2e-megi');await page.goto('/workzone/offices/team');
 await page.getByRole('searchbox').fill('Lea');await page.getByRole('button',{name:/^Lea Demo (—|Projektim)/}).click();
 await page.getByLabel('Emri / funksioni i zyrës').fill('Projektim · DEMO');await page.getByLabel('Lejo hyrjen me llogarinë ekzistuese').check();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
 const member=await prisma.officeMember.findUniqueOrThrow({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:worker.id}}});
 await page.getByRole('link',{name:'Recepsioni',exact:true}).click();await page.getByRole('link',{name:/^Lea Demo/}).click();
 if(process.env.OFFICE_BASELINE!=='true')await expect(page.getByTestId('office-preview-notice')).toBeVisible();
 await page.goto(`/workzone/offices/me/mail?compose=1&to=${member.id}`);await expect(page.locator('select[name=recipientId]')).toHaveValue(member.id);
 await page.goto('/workzone/offices/me/tasks');await page.getByRole('button',{name:'Shto',exact:true}).click();
 await page.getByLabel('Titulli',{exact:true}).fill('Përgatit dosjen · TEAM DEMO');await page.getByLabel('Lloji').selectOption('COMPANY');await page.getByRole('combobox',{name:'Kategoria',exact:true}).selectOption({label:'Tjetër'});await page.getByLabel('Përgjegjësi').selectOption(member.id);await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('button',{name:/^Përgatit dosjen · TEAM DEMO/})).toBeVisible();
 await login(context,'worker',worker.id);await page.goto('/workzone/offices/me/tasks');await expect(page.getByRole('button',{name:/^Përgatit dosjen · TEAM DEMO/})).toBeVisible();
 await page.goto('/workzone/offices/me');await expect(page.getByTestId('office-space')).toBeVisible();
 for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const [width,height] of [[1440,1000],[390,844],[320,740],[760,360],[640,360]]){await page.setViewportSize({width,height});await page.reload();await expect(page.getByTestId('office-space')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await verifyRoomTargets(page,width,height);await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/room-${theme}-${width}.png`});}}
 await page.setViewportSize({width:390,height:844});await page.getByTestId('office-space').getByRole('link',{name:'Plani ditor',exact:true}).click();await expect(page.getByTestId('plan-close')).toHaveAttribute('href','/workzone/offices/me');await page.getByTestId('plan-close').click();
 await prisma.officeTask.deleteMany({where:{companyProfileId:companyId,title:'Përgatit dosjen · TEAM DEMO'}});
 await login(context,'admin','office-e2e-megi');await page.goto('/workzone/offices/team');await page.getByRole('searchbox').fill('Lea');await page.getByRole('button',{name:/^Lea Demo (—|Projektim)/}).click();await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/team-light-390.png`});
 await page.getByLabel('Lejo hyrjen me llogarinë ekzistuese').uncheck();await page.getByRole('button',{name:'Ruaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('Zyra u ruajt');
 await login(context,'worker',worker.id);await page.goto('/workzone/offices/me/tasks');await expect(page.getByTestId('office-work')).toHaveCount(0);expect(errors).toEqual([]);
});

test('reception doors and manager preview keep employee permissions and private data separate',async({page,context})=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const out=process.env.OFFICE_EVIDENCE_DIR!;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(context,'admin','office-e2e-megi');
 await prisma.officeMember.update({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:'office-team-demo-worker'}},data:{enabled:true,workbooksEnabled:true}});
 const member=await prisma.officeMember.findUniqueOrThrow({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:'office-team-demo-worker'}}});
 const site=await prisma.baustelle.upsert({where:{id:'office-drawer-site'},update:{},create:{id:'office-drawer-site',companyProfileId:companyId,name:'Dosja e fabrikës · DEMO',documents:[],type:'STEEL_ASSEMBLY'}});
 await prisma.accessGrant.upsert({where:{companyProfileId_place_scopeId_workerId:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:'office-team-demo-worker'}},update:{level:'act'},create:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:'office-team-demo-worker',level:'act'}});
 for(const [i,name]of ['Ada','Beni','Dora','Ema','Fani','Gerti','Hana','Ina','Joni','Klea','Lira'].entries()){
  const worker=await prisma.worker.upsert({where:{id:`office-hall-demo-${i}`},update:{status:'active'},create:{id:`office-hall-demo-${i}`,firstName:name,lastName:'Demo',companyProfileId:companyId}});
  await prisma.officeMember.upsert({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:worker.id}},update:{enabled:false},create:{companyProfileId:companyId,workerId:worker.id,title:'Zyrë · DEMO',enabled:false}});
 }
 for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const[width,height]of[[1440,1000],[390,844],[320,740],[760,360],[640,360]]){await page.setViewportSize({width,height});await page.goto('/workzone/offices');if(process.env.OFFICE_BASELINE!=='true'){const room=page.getByTestId('office-space');await expect(room).toBeVisible();expect(await room.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}const bottoms=await page.locator('[data-office-entrance]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>r.bottom));expect(Math.max(...bottoms)-Math.min(...bottoms)).toBeLessThan(1);const corridor=page.getByTestId('office-hallway');expect(await corridor.evaluate(el=>el.scrollWidth>el.clientWidth&&getComputedStyle(el).scrollbarWidth==='none')).toBe(true);await page.screenshot({path:`${out}/reception-${process.env.OFFICE_BASELINE==='true'?'before':'after'}-${theme}-${width}.png`});}}
 if(process.env.OFFICE_BASELINE==='true')return;
 await page.setViewportSize({width:390,height:844});
 await page.goto('/workzone/offices');const corridor=page.getByTestId('office-hallway');await corridor.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>corridor.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
 await corridor.hover();const beforeWheel=await corridor.evaluate(el=>el.scrollLeft);await page.mouse.wheel(0,300);await expect.poll(()=>corridor.evaluate(el=>el.scrollLeft)).toBeGreaterThan(beforeWheel);
 const box=await corridor.boundingBox();const url=page.url();if(!box)throw Error('No corridor');await page.mouse.move(box.x+box.width*.8,box.y+box.height*.8);await page.mouse.down();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.8,{steps:8});await page.mouse.up();await expect(page).toHaveURL(url);
 await page.getByText('Zgjidh zyrën',{exact:true}).click();await page.getByTestId('office-directory').getByRole('link',{name:/Lea Demo/}).click();await expect(page.getByTestId('office-preview-notice')).toBeVisible();
 await expect(page.getByTestId('office-space').getByRole('link',{name:'Posta',exact:true})).toHaveCount(0);
 await page.getByTestId('office-space').getByRole('link',{name:/Dosjet e kantiereve/}).first().click();await expect(page.getByTestId('office-preview-panel')).toContainText('Dosja e fabrikës · DEMO');await expect(page.getByRole('button',{name:/Ngarko/})).toHaveCount(0);
 await page.goto(`/workzone/offices/people/${member.id}?view=workbooks`);await page.getByTestId('office-preview-panel').locator('a[href*="worker=office-team-demo-worker"]').click();await expect(page.getByTestId('timesheet-days')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByTestId('office-preview-panel')).toHaveCount(0);
 await page.goto(`/workzone/offices/people/${member.id}?view=tasks`);await expect(page.getByTestId('office-preview-panel')).toBeVisible();
 await page.goto(`/workzone/offices/people/${member.id}`);await page.screenshot({path:`${out}/employee-preview-dark-390.png`});
 await prisma.officeMember.update({where:{id:member.id},data:{enabled:false}});await page.goto('/workzone/offices');await page.getByText('Zgjidh zyrën',{exact:true}).click();await page.getByTestId('office-directory').getByRole('link',{name:/Lea Demo/}).click();await expect(page.getByTestId('office-preview-notice')).toContainText('Pa hyrje');
 await login(context,'worker','office-team-demo-worker');await page.goto(`/workzone/offices/people/${member.id}?view=tasks`);await expect(page.getByTestId('office-preview-panel')).toHaveCount(0);
 expect(errors).toEqual([]);
});





test('office drawers show workbooks and upload into the existing permitted site folder',async({page,context})=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const out=process.env.OFFICE_EVIDENCE_DIR!;const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const worker=await prisma.worker.findUniqueOrThrow({where:{id:'office-team-demo-worker'}});
 await prisma.worker.update({where:{id:worker.id},data:{crewRole:'OFFICE',accessLevel:'BASE'}});
 const member=await prisma.officeMember.update({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId:worker.id}},data:{enabled:true,workbooksEnabled:true}});
 await prisma.workSession.upsert({where:{id:'office-drawer-session'},update:{},create:{id:'office-drawer-session',workerId:worker.id,startTime:new Date('2026-11-10T07:00:00Z'),endTime:new Date('2026-11-10T15:00:00Z'),totalHours:7.5,breakMinutes:30}});
 const site=await prisma.baustelle.upsert({where:{id:'office-drawer-site'},update:{},create:{id:'office-drawer-site',companyProfileId:companyId,name:'Dosja e fabrikës · DEMO',documents:[],type:'STEEL_ASSEMBLY'}});
 await prisma.accessGrant.upsert({where:{companyProfileId_place_scopeId_workerId:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:worker.id}},update:{level:'act'},create:{companyProfileId:companyId,place:'site',scopeId:site.id,workerId:worker.id,level:'act'}});
 await prisma.siteFile.deleteMany({where:{baustelleId:site.id}});
 await login(context,'worker',worker.id);await context.addCookies([{name:'bk_theme',value:'light',url:baseURL}]);await page.setViewportSize({width:390,height:844});await page.goto('/workzone/offices/me');
 await expect(page.getByTestId('office-space')).toBeVisible();await page.screenshot({path:`${out}/drawer-light-390.png`});await page.locator('a[href="/workzone/offices/me/workbooks"]').filter({visible:true}).first().click();
 await expect(page.getByRole('heading',{name:'Fletoret e punëtorëve'})).toBeVisible();await page.getByLabel('Kërko punonjës').fill('Lea');await page.getByRole('button',{name:'Shfaq',exact:true}).click();await expect(page.getByRole('row',{name:/Lea Demo/})).toContainText('7.50');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${out}/workbooks-light-390.png`});await page.getByRole('row',{name:/^Lea Demo/}).getByRole('link',{name:'Hap',exact:true}).click();await expect(page).toHaveURL(/worker=office-team-demo-worker/);await expect(page.getByTestId('timesheet-days')).toBeVisible();await page.screenshot({path:`${out}/workbook-light-390.png`});
 await page.goto('/workzone/offices/me/resources');await page.getByRole('link',{name:'Hap dosjen',exact:true}).click();await page.getByTestId('office-native-files').getByRole('button',{name:/Dokumentet/}).click();
 await page.locator('input[type=file][accept*=".docx"]').setInputFiles({name:'Nga-zyra-DEMO.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSynthetic only\n%%EOF')});await expect(page.getByText('Nga-zyra-DEMO.pdf',{exact:true})).toBeVisible();expect(await prisma.siteFile.count({where:{baustelleId:site.id,fileName:'Nga-zyra-DEMO.pdf'}})).toBe(1);await page.screenshot({path:`${out}/office-upload-light-390.png`});
 for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const [width,height]of[[1440,1000],[390,844],[320,740],[760,360],[640,360]]){await page.setViewportSize({width,height});await page.goto('/workzone/offices/me/resources');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${out}/resources-${theme}-${width}.png`});}}
 await prisma.officeMember.update({where:{id:member.id},data:{workbooksEnabled:false}});await page.goto('/workzone/offices/me/workbooks');await expect(page.getByRole('heading',{name:'Fletoret e punëtorëve'})).toHaveCount(0);expect(pageErrors).toEqual([]);
});

test('purchasing office opens project folders and a separate personal offer assistant',async({page,context})=>{
 test.setTimeout(120000);assertE2ETestDatabase(process.env);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const workerId='office-team-demo-worker',siteId='office-drawer-site';
 const member=await prisma.officeMember.update({where:{companyProfileId_workerId:{companyProfileId:companyId,workerId}},data:{enabled:true,workProfile:'PURCHASING',assistantEnabled:true,workbooksEnabled:true}});
 await prisma.siteFile.deleteMany({where:{companyProfileId:companyId,baustelleId:siteId,fileName:'Offer-DEMO.csv'}});
 const csv=Buffer.from('Material,Quantity,Price\nSteel,10,25\n');const file=await prisma.siteFile.create({data:{companyProfileId:companyId,baustelleId:siteId,kind:'document',fileName:'Offer-DEMO.csv',mime:'text/csv',size:csv.length,data:csv}});
 await prisma.worker.update({where:{id:workerId},data:{firstName:'Saoirse Alexandria',lastName:'Demo'}});
 await login(context,'worker',workerId);await page.setViewportSize({width:390,height:844});await context.addCookies([{name:'bk_theme',value:'light',url:baseURL}]);
 await page.goto('/workzone/offices/me');for(const theme of ['light','dark']){await context.addCookies([{name:'bk_theme',value:theme,url:baseURL}]);for(const [width,height] of [[1440,1000],[390,844],[320,740],[760,360],[640,360]]){await page.setViewportSize({width,height});await page.reload();await verifyRoomTargets(page,width,height);await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/studio-full-${theme}-${width}.png`});}}await page.setViewportSize({width:390,height:844});
 await page.goto('/workzone/offices/me');await page.getByTestId('office-space').getByRole('link',{name:'Projektet & blerjet',exact:true}).click();await expect(page.getByRole('heading',{name:'Projektet & blerjet'})).toBeVisible();
 await page.goto('/workzone/offices/me');await page.getByTestId('office-space').getByRole('link',{name:'Asistenti personal',exact:true}).click();await expect(page.getByTestId('office-personal-ai')).toBeVisible();
 await page.getByRole('combobox',{name:'Projekti',exact:true}).selectOption(siteId);await expect(page).toHaveURL(new RegExp(`site=${siteId}`));await page.getByText('Zgjidh dokumentet / ofertat (deri 3)',{exact:true}).click();await page.getByLabel('Offer-DEMO.csv',{exact:true}).check();
 const requestIds:string[]=[];await page.route('**/api/offices/assistant',async route=>{const body=route.request().postDataJSON();expect(body.siteId).toBe(siteId);expect(body.fileIds).toEqual([file.id]);expect(body.memberId).toBeUndefined();requestIds.push(body.requestId);if(requestIds.length===1){await route.abort();return;}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:body.requestId,status:'completed',answer:'Offer-DEMO.csv: mungon baza e TVSH-së.'})});});
 await page.getByLabel('Pyetja',{exact:true}).fill('Krahaso ofertën e zgjedhur.');await page.getByRole('button',{name:'Dërgo',exact:true}).click();await expect(page.getByRole('status')).toContainText('Lidhja u ndërpre');await page.getByRole('button',{name:'Dërgo',exact:true}).click();await expect.poll(()=>requestIds.length).toBe(2);expect(requestIds[0]).toBe(requestIds[1]);await expect(page.getByText('Offer-DEMO.csv: mungon baza e TVSH-së.',{exact:true})).toBeVisible();
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);for(const [width,height]of [[1440,1000],[390,844],[320,740],[760,360],[640,360]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${process.env.OFFICE_EVIDENCE_DIR}/purchasing-ai-${theme}-${width}.png`});}}
 await page.unroute('**/api/offices/assistant');await prisma.officeMember.update({where:{id:member.id},data:{assistantEnabled:false}});await page.goto('/workzone/offices/me/assistant');await expect(page.getByTestId('office-personal-ai')).toHaveCount(0);
 const denied=await page.request.post('/api/offices/assistant',{headers:{Origin:baseURL},data:{requestId:crypto.randomUUID(),conversationId:crypto.randomUUID(),message:'No access',fileIds:[]}});expect(denied.status()).toBe(403);expect(errors).toEqual([]);
});
