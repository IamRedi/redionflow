/* Direct local acceptance probe: explicit isolated Muster fixtures only. */
const { chromium, expect } = require('@playwright/test');
const { Client } = require('pg');
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const profile = process.env.MUSTER_CHAT_PROFILE, base = process.env.MUSTER_CHAT_BASE_URL, output = process.env.MUSTER_CHAT_EVIDENCE;
const route = profile === 'baumdienst' ? '/demo/workzone' : '/workzone';
const baum = profile === 'baumdienst', records = [], failures = [];
const check = (ok, why) => { if (!ok) throw new Error(why); };
const origin = new URL(base), dbUrl = new URL(process.env.DATABASE_URL);
check(process.env.MUSTER_CHAT_TEST === '1' && ['crane','bauflow','baumdienst'].includes(profile), 'Explicit test fixture required');
check(['127.0.0.1','localhost'].includes(origin.hostname) && origin.protocol === 'http:', 'Loopback preview required');
check(dbUrl.hostname === '127.0.0.1' && ['bauflow_crane_muster_test','baumkalk_e2e','baumkalk_chat_test'].includes(dbUrl.pathname.slice(1)), 'Disposable database required');
check(process.env.APP_ENV === 'local' && process.env.SAAS_MODE === 'false' && output, 'Local fictional installation required');
fs.mkdirSync(output, { recursive: true });

