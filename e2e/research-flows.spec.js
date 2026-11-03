import { test, expect } from '@playwright/test';

async function register(page, track) {
  await page.goto('/auth?mode=register');
  await page.locator('#reg-name').fill('Research fixture');
  const email=`${track}-${Date.now()}@example.com`;
  await page.locator('#reg-email').fill(email);
  await page.locator('#reg-password').fill('research-fixture-9');
  await page.locator('#reg-confirm').fill('research-fixture-9');
  await page.locator('#register-submit-btn').click();
  await expect(page).toHaveURL(/\/app/);
  await page.reload();
  await expect(page.locator('#sidebar-logout-btn')).toBeAttached();
  return email;
}

for (const track of ['child', 'adult']) {
  test(`${track}: questionnaire, unavailable gaze, retry, saved refresh and PDF`, async ({ page }) => {
    const email=await register(page, track);
    await page.route('**/gaze/status', route => route.fulfill({json:{available:false,openface_available:false,detail:'Controlled unavailable fixture'}}));
    await page.goto(`/app/screening/${track}`);
    await expect(page.getByRole('checkbox')).toHaveCount(4);
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    if (track === 'child') await page.getByLabel('Your relationship to the child').fill('Parent');
    await page.getByLabel(track === 'child' ? 'Child’s age' : 'Your age', {exact:true}).fill(track === 'child' ? '8' : '30');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    // Use each named question control; these are real DOM interactions, no scoring mock.
    for (let i=1;i<=10;i++) {
      await page.getByRole('button',{name:new RegExp(`^Go to question ${i}(?: |$)`)}).click();
      await page.getByRole('radio',{name:'Definitely agree',exact:true}).click();
    }
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Continue without gaze (service unavailable)'}).click();
    await page.getByRole('button',{name:/Skip this step/}).click();
    await page.getByRole('button',{name:'Skip facial step'}).click();
    // Ambiguous response loss: let the real server persist, then drop the response once.
    let originalId;
    await page.route('**/screening/screen', async route => {
      const res=await route.fetch(); originalId=(await res.json()).caseId;
      await route.abort('failed');
      await page.unroute('**/screening/screen');
    });
    await page.getByRole('button',{name:`Submit ${track} screening`}).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button',{name:`Submit ${track} screening`}).click();
    await expect(page).toHaveURL(new RegExp(`/app/results/${originalId}`));
    await expect(page.getByLabel('Score 4 out of 10')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Score 4 out of 10')).toBeVisible();
    const download=page.waitForEvent('download');
    await page.locator('#download-pdf-btn').click();
    expect((await download).suggestedFilename()).toContain(originalId);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('/app/cases');
    await expect(page.getByText(originalId,{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Open result',exact:true}).click();
    await expect(page.getByLabel('Score 4 out of 10')).toBeVisible();
    await page.locator('#mobile-menu-btn').click();
    await page.locator('#sidebar-logout-btn').click();
    await page.goto(`/app/results/${originalId}`);
    await expect(page).toHaveURL(/\/auth/);
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill('research-fixture-9');
    await page.locator('#login-submit-btn').click();
    await expect(page).toHaveURL(/\/app/);
    await page.goto(`/app/results/${originalId}`);
    await expect(page.getByLabel('Score 4 out of 10')).toBeVisible();
  });
}

test('toddler: questionnaire editing, server result, history, refresh and PDF', async ({page}) => {
  await register(page,'toddler');
  await page.goto('/app/screening/toddler');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await page.getByLabel(/Age in months/).fill('20');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Begin the questions'}).click();
  for(let i=0;i<10;i++) {
    await page.getByRole('radio').first().click();
    await page.getByRole('button',{name:i===9 ? /Review/ : /^Next/}).click();
  }
  await page.getByRole('button',{name:'Change answer to question 1',exact:true}).click();
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'Return to review',exact:true}).click();
  await page.getByRole('button',{name:'Send my answers'}).click();
  await expect(page).toHaveURL(/\/app\/results\//);
  await expect(page.getByLabel('Score 1 out of 10')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Score 1 out of 10')).toBeVisible();
  const download=page.waitForEvent('download'); await page.locator('#download-pdf-btn').click(); await download;
});

test('gaze camera-denied retry/skip never uploads (controlled media boundary)',async({page})=>{
 await register(page,'gaze-denial');
 await page.addInitScript(()=>{
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.reject(new DOMException('Controlled permission denial','NotAllowedError'))}});
 });
 await page.route('**/gaze/status',r=>r.fulfill({json:{available:true,openface_available:true,media_timing_available:true,model_version:'fixture'}}));
 let uploads=0;page.on('request',r=>{if(r.url().endsWith('/gaze/analyze'))uploads++;});
 await page.goto('/app/screening/child');await expect(page.getByRole('checkbox')).toHaveCount(4);
 for(const box of await page.getByRole('checkbox').all())await box.check();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Your relationship to the child').fill('Parent');await page.getByLabel('Child’s age',{exact:true}).fill('8');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 for(let i=1;i<=10;i++){
   await page.getByRole('button',{name:new RegExp(`^Go to question ${i}(?: |$)`)}).click();
   await page.getByRole('radio',{name:'Definitely agree',exact:true}).click();
 }
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Start camera check'}).click();await expect(page.getByRole('alert')).toContainText('permission was denied');
 await page.getByRole('button',{name:'Try again (new recording)'}).click();await expect(page.getByRole('alert')).toContainText('permission was denied');
 await page.getByRole('button',{name:'Skip the gaze step (the report will say why)'}).click();
 await expect(page.getByText('Speech Sample (Optional)',{exact:true})).toBeVisible();expect(uploads).toBe(0);
});
