/* Shared local acceptance: one global theme action, personal actions in own profiles. */
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const profile=process.env.MUSTER_CHAT_PROFILE,base=process.env.MUSTER_CHAT_BASE_URL,out=process.env.MUSTER_CHAT_EVIDENCE;
const check=(ok,why)=>{if(!ok)throw new Error(why);};
check(process.env.MUSTER_CHAT_TEST==='1'&&['crane','bauflow','baumdienst'].includes(profile),'Explicit Muster fixture required');
check(['127.0.0.1','localhost'].includes(new URL(base).hostname)&&process.env.APP_ENV==='local'&&out,'Owned loopback preview required');
const baum=profile==='baumdienst',home=baum?'/demo/workzone':'/workzone',personal=baum?'/demo/control':'/app/profile',records=[],errors=[];
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({args:['--disable-dev-shm-usage']});let current;
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'de-DE',reducedMotion:'reduce'});
 await ctx.addCookies([{name:'bk_lang',value:'de',url:base},{name:'bk_theme',value:'light',url:base}]);
 await ctx.addInitScript(()=>{window.__headerDocument=crypto.randomUUID();});
 const page=await ctx.newPage();current=page;page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+(baum?home:'/muster'));
 if(!baum){await page.locator('[data-demo-role=owner]').click();await page.waitForURL('**/workzone');}
 const brand=page.locator('[data-company-chat-brand]'),utilities=page.getByTestId('muster-header-utilities'),flag=page.getByTestId('muster-language-cycle'),theme=page.getByTestId('muster-theme-toggle'),tools=page.getByTestId('muster-profile-tools');
 async function ready(target){await target.evaluate(async()=>{await document.fonts.ready;});await expect.poll(()=>target.locator('main img:visible,[data-company-chat-brand] img:visible').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);}
 async function shot(name){await ready(page);await page.screenshot({path:path.join(out,name+'.png')});records.push(name);}
 async function header(name){
  await expect(brand).toBeEnabled();await expect(utilities).toBeVisible();
  check(await page.getByTestId('company-chat-trigger').count()===1,'Duplicate common-header chat');
  check(await utilities.locator('button').count()===1,'Only Day/Night belongs in right utilities');
  check(await utilities.locator('a,select,summary').count()===0,'Personal action leaked to right utilities');
  await expect(utilities.getByTestId('muster-language-cycle')).toHaveCount(0);
  await expect(page.locator('[data-demo-profile]')).toHaveCount(0);
  const vp=page.viewportSize();
  for(const el of [brand,theme]){await expect(el).toBeInViewport();const b=await el.boundingBox();check(b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=vp.width+1&&b.y+b.height<=vp.height+1,'Header touch action clipped');}
  check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'Horizontal overflow');
  await shot(name);
 }
 async function personalActions(name){
  await expect(tools).toBeVisible();await expect(flag).toBeVisible();
  check(await flag.evaluate(el=>!el.closest('header[data-testid="admin-topbar"],header[data-testid="flow-topbar"],[data-testid="baum-demo-topbar"]')),'Language remained in global header');
  const notification=baum?tools.locator('button').filter({has:page.locator('.lucide-bell')}):tools.getByTestId('notification-prefs');
  await expect(notification).toHaveCount(1);await notification.click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  if(!baum)await expect(dialog.getByTestId('notification-test-all')).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(notification).toBeFocused();
  for(const el of await tools.locator('a,button,select').all()){
   await el.scrollIntoViewIfNeeded();await expect(el).toBeInViewport();const b=await el.boundingBox(),vp=page.viewportSize();check(b.height>=44&&b.width>=44&&b.x>=0&&b.x+b.width<=vp.width+1,'Personal action clipped');
  }
  await shot(name);
 }
 await header(profile+'-header-desktop-light');
 await page.goto(base+(baum?'/demo/offices/manager':'/workzone/offices/me'));await page.getByTestId('office-control-panel').click();
 if(!baum)await page.locator('nav a[href="/app/profile"]').click();
 await personalActions(profile+'-personal-desktop-light');
 const token=await page.evaluate(()=>window.__headerDocument);
 await brand.click();const dialog=page.getByTestId('company-chat-dialog');await expect(dialog).toBeVisible();const draft=dialog.locator('textarea');await draft.fill('Unsaved personal-settings draft');await page.keyboard.press('Escape');
 for(const lang of ['en','sq','it','pl','ro','de']){
  await flag.click();await expect(flag).toHaveAttribute('data-language',lang);await expect(page.locator('html')).toHaveAttribute('lang',lang);
  check(await page.evaluate(()=>window.__headerDocument)===token,'Language forced document reload');
 }
 await brand.click();await expect(draft).toHaveValue('Unsaved personal-settings draft');await page.keyboard.press('Escape');
 await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).toHaveClass(/dark/);
 check(await page.evaluate(()=>window.__headerDocument)===token,'Theme forced document reload');
 await brand.click();await expect(draft).toHaveValue('Unsaved personal-settings draft');await page.keyboard.press('Escape');
 for(const [width,height]of[[1440,900],[390,844],[320,640],[760,360]]){
  await page.setViewportSize({width,height});await page.goto(base+home);await header(profile+'-header-'+width+'-night');
  await page.goto(base+personal);await personalActions(profile+'-personal-'+width+'-night');
  await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.goto(base+home);await header(profile+'-header-'+width+'-light');
  await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).toHaveClass(/dark/);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+(baum?'/demo/workshop?tab=tools':'/workzone/inventory'));await header(profile+'-inventory-phone-night');
 await page.goto(base+personal);await flag.click();await expect(flag).toHaveAttribute('data-language','en');await page.reload();await expect(flag).toHaveAttribute('data-language','en');await expect(page.locator('html')).toHaveClass(/dark/);
 let posts=0;const fail=async r=>{posts++;await r.abort();};await page.route('**/app/toggle-theme',fail);
 await theme.click();await expect(utilities.getByRole('alert')).toBeVisible();await expect(theme).toBeEnabled();check(posts===1,'Theme POST blindly repeated');
 await page.unroute('**/app/toggle-theme',fail);await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).not.toHaveClass(/dark/);
 // A field worker reaches their own tools through their team avatar, not a new floating profile icon.
 const workerContext=await browser.newContext({viewport:{width:390,height:844},locale:'de-DE',reducedMotion:'reduce'}),workerPage=await workerContext.newPage();
 await workerContext.addCookies([{name:'bk_lang',value:'de',url:base}]);
 if(baum){
  await workerPage.goto(base+personal);const select=workerPage.getByTestId('muster-profile-tools').locator('select');await expect(select).toBeEnabled();
  const key=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(key);await expect(select).toHaveValue(key);await workerPage.goto(base+home);
 }else{await workerPage.goto(base+'/muster');await workerPage.locator('[data-demo-role=field]').click();await workerPage.waitForURL('**/workzone');}
 await workerPage.locator(baum?'[data-testid="baum-team-strip"] button':'[data-testid="flow-team-strip"] button').first().click();
 await workerPage.waitForURL(baum?'**/demo/workers/*':'**/workzone/profile');
 await expect(workerPage.getByTestId('muster-profile-tools')).toBeVisible();await expect(workerPage.getByTestId('muster-language-cycle')).toBeVisible();
 await expect(workerPage.getByTestId('notification-test-all')).toHaveCount(0);
 await ready(workerPage);await workerPage.screenshot({path:path.join(out,profile+'-worker-personal-phone.png')});records.push(profile+'-worker-personal-phone');
 if(baum){
  const actorOptions=workerPage.getByTestId('muster-profile-tools').locator('select option');const other=await actorOptions.nth(2).getAttribute('value');
  const response=await workerPage.request.get(base+'/api/demo/baumdienst/workshop');const data=await response.json();const id=data.directory.workers.find(w=>w.key===other).id;
  await workerPage.goto(base+'/demo/workers/'+id);await expect(workerPage.getByTestId('muster-profile-tools')).toHaveCount(0);
 }
 await workerContext.close();await ctx.close();check(errors.length===0,'Page errors: '+errors.join('; '));
 fs.writeFileSync(path.join(out,'header-acceptance.json'),JSON.stringify({profile,status:'PASS',records,errors,physicalPhone:'NOT_VERIFIED'},null,2));
 console.log(JSON.stringify({profile,status:'PASS',captures:records.length}));
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:path.join(out,'header-failure.png')}).catch(()=>{});throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'header-browser-release.json'),JSON.stringify({connected:browser.isConnected(),contexts:browser.contexts().length}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