async function main() {
 const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
 const companies = (await db.query('SELECT id,"displayName" FROM "CompanyProfile"')).rows;
 check(companies.length === 1, 'One synthetic company required');
 const company = companies[0];
 check(baum ? company.displayName === 'Baumdienst Musterstadt GmbH' : company.id === (profile === 'crane' ? 'company-rheinruhr-kran-muster' : 'bauflow-muster-steel'), 'Wrong synthetic tenant');
 // Only these new feature tables in the explicitly owned fixture are reset.
 await db.query('DELETE FROM "CompanyChatReader" WHERE "companyProfileId"=$1',[company.id]);
 await db.query('DELETE FROM "CompanyChatMessage" WHERE "companyProfileId"=$1',[company.id]);
 await db.query(`INSERT INTO "CompanyChatMessage" (id,"companyProfileId",seq,"authorKey","authorName","requestId",body,"createdAt") SELECT 'verification-'||n::text,$1,n,'verification:history','History Demo','history-'||n::text,'Synthetic history '||n::text,'2020-01-01'::timestamp FROM generate_series(1,1000) n`,[company.id]);
 const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
 let current;
 const make = async (width,height,theme) => {
  const ctx = await browser.newContext({ viewport: {width,height}, hasTouch: width<700, locale:'de-DE', reducedMotion:'reduce' });
  await ctx.addCookies([{name:'bk_lang',value:'de',url:base},{name:'bk_theme',value:theme,url:base}]);
  const page = await ctx.newPage(); page.on('pageerror',error=>failures.push(error.message)); current=page; return {ctx,page};
 };
 async function enter(page,role) {
  if (!baum) { await page.goto(base+'/muster'); await page.locator(`[data-demo-role=${role}]`).click(); await page.waitForURL('**/workzone'); }
  else {
   await page.goto(base+route); await page.getByTestId('company-chat-trigger').waitFor();
   if (role === 'field') {
    const response = await page.request.get(base+'/api/demo/baumdienst/workshop');
    // The established workshop API path is discovered from the page's public directory.
    const directory = response.ok() ? (await response.json()).directory : null;
    let key = directory?.workers[0]?.key;
    if (!key) {
     await page.goto(base+'/demo/control');const select=page.getByTestId('muster-profile-tools').locator('select');await expect(select).toBeEnabled();
     key=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(key);await expect(select).toHaveValue(key);await page.goto(base+route);
    } else { check((await page.request.post(base+'/api/demo/baumdienst/actor',{data:{key},headers:{Origin:base}})).ok(),'Field persona switch failed'); await page.reload(); }
   }
  }
  await page.getByTestId('company-chat-trigger').first().waitFor();
 }
 async function shot(page,name) {
  await page.evaluate(async()=>{await document.fonts.ready;});
  const dimensions=await page.evaluate(()=>({w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,outer:document.documentElement.scrollHeight>innerHeight+1}));
  check(!dimensions.overflow,'Horizontal overflow: '+name);
  await page.screenshot({path:path.join(output,name+'.png')}); records.push({name,...dimensions});
 }
 async function open(page,trigger=page.getByTestId('company-chat-trigger').first()) {
  await trigger.click(); await page.getByTestId('company-chat-dialog').waitFor();
  await expect(page.locator('[data-message-id]').last()).toBeVisible();
 }
 async function close(page) { await page.keyboard.press('Escape'); await expect(page.getByTestId('company-chat-dialog')).toHaveCount(0); }
 try {
  const owner=await make(1440,900,'light'), worker=await make(390,844,'light');
  await enter(owner.page,'owner'); await enter(worker.page,'field');
  check(await owner.page.locator('header a[href^="/app/dashboard"],header a[href^="/demo/control"],header a[href^="/demo/tv"]').count()===0,'Management action remained in global header');
  check(await owner.page.locator('svg.lucide-megaphone').count()===0,'Legacy announcement trigger remained');
  await shot(owner.page,profile+'-workzone');
  for (const p of [owner.page,worker.page]) {
   await open(p); await expect(p.getByTestId('company-chat-unread')).toHaveCount(0);
   check(await p.locator('[data-message-id]').count()<=40,'Unbounded message DOM'); await close(p);
   check(await p.getByTestId('company-chat-trigger').first().evaluate(el=>el===document.activeElement),'Focus did not return to trigger');
  }
  const text='Muster chat verification / '+randomUUID();
  await open(owner.page); await owner.page.getByRole('textbox').fill(text); await owner.page.getByRole('button',{name:'Senden',exact:true}).click();
  await expect(owner.page.getByText(text,{exact:true})).toBeVisible(); await close(owner.page);
  await expect(worker.page.getByTestId('company-chat-unread')).toHaveText('1',{timeout:40000});
  await expect(worker.page.getByTestId('company-chat-toast')).toBeVisible();
  await worker.page.getByTestId('company-chat-toast').click(); await expect(worker.page.getByText(text,{exact:true})).toBeVisible();
  await expect(worker.page.getByTestId('company-chat-unread')).toHaveCount(0);
  await worker.page.getByRole('textbox').fill(text+' reply'); await worker.page.getByRole('button',{name:'Senden',exact:true}).click(); await expect(worker.page.getByText(text+' reply',{exact:true})).toBeVisible(); await close(worker.page);
  await expect(owner.page.getByTestId('company-chat-unread')).toHaveText('1',{timeout:40000});
  await owner.page.reload(); await expect(owner.page.getByTestId('company-chat-unread')).toHaveText('1'); await open(owner.page);
  const authors=await owner.page.locator('[data-message-id]').filter({hasText:text}).locator('strong').allTextContents();
  check(new Set(authors).size===2,'Sender names were not distinct trusted profiles');
  await expect(owner.page.getByText(text+' reply',{exact:true})).toBeVisible();
  await shot(owner.page,profile+'-chat-desktop-light');
  await close(owner.page);
  // Browsing an older window must not acknowledge a new arrival.
  await open(worker.page); await worker.page.getByRole('button',{name:'Ältere Nachrichten',exact:true}).click();
  await expect(worker.page.getByRole('button',{name:/Zu den neuesten Nachrichten/})).toBeVisible();
  await open(owner.page); await owner.page.getByRole('textbox').fill(text+' later'); await owner.page.getByRole('button',{name:'Senden',exact:true}).click(); await expect(owner.page.getByText(text+' later',{exact:true})).toBeVisible(); await close(owner.page);
  await expect(worker.page.getByTestId('company-chat-unread')).toHaveText('1',{timeout:40000});
  await expect(worker.page.getByText(text+' later',{exact:true})).toHaveCount(0);
  await worker.page.getByRole('button',{name:/Zu den neuesten Nachrichten/}).click(); await expect(worker.page.getByText(text+' later',{exact:true})).toBeVisible(); await expect(worker.page.getByTestId('company-chat-unread')).toHaveCount(0); await close(worker.page);
  // Lose only the response after commit; retry must preserve the draft and save once.
  let lose=true;
  await worker.page.route(/\/api\/(?:company-chat|demo\/baumdienst\/chat)(?:\?|$)/,async r=>{if(lose&&r.request().method()==='POST'&&r.request().postDataJSON()?.type==='send'){lose=false;await r.fetch();await r.abort('failed');}else await r.continue();});
  await open(worker.page); await worker.page.getByRole('textbox').fill(text+' retry'); await worker.page.getByRole('button',{name:'Senden',exact:true}).click();
  await expect(worker.page.getByRole('alert')).toBeVisible(); await expect(worker.page.getByRole('textbox')).toHaveValue(text+' retry');
  await worker.page.getByRole('button',{name:'Senden',exact:true}).click(); await expect(worker.page.getByRole('textbox')).toHaveValue('');
  check(Number((await db.query('SELECT count(*) FROM "CompanyChatMessage" WHERE "companyProfileId"=$1 AND body=$2',[company.id,text+' retry'])).rows[0].count)===1,'Uncertain send duplicated'); await close(worker.page);
  for(const [name,width,height,theme] of [['desktop-night',1440,900,'dark'],['phone-light',390,844,'light'],['phone-night',390,844,'dark'],['phone-small',320,640,'light'],['short-landscape',760,360,'dark']]){
   await worker.ctx.addCookies([{name:'bk_theme',value:theme,url:base}]); await worker.page.setViewportSize({width,height}); await worker.page.reload(); await open(worker.page);
   const panel=worker.page.getByTestId('company-chat-dialog'),box=await panel.boundingBox(); check(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'Chat escaped viewport');
   await expect(worker.page.getByRole('button',{name:'Schließen',exact:true})).toBeVisible(); await expect(worker.page.getByRole('textbox')).toBeVisible();
   await shot(worker.page,profile+'-chat-'+name); await close(worker.page);
  }
  await worker.page.setViewportSize({width:390,height:360}); await open(worker.page); await worker.page.getByRole('textbox').focus(); await expect(worker.page.getByRole('textbox')).toBeInViewport(); await close(worker.page);
  // The desk owns management actions; visiting another office never grants them.
  await owner.page.goto(base+(baum?'/demo/offices/manager':'/workzone/offices/me'));
  await owner.page.getByTestId('office-control-panel').waitFor();
  check(await owner.page.getByTestId('office-control-panel').count()===1,'Duplicate control panel');
  const officeTrigger=owner.page.locator(baum?'[data-testid=muster-offices] nav':'[data-testid=office-floating-nav]').getByTestId('company-chat-trigger');
  await open(owner.page,officeTrigger); await shot(owner.page,profile+'-office-chat'); await close(owner.page);
  for(const width of [390,320]) {
   await owner.page.setViewportSize({width,height:844});
   for(const control of [owner.page.getByTestId('office-control-panel'),officeTrigger]) {
    await expect(control).toBeInViewport(); const box=await control.boundingBox(); check(box.width>=44&&box.height>=44,'Office action lost touch target');
   }
   await shot(owner.page,profile+'-office-'+width);
  }
  await owner.page.getByTestId('office-control-panel').click();
  await owner.page.waitForURL(baum?'**/demo/control':'**/app/dashboard?office=desk'); await shot(owner.page,profile+'-control');
  if(baum) {
   check((await owner.page.request.post(base+'/api/demo/baumdienst/offices/actor',{data:{role:'finance'},headers:{Origin:base}})).ok(),'Office persona switch failed');
   await owner.page.goto(base+'/demo/offices/finance'); await expect(owner.page.locator('[data-office-room=finance]')).toBeVisible(); await expect(owner.page.getByTestId('company-chat-trigger').last()).toBeVisible();
   await expect(owner.page.getByTestId('office-control-panel')).toHaveCount(0);
   await owner.page.goto(base+'/demo/offices/manager'); await expect(owner.page.getByTestId('office-control-panel')).toHaveCount(0);
  } else {
   const employee=await make(390,844,'light'); await enter(employee.page,'office'); await employee.page.goto(base+'/workzone/offices/me'); await expect(employee.page.getByTestId('office-space')).toBeVisible();
   await expect(employee.page.getByTestId('office-control-panel')).toHaveCount(0); await expect(employee.page.getByTestId('office-dashboard-view')).toHaveCount(0); await employee.ctx.close();
  }
  await owner.ctx.close(); await worker.ctx.close();
  check(failures.length===0,JSON.stringify(failures));
  fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify({status:'PASS',profile,records,authors,historyFixture:1000,maxMounted:40,device:'Chromium touch/viewport emulation; physical phone and actual native push not exercised'},null,2));
  console.log(JSON.stringify({status:'PASS',profile,captures:records.length,historyFixture:1000}));
 } catch(error) { if(current&&!current.isClosed()) await current.screenshot({path:path.join(output,'failure.png')}).catch(()=>{}); fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,records,failures},null,2)); throw error; }
 finally { await browser.close(); await db.end(); fs.writeFileSync(path.join(output,'release.json'),JSON.stringify({browserConnected:browser.isConnected(),contexts:browser.contexts().length})); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
