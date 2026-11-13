import { expect, test } from "@playwright/test";
import { resetWorkshopFixture } from "./shared-fixture";

test.beforeEach(async ({ context }, info) => {
  await resetWorkshopFixture();
  await context.addCookies([{ name:"bk_lang",value:"de",url:String(info.project.use.baseURL) }]);
});

test("one folder per section, direct utilities, shared stock and legacy links keep all records", async ({page,context,request},info) => {
  const before=await (await request.get("/api/demo/baumdienst/workshop")).json();
  for(const theme of ["light","dark"]) for(const width of [1440,390]) {
    await context.addCookies([{name:"bk_theme",value:theme,url:String(info.project.use.baseURL)}]);
    await page.setViewportSize({width,height:844});
    for(const [section,label,scene] of [["orders","Werkstatt","repair"],["fleet","Flotte","fleet"],["tools","Inventar","inventory"]]) {
      await page.goto(`/demo/workshop?tab=${section}`);
      const nav=page.getByRole("navigation",{name:"Demo",exact:true});
      await expect(nav.getByRole("link")).toHaveCount(8);
      await expect(nav.getByRole("link",{name:label,exact:true})).toHaveAttribute("aria-current","page");
      for(const name of ["Dokumente","Ersatzteile","Historie"]) await expect(nav.getByRole("link",{name,exact:true})).toHaveCount(0);
      await expect(page.locator('[data-demo-utilities] a[href="/demo/kidraht"]')).toBeVisible();
      await expect(page.locator('[data-demo-utilities]').getByRole("button",{name:"Hell/Dunkel",exact:true})).toBeVisible();
      await expect(page.getByLabel("Mehr",{exact:true})).toHaveCount(0);
      const folder=page.getByTestId("section-folder"); await folder.click();
      await expect(page.getByRole("option")).toHaveCount(4);
      await page.getByRole("option",{name:"Dokumente",exact:true}).click();
      await expect(page).toHaveURL(new RegExp(`section=${section}`));
      await expect(page.locator(`[data-baum-environment="${scene}"]`)).toHaveCount(1);
      await expect(nav.getByRole("link",{name:label,exact:true})).toHaveAttribute("aria-current","page");
      await expect(page.getByRole("button",{name:"Defekt melden",exact:true})).toHaveCount(0);
      const expected=before.state.documents.filter((d:{assetId:string;jobId?:string})=>section==="tools" || section==="fleet"&&before.state.assets.some((a:{id:string;kind:string})=>a.id===d.assetId&&a.kind==="fleet") || section==="orders"&&!!d.jobId);
      for(const d of expected) await expect(page.getByText(d.name,{exact:true})).toBeVisible();
      if(section==="orders") await expect(page.getByLabel("Beispieldokument hinzufügen",{exact:true})).toBeDisabled();
      await folder.click(); await page.getByRole("option",{name:"Ersatzteile",exact:true}).click();
      await expect(page.getByText("Gemeinsamer Ersatzteilbestand",{exact:true})).toBeVisible();
      for(const part of before.state.parts) await expect(page.getByRole("heading",{name:part.name,exact:true})).toBeVisible();
      await folder.click(); await page.getByRole("option",{name:"Berichte & Historie",exact:true}).click();
      await expect(page.getByRole("heading",{level:1})).toContainText(label);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
      if(section==="fleet") await page.screenshot({path:info.outputPath(`folder-${theme}-${width}.png`)});
    }
  }
  await page.goto("/demo/workshop?tab=documents");
  for(const d of before.state.documents) await expect(page.getByText(d.name,{exact:true})).toBeVisible();
  const site=before.directory.sites[0].key;
  await page.goto(`/demo/workshop?tab=tools&asset=crane&site=${site}`);
  await page.getByTestId("section-folder").click(); await page.getByRole("option",{name:"Dokumente",exact:true}).click();
  const url=new URL(page.url()); expect(url.searchParams.get("asset")).toBe("crane");expect(url.searchParams.get("site")).toBe(site);
  const after=await(await request.get("/api/demo/baumdienst/workshop")).json();
  expect(after.revision).toBe(before.revision); expect(after.state).toEqual(before.state);
});

test("a repair upload is one job-linked file, readable in fleet and inventory folders", async ({page,request}) => {
  const api="/api/demo/baumdienst/workshop",before=await(await request.get(api)).json();
  await page.goto("/demo/workshop?section=orders&tab=documents");
  const upload=page.getByLabel("Beispieldokument hinzufügen",{exact:true});
  await page.getByLabel("Gerät / Fahrzeug",{exact:true}).selectOption("chipper");
  await expect(upload).toBeDisabled();
  await page.getByLabel("Reparatur",{exact:true}).selectOption("WS-101");
  await expect(upload).toBeEnabled();
  const name="DEMO-Bereichsakte.txt";
  await upload.setInputFiles({name,mimeType:"text/plain",buffer:Buffer.from("Fictional repair report")});
  await expect(page.getByText(name,{exact:true})).toBeVisible();
  const saved=await(await request.get(api)).json(),doc=saved.state.documents.find((d:{name:string})=>d.name===name);
  expect(doc).toMatchObject({assetId:"chipper",jobId:"WS-101"});expect(doc.fileId).toBeTruthy();
  for(const section of ["fleet","tools"]) {
    await page.goto(`/demo/workshop?section=${section}&tab=documents`);
    const row=page.getByRole("listitem").filter({hasText:name});
    await expect(row.getByRole("link",{name:"Herunterladen",exact:true})).toHaveAttribute("href",`/api/demo/baumdienst/files/${doc.fileId}`);
  }
  const after=await(await request.get(api)).json();
  expect(after.state.documents).toHaveLength(before.state.documents.length+1);
  expect(after.state.parts).toEqual(before.state.parts);expect(after.revision).toBe(saved.revision);
});
