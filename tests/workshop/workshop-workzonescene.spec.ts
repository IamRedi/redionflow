import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {prisma,resetWorkshopFixture} from "./shared-fixture";
test.beforeEach(async({context},info)=>{await resetWorkshopFixture();await prisma.baustelle.deleteMany({where:{name:{startsWith:"DEMO Scene "}}});await context.addCookies([{name:"bk_lang",value:"de",url:String(info.project.use.baseURL)}]);await context.route("https://*.tile.openstreetmap.org/**",r=>r.abort());});
test("full-screen forest scene keeps cards, map, plan and archive reachable without page scrolling",async({page,context,request},info)=>{
  const before=await(await request.get("/api/demo/baumdienst/workshop")).json();
  for(const theme of ["light","dark"])for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:600},{width:390,height:360}]){
    await context.addCookies([{name:"bk_theme",value:theme,url:String(info.project.use.baseURL)}]);await page.setViewportSize(size);await page.goto("/demo/workzone");
    await expect(page.locator('[data-workzone-scene="fixed"]')).toBeVisible();
    const cards=page.getByTestId("muster-site-card");await expect(cards.first()).toBeVisible();
    await page.getByRole("button",{name:"Layout neu ordnen",exact:true}).click();
    await expect(async()=>{expect(await cards.evaluateAll(es=>es.every(e=>{const a=e.getBoundingClientRect(),b=e.closest('[data-testid="workzone-canvas"]')!.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1&&a.top>=b.top&&a.bottom<=b.bottom+1}))).toBe(true)}).toPass({timeout:10000});
    expect(await cards.evaluateAll(es=>es.every(e=>{const b=e.getBoundingClientRect();return [...e.querySelectorAll('a,button')].every(a=>{const r=a.getBoundingClientRect();return r.width===0||r.left>=b.left-1&&r.right<=b.right+1&&r.bottom<=b.bottom+1})}))).toBe(true);
    const boxes=await cards.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(boxes[i].right<=boxes[j].left+1||boxes[j].right<=boxes[i].left+1||boxes[i].bottom<=boxes[j].top+1||boxes[j].bottom<=boxes[i].top+1).toBe(true);
    await expect(page.getByTestId("wood-overview")).toHaveCount(0);await expect(page.getByRole("region",{name:"Werkstatt",exact:true})).toHaveCount(0);
    const shell=page.locator('[data-demo-shell="muster"]');expect(await shell.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain(`connected-landscape-${theme==="dark"?"night":"day"}.webp`);
    expect(await page.getByTestId("demo-workspace").evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
    await expect(page.getByRole("link",{name:"Tageplan +",exact:true})).toHaveAttribute("href",/\/demo\/plan\?date=/);
    await page.getByRole("button",{name:"Archiv & Informationen",exact:true}).click();const dialog=page.getByRole("dialog");
    await expect(dialog.getByTestId("workzone-scene-archive")).toBeVisible();await expect(dialog.getByRole("link",{name:"by RediON",exact:true})).toHaveCount(1);
    await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Archiv & Informationen",exact:true})).toBeFocused();
    await page.getByRole("button",{name:"Kartenmodus",exact:true}).click();await expect(page.getByTestId("workzone-fleet-map")).toBeVisible();
    expect(await page.getByTestId("demo-workspace").evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
    await page.getByRole("button",{name:"Planmodus",exact:true}).click();await expect(page.getByTestId("workzone-canvas")).toBeVisible();
    if(size.width===1440||size.width===390)await page.screenshot({path:info.outputPath(`scene-${theme}-${size.width}-${size.height}.png`)});
  }
  const after=await(await request.get("/api/demo/baumdienst/workshop")).json();expect(after.state).toEqual(before.state);expect(after.revision).toBe(before.revision);
});
test("multiple pages expose every worksite and keep legacy layout storage separate",async({page,request})=>{
  const company=await prisma.companyProfile.findFirstOrThrow(),ids=Array.from({length:10},()=>randomUUID());
  await prisma.baustelle.createMany({data:ids.map((id,i)=>({id,companyProfileId:company.id,name:`DEMO Scene ${i}`,type:"CLIMBING",status:"active"}))});
  try{
    const before=await(await request.get("/api/demo/baumdienst/workshop")).json();
    await page.addInitScript(()=>localStorage.setItem("workzone:mission-control-canvas:v4","legacy-layout-kept"));await page.setViewportSize({width:390,height:600});await page.goto("/demo/workzone");
    const first=page.getByTestId("muster-site-card").first();await expect(first).toBeVisible();
    const firstHref=(await first.locator('a[href^="/demo/baustellen/"]').getAttribute("href"))!;
    const card=page.getByTestId("muster-site-card").filter({has:page.locator(`a[href="${firstHref}"]`)});
    const label=card.locator('[data-site-name]'); const start=(await label.boundingBox())!;
    const previous=(await card.boundingBox())!;
    await page.mouse.move(start.x+20,start.y+6);await page.mouse.down();await page.mouse.move(start.x+40,start.y+18,{steps:6});await page.mouse.up();
    await expect(async()=>expect((await card.boundingBox())!.x).toBeGreaterThan(previous.x+10)).toPass({timeout:10000});
    const moved=(await card.boundingBox())!;await page.reload();
    await expect(async()=>expect(Math.abs((await card.boundingBox())!.x-moved.x)).toBeLessThan(2)).toPass({timeout:10000});
    const seen=new Set<string>();
    for(let pageNo=0;pageNo<30;pageNo++){
      await expect(page.getByTestId("muster-site-card").first()).toBeVisible();
      for(const href of await page.getByTestId("muster-site-card").locator('a[href^="/demo/baustellen/"]').evaluateAll(es=>es.map(e=>e.getAttribute("href")!)))seen.add(href.split("/").pop()!);
      const next=page.getByRole("button",{name:"Nächste Baustellen",exact:true});if(await next.isDisabled())break;const oldPage=await page.locator('[data-scene-pages] span').innerText();await next.click();await expect(page.locator('[data-scene-pages] span')).not.toHaveText(oldPage);
    }
    for(const id of ids)expect(seen.has(id)).toBe(true);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.addStyleTag({content:"html { font-size:200%; }"});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
    expect(await page.evaluate(()=>localStorage.getItem("workzone:mission-control-canvas:v4"))).toBe("legacy-layout-kept");
    const after=await(await request.get("/api/demo/baumdienst/workshop")).json();expect(after.state).toEqual(before.state);expect(after.revision).toBe(before.revision);
  }finally{await prisma.baustelle.deleteMany({where:{id:{in:ids},companyProfileId:company.id}})}
});
