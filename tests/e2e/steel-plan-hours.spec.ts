import { test, expect } from '@playwright/test';
import { prisma } from '../../src/lib/db/prisma';
import { seedSteelAssetsWorkshop, cleanupSteelAssetsWorkshop } from '../fixtures/steel-assets-workshop';
import { assertE2ETestDatabase, validateE2ETarget } from '../../scripts/lib/e2e-target';
import { dateKey, dayRange } from '../../src/lib/workzone/date-utils';
const workDateTimeInput = (date: Date) => `${dateKey(date)}T${new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tirane',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)}`;

const baseline = process.env.STEEL_PLAN_HOURS_BASELINE === 'true';
const evidence = (name: string) => `${process.env.STEEL_PLAN_HOURS_EVIDENCE_DIR ?? test.info().outputDir}/${name}`;
test('compact plan plates, a fixed-width archive and a timezone-safe restart', async ({ page, context, baseURL }) => {
  test.setTimeout(150000); assertE2ETestDatabase(process.env);
  const origin = validateE2ETarget(baseURL!).baseURL;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addCookies([{ name: 'bk_lang', value: 'sq', url: origin }]);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let companyId: string | undefined;
  try {
    const email = `plan-hours-${Date.now()}@example.test`;
    await page.goto('/signup?mode=bau');
    for (const [name,value] of Object.entries({ displayName:'Synthetic plan',fullName:'Synthetic Chief',email,password:'Synthetic-Plan-Only-2026!' })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('button[type=submit]').click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
    companyId=(await prisma.user.findUniqueOrThrow({where:{email}})).companyProfileId!;
    const seed=await seedSteelAssetsWorkshop(companyId,`plan-${Date.now()}`);
    const machines=seed.machines.slice(0,2);
    for (let i=0;i<2;i++) await prisma.machine.update({where:{id:machines[i].id},data:{name:`Synthetic excavator ${i}`,nickname:`Excavator ${i?'small':'large'}`,targe:`ZZ ${i?'202':'101'} DM`}});
    const plan=await prisma.dailyWorkPlan.create({data:{companyProfileId:companyId,planDate:dayRange(dateKey(new Date())).start,columns:{create:{baustelleId:seed.site.id,title:seed.site.name,assignments:{create:machines.map(machine=>({kind:'MACHINE' as const,machineId:machine.id,labelSnapshot:'Excavator'}))}}}}});
    const now=Date.now(),start=new Date(now-3*3600000),end=new Date(now-2*3600000);
    await prisma.workSession.create({data:{workerId:seed.worker.id,startTime:start,endTime:end,breakMinutes:0,totalHours:1,isLive:false}});
    for(const width of [1440,360]) for(const theme of ['light','dark']) {
      await page.setViewportSize({width,height:900}); await page.emulateMedia({colorScheme:theme as 'light'|'dark'});
      await context.addCookies([{name:'bk_theme',value:theme,url:origin}]);
      await page.goto('/workzone/plan'); await page.getByRole('tab',{name:/Mjete/}).click();
      await expect(page.getByTestId('plan-pick-list')).toBeVisible();
      if(!baseline) { await expect(page.getByTestId('plan-pick-list')).toContainText('ZZ 101 DM'); await expect(page.getByTestId('plan-pick-list')).toContainText('ZZ 202 DM'); }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:evidence(`${baseline?'before':'after'}-plan-${theme}-${width}.png`)});
      await page.goto('/workzone');
      const archive=page.getByRole('heading',{name:'Arkiva ditore',exact:true}).locator('..');
      await archive.scrollIntoViewIfNeeded();
      if(!baseline) expect(await archive.evaluate(el=>[el,...el.querySelectorAll('*')].every(child=>child.scrollWidth<=child.clientWidth+1))).toBe(true);
      await page.screenshot({path:evidence(`${baseline?'before':'after'}-archive-${theme}-${width}.png`)});
    }
    if(baseline)return;
    await page.goto('/workzone/plan'); await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('saved-plan')).toContainText('Excavator · ZZ 101 DM');
    await expect(page.getByTestId('saved-plan')).toContainText('Excavator · ZZ 202 DM');
    await expect(page.getByText('Ka ndryshime pa ruajtur',{exact:true})).toHaveCount(0);
    const saved=await prisma.dailyWorkPlanSavedRow.findMany({where:{planId:plan.id}}); expect(saved[0].machineNames).toContain('ZZ 101 DM');
    await page.goto(`/workzone/admin-workers/${seed.worker.id}`);
    await page.getByRole('button',{name:'Fillo punen',exact:true}).click();
    const suggested=await page.locator('#startTime').inputValue(); expect(suggested).toBe(workDateTimeInput(new Date()));
    await page.locator('#startTime').fill(workDateTimeInput(start));
    await page.getByRole('button',{name:/ora e zgjedhur|Selected time|Gewählte Zeit/i}).click();
    await expect(page.getByText(/Ky fillim mbivendoset/)).toBeVisible();
    expect(await prisma.workSession.count({where:{workerId:seed.worker.id}})).toBe(1);
    await page.getByRole('button',{name:/Tani|Now|Jetzt/,exact:true}).click();
    await expect.poll(()=>prisma.workSession.count({where:{workerId:seed.worker.id,isLive:true}})).toBe(1);
    const live=await prisma.workSession.findFirstOrThrow({where:{workerId:seed.worker.id,isLive:true}});
    expect(Math.abs(Date.now()-live.startTime.getTime())).toBeLessThan(65000);
    expect(errors).toEqual([]);
  }finally{if(companyId)await cleanupSteelAssetsWorkshop(companyId);}
});
