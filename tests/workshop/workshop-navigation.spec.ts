import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resetWorkshopFixture } from "./shared-fixture";
import type { WorkshopSnapshot } from "../../src/lib/workshop/shared-contract";
const api="/api/demo/baumdienst/workshop";
test.beforeEach(async({context},info)=>{await resetWorkshopFixture();await context.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);await context.route("https://*.tile.openstreetmap.org/**",r=>r.abort());});

test("dashboard, control panel and TV are directly reachable at desktop and touch sizes",async({page,request},info)=>{
  const before=await(await request.get(api)).json() as WorkshopSnapshot;
  for(const size of [{width:1440,height:1000},{width:390,height:844},{width:320,height:720},{width:740,height:360}]){
    await page.setViewportSize(size);await page.goto("/demo/workzone");const nav=page.getByRole("navigation",{name:"Demo",exact:true});
    for(const label of ["Kontrollpanel","Dashboard view"]){const link=nav.getByRole("link",{name:label,exact:true});await expect(link).toBeVisible();expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await link.evaluate(el=>!el.closest("details"))).toBe(true);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.addStyleTag({content:"html{font-size:200% !important}"});
    expect(await page.getByTestId("demo-workspace").evaluate(el=>el.clientHeight)).toBeGreaterThan(Math.min(180,size.height/3));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await page.getByRole("navigation",{name:"Demo",exact:true}).getByRole("link",{name:"Kontrollpanel",exact:true}).click();
  await expect(page.getByTestId("demo-control-panel")).toBeVisible();
  for(const worker of before.directory.workers) await expect(page.getByTestId("demo-control-panel").getByRole("link",{name:worker.name,exact:true})).toHaveAttribute("href",`/demo/workers/${worker.id}`);
  await page.screenshot({path:info.outputPath("control-phone.png")});
  const after=await(await request.get(api)).json() as WorkshopSnapshot;expect(after.revision).toBe(before.revision);expect(after.state).toEqual(before.state);
});

test("Dashboard view opens fullscreen with no monitor controls and preserves inventory",async({page,request},info)=>{
  const before=await(await request.get(api)).json() as WorkshopSnapshot;
  await page.goto("/demo/workzone");await page.getByRole("navigation",{name:"Demo",exact:true}).getByRole("link",{name:"Dashboard view",exact:true}).click();
  await expect(page).toHaveURL(/\/demo\/tv\?view=dashboard/);expect(await page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.getByRole("heading",{name:"Dashboard",exact:true})).toBeVisible();await expect(page.getByTestId("baum-demo-topbar")).toBeHidden();
  await expect(page.locator("[data-demo-tv] button")).toHaveCount(0);await expect(page.locator("[data-demo-tv] nav")).toHaveCount(0);await expect(page.locator('[data-demo-tv] a[href*="workzone"]')).toHaveCount(0);
  await page.screenshot({path:info.outputPath("dashboard-fullscreen-clean.png")});
  const after=await(await request.get(api)).json() as WorkshopSnapshot;expect(after.revision).toBe(before.revision);expect(after.state).toEqual(before.state);
});

test("vehicles use plates, optional additional tags print only after explicit assignment",async({page,request},info)=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/demo/workshop?tab=fleet&asset=crane&detail=1");const d=page.getByRole("dialog");
  await expect(d).toContainText("Kennzeichen");await expect(d.getByRole("link",{name:"Etikett drucken",exact:true})).toHaveCount(0);
  await expect(d.getByRole("button",{name:"Optionalen Barcode hinzufügen",exact:true})).toBeVisible();
  expect((await request.get("/demo/inventory/print?asset=crane")).status()).toBe(404);
  let snapshot=await(await request.get(api)).json() as WorkshopSnapshot;const original=snapshot.state.assets.find(a=>a.id==="crane")!;
  const response=await request.post(api,{headers:{Origin:String(info.project.use.baseURL)},data:{requestId:randomUUID(),revision:snapshot.revision,command:{type:"edit-asset",assetId:"crane",name:original.name,details:{category:"vehicle",manufacturer:"",model:"",serial:"",note:""},plate:"MU-BD 401",barcode:"BDF-CRANE-401"}}});expect(response.status()).toBe(200);
  snapshot=await response.json() as WorkshopSnapshot;expect(snapshot.state.assets.find(a=>a.id==="crane")?.code).toBe("MU-BD 401");
  await page.reload();await d.getByText("Barcode · optional · BDF-CRANE-401",{exact:true}).click();await expect(d.getByRole("link",{name:"Etikett drucken",exact:true})).toBeVisible();
  await page.goto("/demo/inventory/print?asset=crane");await expect(page.locator("[data-label-print]")).toContainText("BDF-CRANE-401");
  await page.screenshot({path:info.outputPath("optional-vehicle-label.png")});
});

test("vehicle registration and optional label editing preserve one record through the touch form",async({page,request})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/demo/workshop?tab=fleet");
  await page.getByRole("button",{name:"Gerät erfassen",exact:true}).click();const d=page.getByRole("dialog");
  await d.getByLabel("Bezeichnung",{exact:true}).fill("DEMO · Fahrzeug ohne Etikett");await d.locator('select[name="category"]').selectOption("vehicle");
  await d.getByLabel("Kennzeichen",{exact:true}).fill("MU-TEST 76");await d.getByLabel("Nächste Prüfung",{exact:true}).fill("2027-11-05");
  await d.getByRole("button",{name:"Gerät erfassen",exact:true}).click();await expect(d).toHaveAccessibleName("DEMO · Fahrzeug ohne Etikett · MU-TEST 76");
  let s=await(await request.get(api)).json() as WorkshopSnapshot;const asset=s.state.assets.find(a=>a.name==="DEMO · Fahrzeug ohne Etikett")!;expect(asset.barcode).toBeUndefined();
  await d.getByRole("button",{name:"Optionalen Barcode hinzufügen",exact:true}).click();await d.locator("summary").filter({hasText:"Barcode · optional"}).click();
  await d.getByRole("button",{name:"Code erzeugen",exact:true}).click();await d.getByRole("button",{name:"Speichern",exact:true}).click();
  await expect(d).toHaveAccessibleName("DEMO · Fahrzeug ohne Etikett · MU-TEST 76");s=await(await request.get(api)).json() as WorkshopSnapshot;
  expect(s.state.assets.filter(a=>a.id===asset.id)).toHaveLength(1);const barcode=s.state.assets.find(a=>a.id===asset.id)!.barcode!;expect(barcode).toMatch(/^BF-/);
  await d.getByText(`Barcode · optional · ${barcode}`,{exact:true}).click();await expect(d.getByRole("link",{name:"Etikett drucken",exact:true})).toHaveAttribute("href",`/demo/inventory/print?asset=${asset.id}`);
});
