import { expect, type Page, test } from "@playwright/test";

type ProductMode = "baumdienst" | "bau";

const password = "SmokeTest123!";

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signUpTenant(page: Page, mode: ProductMode) {
  const id = uniqueId();
  const email = `saas-${mode}-${id}@example.test`;
  const companyName = `SaaS ${mode} ${id}`;

  await page.goto(`/signup?mode=${mode}`);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.locator('select[name="mode"]').selectOption(mode);
  await page.locator('input[name="displayName"]').fill(companyName);
  await page.locator('input[name="fullName"]').fill(`Smoke ${mode}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Dashboard|Armaturenbrett|Pult|Cruscotto|Panel/i })).toBeVisible();

  return { email, companyName };
}

async function createSiteWithInitialWork(
  page: Page,
  siteName: string,
  species: string,
  diameter: string,
) {
  await page.goto("/app/baustellen");
  await page.locator('input[name="name"]').first().fill(siteName);
  await page.locator('input[name="createFirstTreeItem"]').check();
  await page.locator('input[name="firstTreeSpecies"]').fill(species);
  await page.locator('input[name="firstTreeDiameter"]').fill(diameter);
  await page.locator('button[type="submit"]').last().click();

  const siteRow = page.getByRole("row").filter({ hasText: siteName });
  await expect(siteRow).toBeVisible();
  await expect(siteRow.getByText(/1\s+(Arbeiten|Aufgabe|Task|Compito|Detyre|B[aä]ume|Trees|Alberi|Peme)/i)).toBeVisible();
  return siteRow;
}

async function createProject(page: Page, projectTitle: string, customerName: string) {
  await page.goto("/app/projects");
  const projectForm = page.locator("form").filter({ has: page.locator('input[name="title"]') }).first();
  await projectForm.locator('input[name="title"]').fill(projectTitle);
  await projectForm.locator('input[name="customerName"]').fill(customerName);
  await projectForm.getByRole("button", { name: /Anlegen|Create|Crea|Krijo/i }).click();

  const projectCard = page.locator(".rounded-lg, .overflow-hidden").filter({ hasText: projectTitle }).first();
  await expect(projectCard).toBeVisible();
  await projectCard.getByRole("link", { name: /Kalkulation|Calculation|Calcolo|Kalkulim/i }).click();
  await expect(page).toHaveURL(/\/app\/projects\/[^/]+$/);
  return new URL(page.url()).pathname;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function createWorker(
  page: Page,
  firstName: string,
  lastName: string,
  options: { loginCode?: string; temporary?: boolean } = { temporary: true },
) {
  await page.goto("/app/admin");
  const workerDetails = page.locator("details").filter({ has: page.locator('input[name="firstName"]') }).first();
  await workerDetails.locator("summary").click();
  const workerForm = workerDetails.locator("form").first();
  await workerForm.locator('input[name="firstName"]').fill(firstName);
  await workerForm.locator('input[name="lastName"]').fill(lastName);
  if (options.loginCode) {
    await workerForm.locator('input[name="loginCode"]').fill(options.loginCode);
  }
  if (options.temporary ?? true) {
    await workerForm.locator('input[name="isTemporary"]').check();
  }
  await workerForm.getByRole("button", { name: /Hinzufügen|Add|Aggiungi|Shto/i }).click();

  const workerLink = page.getByRole("link", { name: new RegExp(`${firstName}\\s+${lastName}`) }).first();
  await expect(workerLink).toBeVisible();
  const href = await workerLink.getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

async function loginWorker(page: Page, fullName: string, loginCode: string) {
  await page.goto("/workzone/login");
  await page.locator('input[name="name"]').fill(fullName);
  await page.locator('input[name="loginCode"]').fill(loginCode);
  await page.getByRole("button", { name: /Einloggen|Sign in|Log in|Accedi|Hyr/i }).click();
  await expect(page).toHaveURL(/\/workzone\/profile$/);
  await expect(page.getByText(fullName).first()).toBeVisible();
}

async function startWorkOnSite(page: Page) {
  await page.getByRole("button", { name: /Hier arbeiten|Work here|Lavora qui|Puno ketu/i }).click();
  await expect(page.getByText(/Wann hast du|When did|Quando hai|Kur e/i)).toBeVisible();
  await page.getByRole("button", { name: /gewählte Uhrzeit|selected time|orario selezionato|ora e zgjedhur/i }).click();
  await expect(page.getByRole("button", { name: /Arbeit stoppen|Stop work|Ferma lavoro|Ndalo punen/i })).toBeEnabled();
}

async function openWorkzoneForSite(page: Page, siteName: string) {
  const siteRow = page.getByRole("row").filter({ hasText: siteName });
  await siteRow.getByRole("link", { name: /Workzone/i }).click();
  await expect(page).toHaveURL(/\/workzone\/baustellen\//);
  return new URL(page.url()).pathname;
}

async function editVisibleWorkItem(page: Page, currentText: string, nextText: string, nextDiameter: string) {
  const item = page.locator("li").filter({ hasText: currentText }).first();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: /Bearbeiten|Edit|Modifica|Ndrysho/i }).first().click();
  await expect(page.locator('input[id^="species-"]')).toBeVisible();
  await page.locator('input[id^="species-"]').fill(nextText);
  await page.locator('input[id^="diameter-"]').fill(nextDiameter);
  await page.getByRole("button", { name: /Speichern|Save|Salva|Ruaj/i }).click();
  await expect(page.locator('input[id^="species-"]')).toHaveCount(0);
  await expect(page.getByText(nextText).first()).toBeVisible();
}

async function createExtraWorkItem(page: Page, species: string, diameter: string) {
  await page.getByRole("button", { name: /Zusatzarbeit|Extra Baum|Add extra|Shto|Aggiungi/i }).click();
  await expect(page.locator('input[name="extraTreeSpecies"]')).toBeVisible();
  await page.locator('input[name="extraTreeSpecies"]').fill(species);
  await page.locator('input[name="extraTreeDiameter"]').fill(diameter);
  await page.getByRole("button", { name: /Speichern|Save|Salva|Ruaj/i }).last().click();
  await expect(page.locator('input[name="extraTreeSpecies"]')).toHaveCount(0);
  await expect(page.getByText(species).first()).toBeVisible();
}

async function createAndClearSiteAttentionTask(page: Page, note: string) {
  const noteInput = page.getByPlaceholder(/gereinigt|cleanup|pulizia|pastruar/i);
  await expect(noteInput).toBeVisible();
  const attentionForm = noteInput.locator("xpath=ancestor::form[1]");
  await noteInput.fill(note);
  await page.getByRole("button", { name: /Markieren|Mark|Segna|Sheno/i }).click();
  await expect(attentionForm.locator("li").filter({ hasText: note }).first()).toBeVisible();

  const openTask = attentionForm.locator("li").filter({ hasText: note }).first();
  await openTask.getByRole("button", { name: /Erledigt|Done|Fatto|U krye/i }).click();
  await expect(attentionForm.locator("li").filter({ hasText: note })).toHaveCount(0);
}

async function uploadSiteDocument(page: Page, fileName: string) {
  await page.getByRole("button", { name: /Dokumentation|Documentation|Documentazione|Dokumentacioni/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% RediOnFlow E2E smoke document\n"),
  });
  await expect(dialog.getByText(/Dokument hochgeladen|Document uploaded|Documento caricato|Dokumenti u ngarkua/i)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Dokumentation|Documentation|Documentazione|Dokumentacioni/i }).click();
  await expect(page.getByRole("dialog").getByText(fileName)).toBeVisible();
  return await page.getByRole("dialog").locator("a[href]").first().getAttribute("href");
}

test.describe.configure({ mode: "serial" });

test.describe("SaaS authenticated smoke", () => {
  test("native image optimizer serves the allowlisted landing PNG as WebP", async ({ request }) => {
    const response = await request.get("/_next/image", {
      params: { url: "/landingpagephoto/workzoneliveLight.png", w: "640", q: "75" },
      headers: { accept: "image/webp" },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/webp");
    expect((await response.body()).length).toBeGreaterThan(0);
  });

  test("password forms never fall back to GET before client hydration",async({browser,baseURL})=>{
    const context=await browser.newContext({javaScriptEnabled:false,baseURL});
    try {
      const page=await context.newPage();
      for(const path of ["/signup?mode=bau","/login"]){
        await page.goto(path);
        const form=page.locator("form").filter({has:page.locator('input[name="password"]')});
        await expect(form).toHaveAttribute("method","post");
        await expect(form.locator('button[type="submit"]')).toBeDisabled();
      }
    } finally {await context.close();}
  });
  test("signup creates a BaumdienstFlow tenant and login works afterwards", async ({ page, context }) => {
    const tenant = await signUpTenant(page, "baumdienst");

    await expect(page.locator('a[href="/app/baustellen"]')).toBeVisible();
    await expect(page.locator('a[href="/app/projects"]')).toBeVisible();

    await context.clearCookies();
    await page.goto("/login");
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    await page.locator('input[name="email"]').fill(tenant.email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.getByText(tenant.email)).toBeVisible();
  });

  test("BauFlow signup can create and edit a site task in Workzone", async ({ page }) => {
    const siteName = `Bau smoke ${uniqueId()}`;
    await signUpTenant(page, "bau");

    await createSiteWithInitialWork(page, siteName, "Absperrung vorbereiten", "3");
    await expect(page.locator('select[name="type"]').first()).toHaveValue("SIGNAGE");
    await openWorkzoneForSite(page, siteName);
    await editVisibleWorkItem(page, "Absperrung vorbereiten", "Absperrung final pruefen", "4");
    await createExtraWorkItem(page, "Material aufnehmen", "2");
    await createAndClearSiteAttentionTask(page, `Bau site note ${uniqueId()}`);
    await uploadSiteDocument(page, `bauflow-smoke-${uniqueId()}.pdf`);
  });

  test("private site document allows its tenant, denies foreign/anonymous/guessed/deleted access", async ({ page, context, playwright }) => {
    await signUpTenant(page, "bau");
    const name = `Private storage ${uniqueId()}`;
    await createSiteWithInitialWork(page, name, "Synthetic work", "1");
    const ownerSitePath = await openWorkzoneForSite(page, name);
    const url = await uploadSiteDocument(page, `synthetic-private-${uniqueId()}.pdf`);
    expect(url).toContain("/api/private-files?");
    const read = async (href: string) => page.evaluate(async target => {
      const response = await fetch(target); return {status:response.status,body:await response.text(),cache:response.headers.get("cache-control")};
    },href);
    const own = await read(url!);
    expect(own.status).toBe(200); expect(own.body).toContain("RediOnFlow E2E smoke document");
    expect(own.cache).toContain("no-store");
    const guessed = new URL(url!, page.url()); guessed.searchParams.set("fileName","guessed.pdf");
    expect((await read(guessed.toString())).status).toBe(404);
    const ownerCookies = await context.cookies();
    await context.clearCookies(); await signUpTenant(page, "bau");
    expect((await read(url!)).status).toBe(404);
    const anonymous = await playwright.request.newContext();
    try {
      expect((await anonymous.get(new URL(url!, page.url()).toString())).status()).toBe(401);
      const ref = new URL(url!, page.url()).searchParams;
      const objectPath = `baustelle-private/${ref.get("entityId")}/${ref.get("fileName")}`;
      const storageOrigin = `http://127.0.0.1:${process.env.E2E_STORAGE_MOCK_PORT}`;
      expect((await anonymous.get(`${storageOrigin}/storage/v1/object/public/${objectPath}`)).status()).toBe(404);
      expect((await anonymous.get(`${storageOrigin}/storage/v1/object/authenticated/${objectPath}`)).status()).toBe(403);
    }
    finally { await anonymous.dispose(); }
    await context.clearCookies(); await context.addCookies(ownerCookies);
    // Delete through the owning site's existing document UI.
    await page.goto(ownerSitePath); await page.getByRole("button",{name:/Dokumentation|Documentation|Documentazione|Dokumentacioni/i}).click();
    await page.getByRole("dialog").getByRole("button",{name:/Entfernen|Remove|Rimuovi|Hiq|Löschen|Delete/i}).first().click();
    await expect(page.getByRole("dialog").locator('a[href*="/api/private-files?"]')).toHaveCount(0);
    expect((await read(url!)).status).toBe(404);
  });

  test("real Server Actions transport rejects foreign Origin and worker authority",async({page,context})=>{
    await signUpTenant(page,"bau");
    const firstName=`Role${Date.now()}`,lastName="Synthetic",code="362814";
    await createWorker(page,firstName,lastName,{loginCode:code,temporary:false});
    await page.goto("/app/machines");
    const machineForm=page.locator("form").filter({has:page.locator('input[name="nickname"]:not([type="hidden"])')}).first();
    const own=`Own-machine-${uniqueId()}`;
    await machineForm.locator('input[name="nickname"]').fill(own);
    const submitted=page.waitForRequest(r=>r.method()==="POST" && Boolean(r.headers()["next-action"]));
    await machineForm.locator('button[type="submit"]').click();
    const request=await submitted;
    await expect(page.getByText(own,{exact:true}).first()).toBeVisible();
    const body=request.postDataBuffer()!.toString("utf8");expect(body).toContain(own);
    const headers=await request.allHeaders();
    for(const key of ["content-length","connection","host","cookie"])delete headers[key];
    const cookieHeader=async()=> (await context.cookies()).map(c=>`${c.name}=${c.value}`).join("; ");
    const send=(name:string,origin:string,cookie:string)=>page.request.post("/app/machines",{data:Buffer.from(body.replaceAll(own,name)),headers:{...headers,origin,cookie}});
    const httpControl=`HTTP-control-${uniqueId()}`;
    expect((await send(httpControl,new URL(page.url()).origin,await cookieHeader())).status()).toBe(200);
    await page.goto("/app/machines");await expect(page.getByText(httpControl,{exact:true}).first()).toBeVisible();
    const forged=`Forged-machine-${uniqueId()}`;
    expect((await send(forged,"https://foreign.example.test",await cookieHeader())).status()).toBe(500);
    await page.goto("/app/machines");await expect(page.getByText(forged,{exact:true})).toHaveCount(0);
    const adminCookies=await context.cookies();
    await context.clearCookies();await loginWorker(page,`${firstName} ${lastName}`,code);
    expect((await send(forged,new URL(page.url()).origin,await cookieHeader())).status()).toBe(500);
    const read=await page.evaluate(async()=>{const r=await fetch("/api/portability/export");return r.status;});expect(read).toBe(401);
    for(const path of ["/app/settings","/app/projects","/app/admin","/app/audit"]) {
      await page.goto(path);await expect(page).toHaveURL(/\/(login|signup|admin-login)(\?|$)/);
    }
    await context.clearCookies();await context.addCookies(adminCookies);
    await page.goto("/app/machines");await expect(page.getByText(forged,{exact:true})).toHaveCount(0);
  });

  test("worker photo and document use authenticated body access and remain private across tenants",async({page,context,playwright})=>{
    await signUpTenant(page,"bau");const firstName=`Asset${Date.now()}`,lastName="Synthetic",code="637214";
    await createWorker(page,firstName,lastName,{loginCode:code,temporary:false});
    await context.clearCookies();await loginWorker(page,`${firstName} ${lastName}`,code);
    const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=","base64");
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer:png});
    const image=page.locator('img[src*="/api/private-files?"]').first();
    await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(1);
    const photo=await image.getAttribute("src");expect(photo).toBeTruthy();
    await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({name:"synthetic-worker.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\nsynthetic-worker-document\n%%EOF")});
    const document=page.locator('a[href*="/api/private-files?"]').first();await expect(document).toBeVisible();
    const url=await document.getAttribute("href");expect(url).toBeTruthy();
    const read=(target:string)=>page.evaluate(async href=>{const r=await fetch(href);return {status:r.status,body:await r.text()};},target);
    const body=await read(url!);expect(body.status).toBe(200);expect(body.body).toContain("synthetic-worker-document");
    await context.clearCookies();await signUpTenant(page,"bau");
    expect((await read(url!)).status).toBe(404);expect((await read(photo!)).status).toBe(404);
    const anon=await playwright.request.newContext();
    try{for(const href of [photo!,url!])expect((await anon.get(new URL(href,page.url()).toString())).status()).toBe(401);}finally{await anon.dispose();}
  });

  test("BauFlow worker login can start site work and open the daily report", async ({ page, context }) => {
    const siteName = `Worker day ${uniqueId()}`;
    const firstName = `Worker${Date.now()}`;
    const lastName = "Smoke";
    const loginCode = String(Math.floor(100000 + Math.random() * 900000));
    await signUpTenant(page, "bau");

    await createSiteWithInitialWork(page, siteName, "Tagesarbeit pruefen", "1");
    const workzonePath = await openWorkzoneForSite(page, siteName);
    await createWorker(page, firstName, lastName, { loginCode, temporary: false });

    await context.clearCookies();
    await loginWorker(page, `${firstName} ${lastName}`, loginCode);

    await page.goto(workzonePath);
    await startWorkOnSite(page);

    await page.goto(`/workzone/profile/day/${todayKey()}`);
    await expect(page.getByRole("heading", { name: /Tagesbericht|Daily report|Report giornaliero|Raporti ditor/i })).toBeVisible();
    await expect(page.getByText(siteName).first()).toBeVisible();
  });

  test("BaumdienstFlow signup can create and edit a tree in Workzone", async ({ page }) => {
    const siteName = `Baum smoke ${uniqueId()}`;
    await signUpTenant(page, "baumdienst");

    await createSiteWithInitialWork(page, siteName, "Ahorn", "40");
    await openWorkzoneForSite(page, siteName);
    await editVisibleWorkItem(page, "Ahorn", "Linde", "42");
    await createExtraWorkItem(page, "Eiche", "30");
  });

  test("BauFlow signup shows Baustellen but hides tree-only project modules", async ({ page }) => {
    await signUpTenant(page, "bau");

    await expect(page.locator('a[href="/app/baustellen"]').first()).toBeVisible();
    await expect(page.locator('a[href="/app/projects"]')).toHaveCount(0);
  });

  test("signup only offers BaumdienstFlow and BauFlow; an unknown mode falls back to BaumdienstFlow", async ({ page }) => {
    await page.goto("/signup?mode=personal");
    const modeSelect = page.locator('select[name="mode"]');
    await expect(modeSelect).toHaveValue("baumdienst");
    await expect(modeSelect.locator("option")).toHaveCount(2);
  });

  test("SaaS tenants cannot read another tenant's admin, Workzone, project, worker, or export data", async ({
    page,
    context,
  }) => {
    const siteName = `Tenant isolation ${uniqueId()}`;
    const projectTitle = `Tenant project ${uniqueId()}`;
    const workerFirstName = `TenantA${Date.now()}`;
    const workerLastName = "Worker";
    await signUpTenant(page, "bau");
    const foreignCookie = (await context.cookies()).find(cookie => cookie.name === "bk_admin_id")!;
    const foreignAdminId = JSON.parse(Buffer.from(foreignCookie.value.split(".")[0], "base64url").toString()).id as string;
    const siteRow = await createSiteWithInitialWork(page, siteName, "Fremdzugriff pruefen", "1");
    const exportHref = await siteRow.getByRole("link", { name: /Export/i }).getAttribute("href");
    expect(exportHref).toBeTruthy();
    const foreignWorkzonePath = await openWorkzoneForSite(page, siteName);
    const foreignProjectPath = await createProject(page, projectTitle, "Tenant A Customer");
    const foreignWorkerPath = await createWorker(page, workerFirstName, workerLastName);

    await context.clearCookies();
    await signUpTenant(page, "bau");

    await page.goto("/app/baustellen");
    await expect(page.getByText(siteName)).toHaveCount(0);
    await page.goto("/app/admin");
    await expect(page.getByText(`${workerFirstName} ${workerLastName}`)).toHaveCount(0);

    const workzoneResponse = await page.goto(foreignWorkzonePath);
    expect(workzoneResponse?.status()).toBe(404);
    await expect(page.getByText(siteName)).toHaveCount(0);

    const exportResponse = await page.goto(exportHref!);
    expect(exportResponse?.status()).toBe(404);

    const adminProfileResponse = await page.goto(`/workzone/admin-profile/${foreignAdminId}`);
    expect(adminProfileResponse?.status()).toBe(404);

    const projectResponse = await page.goto(foreignProjectPath);
    expect(projectResponse?.status()).toBe(404);
    const projectSummaryResponse = await page.goto(`${foreignProjectPath}/summary`);
    expect(projectSummaryResponse?.status()).toBe(404);
    const workerResponse = await page.goto(foreignWorkerPath);
    expect(workerResponse?.status()).toBe(404);
    for (const reportPath of ["day/2026-10-01","month/2026-10"]) {
      expect((await page.goto(`${foreignWorkerPath}/${reportPath}`))?.status()).toBe(404);
    }

    const portabilityResponse = await page.evaluate(async () => {
      const response = await fetch("/api/portability/export");
      return { status: response.status, body: await response.text() };
    });
    expect(portabilityResponse.status).toBe(200);
    const body = portabilityResponse.body;
    expect(body).not.toContain(siteName);
    expect(body).not.toContain(projectTitle);
    expect(body).not.toContain(workerFirstName);
  });
  test("runtime pilot DailyPlan persists worker assignment and note; tenant B never renders tenant A plan", async ({ page, context }) => {
    const siteName = `RLS pilot site ${uniqueId()}`;
    const firstName = `RLSPilot${Date.now()}`;
    const workerName = `${firstName} Synthetic`;
    const note = `Synthetic RLS plan note ${uniqueId()}`;
    await signUpTenant(page, "bau");
    await createSiteWithInitialWork(page, siteName, "Synthetic pilot work", "1");
    await createWorker(page, firstName, "Synthetic");
    const ownerCookies = await context.cookies();
    const date = todayKey();
    await page.goto(`/workzone/plan?date=${date}`);
    const column = page.getByRole("heading", { name: siteName, exact: true }).locator("..").locator("..");
    await page.getByRole("button", { name: workerName, exact: true }).click();
    await page.getByRole("heading", { name: siteName, exact: true }).click();
    await expect(column.getByText(`👷 ${workerName}`, { exact: true })).toBeVisible();
    await column.getByRole("button", { name: /^(Notiz|Note|Nota|Shenim)$/i }).click();
    const dialog = page.getByRole("heading", { name: new RegExp(`^(Notiz|Note|Nota|Shenim): ${siteName}$`) }).locator("..").locator("..");
    await dialog.locator("textarea").fill(note);
    const updated = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/workzone/plan"));
    await dialog.getByRole("button", { name: /Speichern|Save|Salva|Ruaj/i }).click();
    expect((await updated).ok()).toBe(true);
    await page.getByRole("button", { name: /^(Plan speichern|Save plan|Salva piano|Ruaj planin)$/i }).click();
    await expect(page.getByText(/Tag gespeichert|Day saved|Giornata salvata|Dita u ruajt/i)).toBeVisible();
    await page.reload();
    await expect(column.getByText(`👷 ${workerName}`, { exact: true })).toBeVisible();
    await expect(column.getByRole("button", { name: /^(Notiz|Note|Nota|Shenim)$/i })).toHaveAttribute("title", new RegExp(note));
    await context.clearCookies(); await signUpTenant(page, "bau");
    await page.goto(`/workzone/plan?date=${date}`);
    await expect(page.getByText(siteName)).toHaveCount(0);
    await expect(page.getByText(workerName)).toHaveCount(0);
    await expect(page.getByText(note)).toHaveCount(0);
    await context.clearCookies(); await context.addCookies(ownerCookies);
    await page.goto(`/workzone/plan?date=${date}`);
    await expect(column.getByText(`👷 ${workerName}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^(Alles leeren|Clear all|Svuota tutto|Pastro te gjitha)$/i }).click();
    await expect(column.getByText(`👷 ${workerName}`, { exact: true })).toHaveCount(0);
  });


});
