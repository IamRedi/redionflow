/* Same acceptance contract for the three explicitly isolated Muster previews. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const profile=process.env.MUSTER_CHAT_PROFILE,base=process.env.MUSTER_CHAT_BASE_URL,out=process.env.MUSTER_CHAT_EVIDENCE;
const check=(ok,why)=>{if(!ok)throw new Error(why);};
check(process.env.MUSTER_CHAT_TEST==='1' && ['crane','bauflow','baumdienst'].includes(profile),'Explicit Muster fixture required');
check(['127.0.0.1','localhost'].includes(new URL(base).hostname)&&process.env.APP_ENV==='local'&&out,'Owned loopback preview required');
const baum=profile==='baumdienst',home=baum?'/demo/workzone':'/workzone',records=[],errors=[];
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({args:['--disable-dev-shm-usage']});let current;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'de-DE',reducedMotion:'reduce'});
  await context.addCookies([{name:'bk_lang',value:'de',url:base},{name:'bk_theme',value:'light',url:base}]);
  await context.addInitScript(()=>{window.__headerDocument=crypto.randomUUID();});
  const page=await context.newPage();current=page;page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(baum?home:'/muster'));
  if(!baum){await page.locator('[data-demo-role=owner]').click();await page.waitForURL('**/workzone');}
  const brand=page.locator('[data-company-chat-brand]'),utilities=page.getByTestId('muster-header-utilities'),menu=page.getByTestId('muster-profile'),flag=page.getByTestId('muster-language-cycle'),theme=page.getByTestId('muster-theme-toggle');
  await expect(brand).toBeEnabled();
  async function checkHeader(name){
   await expect(brand).toBeVisible();await expect(utilities).toBeVisible();
   check(await page.getByTestId('company-chat-trigger').count()===1,'Duplicate visible chat controller');
   check(await utilities.locator(':scope > *').count()===3,'Utilities must be exactly profile/theme/language');
   check(await page.locator('[data-muster-profile-panel] .lucide-bell').count()===1,'Bell must be inside personal profile');
   check(await page.locator('header .lucide-bell').count()===1,'Duplicate notification control');
   const viewport=page.viewportSize();
   for(const el of [brand,menu.locator('summary'),flag,theme]){await expect(el).toBeInViewport();const b=await el.boundingBox();check(b.width>=44&&b.height>=44,'Lost touch target');check(b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,'Header control clipped');}
   check(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'Horizontal overflow');
   await page.evaluate(async()=>{await document.fonts.ready;});
   if(new URL(page.url()).pathname===home){
    await expect(page.locator('main img').first()).toBeVisible();
    await expect.poll(()=>page.locator('main img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
   }
   await page.screenshot({path:path.join(out,name+'.png')});records.push(name);
  }
  await checkHeader(profile+'-header-desktop-light');
  const documentToken=await page.evaluate(()=>window.__headerDocument);
  // Locale changes leave the current chat draft and document intact through every supported flag.
  await brand.click();const dialog=page.getByTestId('company-chat-dialog');await expect(dialog).toBeVisible();
  const draft=dialog.locator('textarea');await draft.fill('Unsaved header acceptance draft');await page.keyboard.press('Escape');
  for(const lang of ['en','sq','it','pl','ro','de']){
   await flag.click();await expect(flag).toHaveAttribute('data-language',lang);await expect(page.locator('html')).toHaveAttribute('lang',lang);
   check(await page.evaluate(()=>window.__headerDocument)===documentToken,'Locale forced document reload');
   check(await page.locator('[role=listbox], [data-language-menu]').count()===0,'Flag opened a language menu');
  }
  await brand.click();await expect(draft).toHaveValue('Unsaved header acceptance draft');await page.keyboard.press('Escape');
  await menu.locator('summary').click();await expect(menu.locator('[data-muster-profile-panel]')).toBeVisible();
  await page.screenshot({path:path.join(out,profile+'-profile-desktop.png')});
  // A profile notification trigger can open its portal and close without hiding the rest of the app.
  await menu.locator('button').filter({has:page.locator('.lucide-bell')}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  if(await menu.getAttribute('open')!==null) await menu.locator('summary').click();
  await theme.click();await expect(page.locator('html')).toHaveClass(/dark/);await expect(theme).toBeEnabled();
  check(await page.evaluate(()=>window.__headerDocument)===documentToken,'Theme reloaded document');
  await brand.click();await expect(draft).toHaveValue('Unsaved header acceptance draft');await page.keyboard.press('Escape');
  await checkHeader(profile+'-header-desktop-night');
  for(const [width,height]of[[390,844],[320,640],[760,360]]){
   await page.setViewportSize({width,height});await page.goto(base+home);await expect(brand).toBeEnabled();
   await checkHeader(profile+'-header-'+width+'-night');
   await menu.locator('summary').click();const panel=menu.locator('[data-muster-profile-panel]');await expect(panel).toBeVisible();
   const b=await panel.boundingBox();check(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'Profile escaped viewport');
   const last=panel.locator('a,button,select').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
   await page.screenshot({path:path.join(out,profile+'-profile-'+width+'.png')});await page.keyboard.press('Escape');
   await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).not.toHaveClass(/dark/);await checkHeader(profile+'-header-'+width+'-light');
   await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).toHaveClass(/dark/);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+(baum?'/demo/workshop?tab=tools':'/workzone/inventory'));await expect(brand).toBeEnabled();
  await checkHeader(profile+'-inventory-phone-night');
  await flag.click();await expect(page.locator('html')).toHaveAttribute('lang','en');await page.reload();await expect(flag).toHaveAttribute('data-language','en');await expect(page.locator('html')).toHaveClass(/dark/);
  // Request failure reports once and never blindly repeats a cookie toggle.
  let posts=0;const fail=async r=>{posts++;await r.abort();};await page.route('**/app/toggle-theme',fail);
  await theme.click();await expect(utilities.getByRole('alert')).toBeVisible();await expect(theme).toBeEnabled();check(posts===1,'Theme POST retried');
  await page.unroute('**/app/toggle-theme',fail);await theme.click();await expect(theme).toBeEnabled();await expect(page.locator('html')).not.toHaveClass(/dark/);
  check(errors.length===0,'Page errors: '+errors.join('; '));
  await context.close();fs.writeFileSync(path.join(out,'header-acceptance.json'),JSON.stringify({profile,status:'PASS',records,errors},null,2));
 }catch(e){if(current)await current.screenshot({path:path.join(out,'header-failure.png')}).catch(()=>{});throw e;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'header-browser-release.json'),JSON.stringify({connected:browser.isConnected(),contexts:browser.contexts().length}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
