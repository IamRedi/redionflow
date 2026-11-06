import { expect,test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma,resetWorkshopFixture } from "./shared-fixture";
import { digest,DEMO_WORKSPACE_KEY } from "../../src/lib/workshop/shared-store";
import { imageIdentity,IMAGE_MODEL,IMAGE_STYLE } from "../../src/lib/workshop/image-identity";
import type { WorkshopSnapshot } from "../../src/lib/workshop/shared-contract";
test.beforeEach(async({context},info)=>{await resetWorkshopFixture();await context.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);});
test("botanical studio keeps six/two columns, characteristic leaves, seasons and hedges read-only",async({page,request},info)=>{
  const s=await(await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot,site=s.directory.sites[0];
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});await page.goto(`/demo/baustellen/${site.id}`);
    const grid=page.getByTestId("muster-tree-grid");expect(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(width===390 ? 2:6);
    await page.getByRole("combobox",{name:"Sommer · Herbst",exact:true}).selectOption("autumn");
    const art=grid.locator("svg[data-botanical-kind]").first();expect(await art.locator("linearGradient stop").first().getAttribute("stop-color")).toBeTruthy();
    await page.getByRole("button",{name:"Artenstudio",exact:true}).click();const d=page.getByRole("dialog");await d.getByRole("button",{name:"Hecken",exact:true}).click();await d.getByRole("button",{name:/Hainbuchenhecke/}).click();
    await expect(d.getByTestId("species-reference")).toContainText("Gerippt, doppelt gesägt"); await d.getByText("Mehr über diese Art",{exact:true}).click();await expect(d.locator('svg[data-botanical-form="hedge"]')).toHaveCount(1);await expect(d.getByTestId("atlas-plate").locator("img")).toBeVisible(); await d.getByRole("button",{name:/^Blatt \/ Nadeln/}).click(); await expect(d.getByTestId("atlas-plate")).toHaveAttribute("data-area","leaf");
    expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:info.outputPath(`studio-hedge-${width}.png`)});
    await d.getByRole("button",{name:"Schließen",exact:true}).click();
    await grid.locator('article > button').first().click();
    const magnifier=page.getByRole("button",{name:"Artenkarte öffnen",exact:true});
    const box=await magnifier.boundingBox();expect(box?.width).toBeGreaterThanOrEqual(44);expect(box?.height).toBeGreaterThanOrEqual(44);
    await magnifier.click();const atlas=page.getByRole("dialog").last();await expect(atlas.getByTestId("species-reference")).toBeVisible();
    await atlas.getByRole("button",{name:/^Rinde/}).click();await expect(atlas.getByTestId("atlas-plate")).toHaveAttribute("data-area","bark");
    expect(await atlas.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await atlas.getByRole("button",{name:"Schließen",exact:true}).click();await expect(magnifier).toBeFocused();await page.getByRole("dialog").getByRole("button",{name:"Schließen",exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const after=await(await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;expect(after.state.custody.treeEvents).toEqual(s.state.custody.treeEvents);
});
test("generated raster persists across devices and a real uploaded photo has priority",async({page,request,browser},info)=>{
  const s=await(await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot,asset=s.state.assets.find(a=>a.id==="blower")!,id=randomUUID();
  const raster=await sharp({create:{width:256,height:256,channels:3,background:"#487944"}}).webp().toBuffer();
  await prisma.baumdienstDemoImageGeneration.create({data:{id,workspaceKey:DEMO_WORKSPACE_KEY,fingerprint:digest(imageIdentity(asset)),assetId:asset.id,actorKey:"admin",model:IMAGE_MODEL,style:IMAGE_STYLE,status:"ready",data:new Uint8Array(raster),finishedAt:new Date()}});
  await prisma.baumdienstDemoWorkspace.update({where:{key:DEMO_WORKSPACE_KEY},data:{revision:{increment:1}}});
  const phone=await browser.newContext({baseURL:String(info.project.use.baseURL),viewport:{width:390,height:844}});try{
    await phone.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);const mobile=await phone.newPage();
    for(const view of [page,mobile]){await view.goto("/demo/workshop?tab=tools");const catalogue=view.getByTestId("demo-photo-asset-chipper");await expect(catalogue.locator("img")).toHaveJSProperty("naturalWidth",1536);expect((await catalogue.locator("img").boundingBox())!.height).toBeGreaterThan(0);expect(await catalogue.locator("img").evaluate(el=>getComputedStyle(el).objectFit)).toBe("contain");await catalogue.getByRole("button").click();await expect(view.getByRole("dialog")).toContainText("KI-Katalogillustration");await expect(view.getByRole("dialog")).not.toContainText("Noch keine Fotos.");await view.getByRole("dialog").getByRole("button",{name:"Schließen",exact:true}).click();const photo=view.getByTestId(`demo-photo-asset-${asset.id}`);await expect(photo.locator("img")).toHaveAttribute("src",`/api/demo/baumdienst/images/${id}`);await photo.getByRole("button").click();await expect(view.getByRole("dialog")).toContainText("KI-Studioillustration");await expect(view.getByRole("dialog")).toContainText("kein Foto dieses konkreten Geräts");await expect(view.getByRole("dialog")).not.toContainText("Noch keine Fotos.");await view.getByRole("dialog").getByRole("button",{name:"Schließen",exact:true}).click();}
    const image=await request.get(`/api/demo/baumdienst/images/${id}`);expect(image.headers()["content-type"]).toBe("image/webp");expect(image.headers()["cross-origin-resource-policy"]).toBe("same-origin");
    const latest=await(await request.get("/api/demo/baumdienst/workshop")).json() as WorkshopSnapshot;
    const upload=await request.post("/api/demo/baumdienst/files",{headers:{Origin:String(info.project.use.baseURL)},multipart:{requestId:randomUUID(),revision:String(latest.revision),kind:"asset",target:asset.id,file:{name:"DEMO-own.webp",mimeType:"image/webp",buffer:raster}}});expect(upload.status()).toBe(200);
    const uploaded=(await upload.json() as WorkshopSnapshot).photos.find(p=>p.target===asset.id)!;await mobile.reload();await expect(mobile.getByTestId(`demo-photo-asset-${asset.id}`).locator("img")).toHaveAttribute("src",uploaded.url);
  }finally{await phone.close();}
  const disabled=await request.post("/api/demo/baumdienst/images",{headers:{Origin:String(info.project.use.baseURL)},data:{requestId:randomUUID(),assetId:"saw"}});expect(disabled.status()).toBe(503);
  expect((await request.post("/api/demo/baumdienst/images",{headers:{Origin:"https://other.invalid"},data:{requestId:randomUUID(),assetId:"saw"}})).status()).toBe(403);
});
