import { expect,test } from "@playwright/test";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { resetWorkshopFixture } from "./shared-fixture";
import { DEMO_BRAND_TARGET } from "../../src/lib/workshop/media";
const api="/api/demo/baumdienst/workshop";
test.beforeEach(async({context},info)=>{await resetWorkshopFixture();await context.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);await context.route("https://*.tile.openstreetmap.org/**",r=>r.abort());});

test("cover choice, remove, restore and duplicate upload persist between independent phone and desktop views",async({page,browser,request},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/demo/workshop?tab=tools");
  await page.getByTestId("demo-photo-asset-crane").getByRole("button").click();const d=page.getByRole("dialog");
  for(const [name,color] of [["DEMO-first.png","#275848"],["DEMO-second.png","#765325"]]){
    const buffer=await sharp({create:{width:240,height:180,channels:3,background:color}}).png().toBuffer();await d.locator('input[data-photo-input="upload"]').setInputFiles({name,mimeType:"image/png",buffer});await expect(d.getByRole("status")).toContainText("gespeichert");
  }
  const first=d.locator("figure").filter({hasText:"DEMO-first.webp"}),second=d.locator("figure").filter({hasText:"DEMO-second.webp"});
  await first.getByRole("button",{name:"Als Titelbild verwenden",exact:true}).click();await expect(first.getByRole("button",{name:"Aktuelles Titelbild",exact:true})).toBeDisabled();
  const initial=await(await request.get(api)).json();expect(initial.photos.filter((p:{target:string})=>p.target==="crane")).toHaveLength(2);
  await first.getByRole("button",{name:"Bild entfernen",exact:true}).click();await expect(first).toHaveCount(0);await expect(second.getByRole("button",{name:"Aktuelles Titelbild",exact:true})).toBeDisabled();
  const other=await browser.newContext({viewport:{width:1440,height:1000}}),phone=await other.newPage();await other.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);await phone.goto("/demo/workshop?tab=tools");await phone.getByTestId("demo-photo-asset-crane").getByRole("button").click();const remote=phone.getByRole("dialog");
  await expect(remote.locator("figure").filter({hasText:"DEMO-first.webp"})).toHaveCount(0);await remote.locator("summary").filter({hasText:"Entfernte Bilder"}).click();await remote.getByRole("button",{name:"Bild wiederherstellen",exact:true}).click();await expect(remote.locator("figure").filter({hasText:"DEMO-first.webp"})).toBeVisible();
  const buffer=await sharp({create:{width:240,height:180,channels:3,background:"#275848"}}).png().toBuffer();await remote.locator('input[data-photo-input="upload"]').setInputFiles({name:"DEMO-same.png",mimeType:"image/png",buffer});await expect(remote.getByRole("status")).toContainText("gespeichert");
  const after=await(await request.get(api)).json();expect(after.photos.filter((p:{target:string})=>p.target==="crane")).toHaveLength(2);expect(after.state).toEqual(initial.state);
  await phone.screenshot({path:info.outputPath("media-gallery-desktop.png")});await other.close();
  await page.screenshot({path:info.outputPath("media-gallery-phone.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("logo and site galleries expose explicit AI actions, saved logo removal and no image badges",async({page,request},info)=>{
  await page.goto("/demo/control");await page.getByTestId(`demo-photo-asset-${DEMO_BRAND_TARGET}`).getByRole("button").click();let d=page.getByRole("dialog");await expect(d.getByRole("button",{name:"Mit KI erstellen",exact:true})).toBeVisible();
  const buffer=await sharp({create:{width:128,height:128,channels:3,background:"#275848"}}).png().toBuffer();await d.locator('input[data-photo-input="upload"]').setInputFiles({name:"DEMO-logo.png",mimeType:"image/png",buffer});await expect(d.getByRole("status")).toContainText("gespeichert");
  await d.getByRole("button",{name:"Schließen",exact:true}).click();
  await expect(page.getByRole("link",{name:"BaumdienstFlow · Workzone",exact:true}).locator("img")).toHaveAttribute("src",/api\/demo\/baumdienst\/files/);
  await page.getByTestId(`demo-photo-asset-${DEMO_BRAND_TARGET}`).getByRole("button").click();await d.getByRole("button",{name:"Bild entfernen",exact:true}).click();await d.getByRole("button",{name:"Schließen",exact:true}).click();await expect(page.getByRole("link",{name:"BaumdienstFlow · Workzone",exact:true}).locator("img")).not.toHaveAttribute("src",/api\/demo\/baumdienst\/files/);
  await page.goto("/demo/workzone");await page.locator('[data-testid^="demo-photo-site-"] button').first().click();d=page.getByRole("dialog");await expect(d.getByRole("button",{name:"Mit KI erstellen",exact:true})).toBeVisible();await d.getByRole("button",{name:"Schließen",exact:true}).click();
  expect(await page.locator('[data-studio-art] span').count()).toBe(0);
  const nav=page.getByRole("navigation",{name:"Demo",exact:true});await expect(nav.getByRole("link",{name:"Dashboard view",exact:true})).toHaveAttribute("href","/demo/tv?view=dashboard");await expect(nav.getByRole("link",{name:"Dashboard",exact:true})).toHaveCount(0);
  const s=await(await request.get(api)).json(),headers={Origin:"https://other.invalid"};expect((await request.post("/api/demo/baumdienst/media",{headers,data:{requestId:randomUUID(),revision:s.revision,command:{kind:"asset",target:"crane",action:"remove",mediaId:"catalogue"}}})).status()).toBe(403);
  await page.screenshot({path:info.outputPath("single-dashboard-view-desktop.png")});
});

test("wood phase images can be removed and restored without changing processing history",async({page,request})=>{
  // A temporary initial snapshot failure must not expose an action that cannot be confirmed.
  let firstRead=true;
  await page.route("**/api/demo/baumdienst/workshop",async route=>{if(firstRead&&route.request().method()==="GET"){firstRead=false;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"connection"})});}else await route.continue();});
  await page.setViewportSize({width:390,height:844});await page.goto("/demo/wood");await page.getByRole("button",{name:"Arbeiten & Phasen",exact:true}).click();
  const before=await(await request.get("/api/demo/baumdienst/wood")).json();
  await page.getByRole("button",{name:"Phasenbild · Sägen",exact:true}).click();const d=page.getByRole("dialog");await expect(d.getByRole("button",{name:"Mit KI erstellen",exact:true})).toBeVisible();
  await expect(d.getByRole("button",{name:"Bild entfernen",exact:true})).toBeDisabled();
  await expect(d.getByRole("button",{name:"Bild entfernen",exact:true})).toBeEnabled({timeout:15000});
  await d.getByRole("button",{name:"Bild entfernen",exact:true}).click();await expect(d.getByRole("button",{name:"Bild entfernen",exact:true})).toHaveCount(0);
  await d.locator("summary").filter({hasText:"Entfernte Bilder"}).click();await d.getByRole("button",{name:"Bild wiederherstellen",exact:true}).click();await expect(d.getByRole("button",{name:"Bild entfernen",exact:true})).toBeVisible();
  const after=await(await request.get("/api/demo/baumdienst/wood")).json();expect(after.events).toEqual(before.events);expect(after.jobs).toEqual(before.jobs);expect(after.revision).toBe(before.revision);
});
