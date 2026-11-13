import { openRegistration, openScanner } from "./workspace-actions";
import { switchDemoRole } from "./demo-role";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { resetWorkshopFixture, prisma } from "./shared-fixture";
import type { WorkshopSnapshot } from "../../src/lib/workshop/shared-contract";
const api="/api/demo/baumdienst/workshop";
test.beforeEach(async ({context},info)=>{await resetWorkshopFixture(); await context.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]); await context.route("https://*.tile.openstreetmap.org/**",r=>r.abort());});

test("register once with photo, scan stable identity, printable label, metadata and duplicate protection",async({page,request},info)=>{
  await page.setViewportSize({width:390,height:844}); await page.goto("/demo/workshop?tab=tools"); await openRegistration(page);
  const d=page.getByRole("dialog"); expect(await d.getByLabel("Kennzeichen / Inventarnummer",{exact:true}).evaluate(el=>{const pattern=new RegExp(`^(?:${(el as HTMLInputElement).pattern})$`,"v"); return pattern.test("DEMO/42") && !pattern.test("bad_code");})).toBe(true); await d.getByLabel("Bezeichnung",{exact:true}).fill("DEMO · Akku-Freischneider"); await d.getByLabel("Nächste Prüfung",{exact:true}).fill("2027-11-05");
  await d.getByText("Technische Angaben",{exact:true}).click(); await d.getByLabel("Seriennummer",{exact:true}).fill("DEMO-SERIAL-42");
  const png=await sharp({create:{width:200,height:150,channels:3,background:"#315c46"}}).png().toBuffer(); await d.locator('input[name="photo"]').setInputFiles({name:"DEMO-tool.png",mimeType:"image/png",buffer:png});
  await d.getByRole("button",{name:"Gerät erfassen",exact:true}).click(); await expect(d).toContainText("Firmenlager");
  let s=await (await request.get(api)).json() as WorkshopSnapshot; const asset=s.state.assets.find(a=>a.name==="DEMO · Akku-Freischneider")!; expect(asset.id).toMatch(/^[\da-f-]{36}$/); expect(asset.code).toMatch(/^BF-/); expect(s.photos.some(p=>p.target===asset.id)).toBe(true); expect(s.state.custody.fileEvents[0].actor.key).toBe("admin");
  await d.getByText(`Barcode · ${asset.code}`,{exact:false}).click(); const print=d.getByRole("link",{name:"Etikett drucken",exact:true}); await expect(print).toHaveAttribute("href",`/demo/inventory/print?asset=${asset.id}`); await page.goto(await print.getAttribute("href") as string); await expect(page.locator('[data-label-print]')).toContainText(asset.code); await expect(page.locator('[data-label-print]')).toContainText("DEMO-SERIAL-42");
  await page.goto("/demo/workshop?tab=tools"); await openScanner(page); await page.getByLabel("Barcode / NFC-Code").fill(asset.code); await page.getByRole("button",{name:"Gerät öffnen",exact:true}).click(); await expect(d).toHaveAccessibleName(`${asset.name} · ${asset.code}`);
  await d.getByRole("button",{name:"Schließen",exact:true}).click(); await openRegistration(page); await d.getByLabel("Bezeichnung",{exact:true}).fill("DEMO duplicate"); await d.getByLabel("Nächste Prüfung",{exact:true}).fill("2027-11-05"); await d.getByLabel("Kennzeichen / Inventarnummer",{exact:true}).fill(asset.code); await d.getByRole("button",{name:"Gerät erfassen",exact:true}).click(); await expect(d.getByRole("alert")).toContainText("bereits registriert");
  s=await (await request.get(api)).json() as WorkshopSnapshot; expect(s.state.assets.filter(a=>a.code===asset.code)).toHaveLength(1);
  await page.screenshot({path:info.outputPath("registration-phone.png")});
});

