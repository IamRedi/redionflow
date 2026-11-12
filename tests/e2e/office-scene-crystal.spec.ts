import {expect,test} from '@playwright/test';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {prisma} from '../../src/lib/db/prisma';
import {createSessionCookie} from '../../src/lib/auth/session-cookie';
import {assertE2ETestDatabase} from '../../scripts/lib/e2e-target';

test('office scene lettering, work surfaces and company assistant retain identity and private archives',async({page,context},info)=>{
 test.skip(process.env.VIRTUAL_OFFICE_WORK_ENABLED!=='true'||!process.env.VIRTUAL_OFFICE_ACCESS_JSON?.includes('office-e2e-megi'),'Requires the isolated office fixture configuration.');
 test.setTimeout(240000);assertE2ETestDatabase(process.env);
 const baseline=process.env.OFFICE_UI_BASELINE==='true',phase=baseline?'before':'after',out=process.env.OFFICE_EVIDENCE_DIR??info.outputPath('evidence'),base=String(info.project.use.baseURL);mkdirSync(out,{recursive:true});
 const companyId='office-e2e-company',ids=['office-e2e-megi','office-e2e-almet'];
 expect(Boolean(process.env.OPENAI_API_KEY?.trim())).toBe(false);
 await prisma.companyProfile.upsert({where:{id:companyId},update:{mode:'bau',assistantAccessSelected:true},create:{id:companyId,displayName:'Office Studio · DEMO',legalName:'Synthetic office UI only',mode:'bau',assistantAccessSelected:true}});
 for(const [i,id]of ids.entries()){
  await prisma.user.upsert({where:{id},update:{isActive:true,assistantAccess:true},create:{id,companyProfileId:companyId,name:i?'Director · DEMO':'Office · DEMO',email:`office-ui-${i}@example.test`,role:'ADMIN',assistantAccess:true}});
  const conversation=await prisma.assistantConversation.upsert({where:{id:`office-ui-history-${i}`},update:{},create:{id:`office-ui-history-${i}`,companyProfileId:companyId,adminId:id,title:`Bisedë private ${i} · DEMO`}});
  await prisma.assistantRun.upsert({where:{id:`office-ui-run-${i}`},update:{},create:{id:`office-ui-run-${i}`,companyProfileId:companyId,adminId:id,conversationId:conversation.id,question:`Pyetje private ${i} · DEMO`,answer:`Përgjigje private ${i} · DEMO`,status:'completed',finishedAt:new Date()}});
 }
 await prisma.worker.upsert({where:{id:'office-e2e-worker-megi'},update:{status:'active'},create:{id:'office-e2e-worker-megi',companyProfileId:companyId,firstName:'Office',lastName:'Demo',crewRole:'OFFICE'}});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const colors:Record<string,string>={};
 async function login(id:string){const user=await prisma.user.findUniqueOrThrow({where:{id}});await context.clearCookies();await context.addCookies([{name:'bk_admin_id',value:await createSessionCookie('admin',id,user.sessionEpoch),url:base},{name:'bk_lang',value:'sq',url:base}]);}
 await login(ids[0]);
 for(const[width,height,theme]of[[1440,900,'light'],[390,844,'dark'],[320,740,'light'],[760,390,'dark']]as const){
  await page.setViewportSize({width,height});await context.addCookies([{name:'bk_theme',value:theme,url:base}]);
  await page.goto('/workzone/offices/me');await expect(page.getByTestId('office-interior')).toBeVisible();
  const documents=page.getByTestId('office-interior').locator('a[href="/workzone/offices/me/resources"]');
  await expect(documents).toBeVisible();await expect(documents).toHaveAttribute('aria-label',/\S/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(!baseline){
   const etch=page.locator('[data-office-etching]').first();expect(await etch.evaluate(e=>{const s=getComputedStyle(e);return[s.backgroundColor,s.borderTopWidth,s.boxShadow];})).toEqual(['rgba(0, 0, 0, 0)','0px','none']);
   expect(await documents.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({path:`${out}/${phase}-room-${width}-${theme}.png`});
  await page.getByRole('link',{name:'Asistenti i firmës',exact:true}).click();
  if(!baseline){
   const dialog=page.getByRole('dialog',{name:'Asistenti i firmës',exact:true});await expect(dialog).toBeVisible();
   const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
   if(width>=1000){const monitor=await page.locator('[data-office-object=assistant]').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(monitor!.x+monitor!.width);}
   await expect(dialog.getByText('Përgjigje private 0 · DEMO',{exact:true})).toBeVisible();
   await expect(dialog.getByText('Përgjigje private 1 · DEMO',{exact:true})).toHaveCount(0);
   await dialog.locator('[data-chat-compose] input').fill('Draft · DEMO');
   const send=dialog.locator('[data-chat-compose] button[type=submit]');await expect(send).toHaveAttribute('aria-label',/\S/);await send.focus();
  }
  if(baseline)await expect(page.getByText('Përgjigje private 0 · DEMO',{exact:true})).toBeVisible();
  await page.screenshot({path:`${out}/${phase}-assistant-${width}-${theme}.png`});
  if(!baseline){await page.keyboard.press('Escape');await expect(page).toHaveURL(/\/offices\/me#office-assistant$/);await expect(page.locator('#office-assistant')).toBeFocused();}
  for(const view of ['mail','tasks','resources','workbooks']){
   await page.goto(`/workzone/offices/me/${view}`);
   if(!baseline){await expect(page.locator('[data-office-view]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
   const primary=page.getByRole('button',{name:'Shkruaj',exact:true});
   if(await primary.count())colors[`${width}-${theme}-${view}`]=await primary.evaluate(e=>getComputedStyle(e).getPropertyValue('--primary').trim());
   await page.screenshot({path:`${out}/${phase}-${view}-${width}-${theme}.png`});
  }
 }
 writeFileSync(`${out}/${phase}-primary-colors.json`,JSON.stringify(colors,null,2));
 if(!baseline){
  if(existsSync(`${out}/before-primary-colors.json`))expect(colors).toEqual(JSON.parse(readFileSync(`${out}/before-primary-colors.json`,'utf8')));
  // The long editor scrolls inside the office; its actions remain reachable.
  for(const [width,height] of [[390,844],[760,390]] as const){
   await page.setViewportSize({width,height});await page.goto('/workzone/offices/me/tasks');
   await page.getByRole('button',{name:'Shto',exact:true}).click();
   await page.getByRole('button',{name:'Ruaj',exact:true}).scrollIntoViewIfNeeded();
   await expect(page.getByRole('button',{name:'Ruaj',exact:true})).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   expect(await page.evaluate(()=>document.scrollingElement!.scrollTop)).toBe(0);
   const credit=page.locator('[data-office-scroll] a[aria-label="by RediON"]');await credit.scrollIntoViewIfNeeded();await expect(credit).toBeInViewport();
   expect(await page.locator('[data-office-scroll]').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
   await page.screenshot({path:`${out}/after-task-editor-${width}.png`});
  }
  await page.goto('/workzone/plan?office=desk');await expect(page.getByTestId('plan-close')).toHaveAccessibleName('Zyra ime');await expect(page.getByTestId('plan-close')).toBeVisible();await page.screenshot({path:`${out}/after-plan-760-dark.png`});
  await page.setViewportSize({width:390,height:844});await page.goto('/workzone/offices/me/assistant');
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  await expect.poll(()=>page.getByRole('dialog',{name:'Asistenti i firmës',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport!;return r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width+1&&r.bottom<=v.offsetTop+v.height+1;})).toBe(true);
  const zoom=await page.getByRole('dialog',{name:'Asistenti i firmës',exact:true}).evaluate(e=>{const v=visualViewport!,compose=e.querySelector('[data-chat-compose]')!.getBoundingClientRect();return{view:{width:v.width,height:v.height,top:v.offsetTop},compose:{top:compose.top,bottom:compose.bottom},dialog:{top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom},scroll:e.scrollHeight,client:e.clientHeight};});writeFileSync(`${out}/zoom-metrics.json`,JSON.stringify(zoom,null,2));expect(zoom.compose.bottom).toBeLessThanOrEqual(zoom.view.top+zoom.view.height+1);
  await page.screenshot({path:`${out}/after-assistant-zoom.png`});await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await cdp.detach();
  await page.setViewportSize({width:1440,height:900});await login(ids[1]);await page.goto('/workzone');
  await expect(page.getByRole('button',{name:'Hap asistentin admin',exact:true})).toHaveCount(0);
  await page.goto('/workzone/offices/me/assistant');const dialog=page.getByRole('dialog',{name:'Asistenti i firmës',exact:true});
  await expect(dialog.getByText('Përgjigje private 1 · DEMO',{exact:true})).toBeVisible();await expect(dialog.getByText('Përgjigje private 0 · DEMO',{exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await page.goto('/workzone/offices/megi');
  await expect(page.locator('[data-office-object]')).toHaveCount(0);
  await prisma.user.update({where:{id:ids[1]},data:{assistantAccess:false}});await page.goto('/workzone/offices/me/assistant');
  await expect(page.getByTestId('assistant-no-access')).toBeVisible();await expect(page.locator('[data-chat-compose]')).toHaveCount(0);
  await prisma.user.update({where:{id:ids[1]},data:{assistantAccess:true}});
  const outsider=await prisma.user.upsert({where:{id:'office-e2e-other-admin'},update:{isActive:true},create:{id:'office-e2e-other-admin',companyProfileId:companyId,name:'Other admin · DEMO',email:'office-ui-other@example.test',role:'ADMIN',assistantAccess:true}});
  await login(outsider.id);await page.goto('/workzone');await expect(page.getByRole('button',{name:'Hap asistentin admin',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
 }
});