test("tree grid has 2/6 columns, tap actions, hold details, persistent reports/equipment and role protection",async({page,request,browser},info)=>{
  const seed=await(await request.get(api)).json() as WorkshopSnapshot, site=seed.directory.sites.find(s=>s.name.includes("Stadtpark"))!;
  const tree=await prisma.treeItem.findFirstOrThrow({where:{baustelleId:site.id},orderBy:{treeId:"asc"}});
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.goto(`/demo/baustellen/${site.id}`);const grid=page.getByTestId("muster-tree-grid");await expect(grid).toBeVisible();expect(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(width===390?2:6);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`trees-${width}.png`)});}
  const card=page.getByTestId("muster-tree-grid").locator("article").filter({has:page.getByRole("button",{name:`Baumdetails · ${tree.treeId}`,exact:true})});
  await card.getByRole("button").first().click(); let d=page.getByRole("dialog"); await expect(d.getByRole("button",{name:"Problem melden",exact:true})).toBeVisible();
  const done=d.getByRole("button",{name:"Erledigt",exact:true});if(await done.count())await done.click();else await d.getByRole("button",{name:"Wieder in Bearbeitung",exact:true}).click();
  await card.getByRole("button").first().click();await d.getByRole("button",{name:"Problem melden",exact:true}).click();await d.getByLabel("Was muss geprüft werden?").fill("DEMO · Ast über dem Weg");await d.getByRole("button",{name:"Problem melden",exact:true}).click();
  const phone=await browser.newContext({baseURL:String(info.project.use.baseURL),viewport:{width:390,height:844}});await phone.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);const other=await phone.newPage();try{
    await other.goto(`/demo/baustellen/${site.id}`);await switchDemoRole(other,seed.directory.workers.find(w=>w.available)!.key);await other.getByRole("button",{name:`Baumdetails · ${tree.treeId}`,exact:true}).click();await expect(other.getByRole("dialog")).toContainText("DEMO · Ast über dem Weg");await expect(other.getByRole("dialog").getByRole("button",{name:"Wieder in Bearbeitung",exact:true})).toBeDisabled();await expect(other.getByRole("dialog").getByRole("button",{name:"Angaben bearbeiten",exact:true})).toHaveCount(0);
  }finally{await phone.close();}
  await page.reload();const target=card.getByRole("button").first();await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await expect(d.getByRole("button",{name:"Sicherheitsmaterial",exact:true})).toBeVisible();await page.mouse.up();await expect(d.getByRole("button",{name:"Sicherheitsmaterial",exact:true})).toBeVisible();await d.getByRole("button",{name:"Sicherheitsmaterial",exact:true}).click();await d.getByLabel("Schilder",{exact:true}).fill("3");await d.getByRole("button",{name:"Speichern",exact:true}).click();await page.reload();await page.getByRole("button",{name:`Baumdetails · ${tree.treeId}`,exact:true}).click();await expect(d).toContainText("3");
  const result=await(await request.get(api)).json() as WorkshopSnapshot;expect(result.state.custody.treeEvents.length).toBe(3);expect(result.state.custody.trees[`${site.key}:${tree.treeId}`].equipment?.SIGN).toBe(3);expect(errors).toEqual([]);
});

test("role cookie, command receipts and actor-aware ETag cannot impersonate another worker",async({request},info)=>{
  const headers={Origin:String(info.project.use.baseURL)}, start=await request.get(api), s=await start.json() as WorkshopSnapshot, worker=s.directory.workers.find(w=>w.available)!;
  expect((await request.post("/api/demo/baumdienst/actor",{headers,data:{key:worker.key}})).status()).toBe(200);const changed=await request.get(api,{headers:{"If-None-Match":start.headers().etag}});expect(changed.status()).toBe(200);expect((await changed.json()).actor.key).toBe(worker.key);
  const denied=await request.post(api,{headers,data:{requestId:randomUUID(),revision:s.revision,command:{type:"policy",autoConfirm:true}}});expect(denied.status()).toBe(403);
  const deniedFile=await request.post("/api/demo/baumdienst/files",{headers,multipart:{requestId:randomUUID(),revision:String(s.revision),kind:"document",target:"crane",file:{name:"DEMO-denied.txt",mimeType:"text/plain",buffer:Buffer.from("Fictional")}}});expect(deniedFile.status()).toBe(403);
  expect((await request.post("/api/demo/baumdienst/actor",{headers,data:{key:"other-company"}})).status()).toBe(404);
  expect((await request.post("/api/demo/baumdienst/actor",{headers:{Origin:"https://unrelated.invalid"},data:{key:"admin"}})).status()).toBe(403);
});

test("worker profile uses one workspace and wraps at touch, landscape and 200 percent text",async({page,request,context},info)=>{
  const seed=await(await request.get(api)).json() as WorkshopSnapshot, worker=seed.directory.workers.find(w=>w.name==="Jonas Becker")!;
  for(const theme of ["light","dark"])for(const size of [{width:390,height:844},{width:320,height:700},{width:844,height:390}]){
    await context.addCookies([{name:"bk_theme",value:theme,url:String(info.project.use.baseURL)}]);await page.setViewportSize(size);await page.goto(`/demo/workers/${worker.id}`);await expect(page.getByRole("heading",{name:worker.name,exact:true})).toBeVisible();expect((await page.getByRole("heading",{name:worker.name,exact:true}).boundingBox())!.height).toBeLessThanOrEqual(64);await expect(page.getByRole("heading",{name:worker.name,exact:true}).locator("..")).toContainText("Verfügbar");await expect(page.getByRole("region",{name:"Geräte & Werkzeuge"})).toContainText("LKW 7,5 t");
    if(size.width===390)await page.screenshot({path:info.outputPath(`profile-${theme}-390.png`)});
    await page.addStyleTag({content:"html {font-size:200% !important;}"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
    const workspace=page.getByTestId("demo-workspace");await workspace.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(page.getByRole("link",{name:"by RediON",exact:true})).toBeInViewport();
  }
});
