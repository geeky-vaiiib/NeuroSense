import process from 'node:process';
import { test, expect } from '@playwright/test';
const API=process.env.NS_E2E_API || 'http://127.0.0.1:8000';

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

test('adult speech-emotion: numeric audio fixture, real model, saved refresh and PDF', async ({page}) => {
  await register(page, 'emotion');
  // Generated engineering tone, not human speech or evidence of emotion accuracy.
  const { Buffer } = await import('node:buffer');
  const sr=22050, n=sr*6, wav=Buffer.alloc(44+n*2);
  wav.write('RIFF',0);wav.writeUInt32LE(36+n*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++) wav.writeInt16LE(Math.round(8000*Math.sin(2*Math.PI*180*i/sr)),44+i*2);
  const res=await page.request.post(`${API}/screening/screen`, {
    headers:{'X-Requested-With':'NeuroSense'},data:{category:'adult',demo:{subjectName:'Technical fixture',respondentName:'Operator',respondentRelationship:'Self',age:30,gender:'Prefer not to say',jaundice:'No',familyAsd:'No'},
      answers:Object.fromEntries(Array.from({length:10},(_,i)=>[`A${i+1}`,'Definitely agree'])),gazeSkipped:true,speechSkipped:false,facialSkipped:true,audioMimeType:'audio/wav',audioBase64:wav.toString('base64')}});
  expect(res.ok()).toBeTruthy();const body=await res.json();
  expect(body.result.modalities_in_result).toEqual(['questionnaire']);
  await page.goto(`/app/results/${body.caseId}`);
  await expect(page.getByRole('heading',{name:'Your screening summary'})).toBeVisible();
  const details=page.getByTestId('technical-details');await expect(details).not.toHaveAttribute('open');
  await expect(page.getByText('Mean pitch:',{exact:false})).not.toBeVisible();
  if(process.env.NS_RESULTS_QA_DIR){
    const {mkdir}=await import('node:fs/promises');await mkdir(process.env.NS_RESULTS_QA_DIR,{recursive:true});
    await page.screenshot({path:`${process.env.NS_RESULTS_QA_DIR}/results-mobile-simple.png`,fullPage:true});
    await page.setViewportSize({width:1440,height:1100});
    await page.screenshot({path:`${process.env.NS_RESULTS_QA_DIR}/results-desktop-simple.png`,fullPage:true});
  }
  await page.getByText('Technical details',{exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open');
  if(process.env.NS_RESULTS_QA_DIR){await page.getByRole('heading',{name:'Supplementary questionnaire model',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.NS_RESULTS_QA_DIR}/results-desktop-expanded.png`});}
  if(process.env.NS_RESULTS_QA_DIR){await page.setViewportSize({width:390,height:844});await page.getByText('Technical details',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.NS_RESULTS_QA_DIR}/results-mobile-expanded.png`});}
  await page.route('**/explain/**',r=>r.fulfill({status:503,json:{detail:'Controlled explanation failure'}}));
  await page.getByRole('button',{name:'Load model explanations'}).click();
  await expect(page.getByRole('alert')).toContainText('saved result is unchanged');
  await expect(page.getByRole('heading',{name:'Your screening summary'})).toBeVisible();
  const card=page.getByLabel(/^Speech emotion \(CNN/);
  await expect(card.getByText(/Predicted class:/)).toBeVisible();
  await expect(card.getByText('Not used for the result')).toBeVisible();
  const before=await card.getByRole('listitem').allTextContents();await page.reload();await page.getByText('Technical details',{exact:true}).click();await expect(card.getByRole('listitem')).toHaveText(before);
  await expect(page.getByLabel('Score 4 out of 10')).toBeVisible();
  const download=page.waitForEvent('download');await page.locator('#download-pdf-btn').click();
  expect((await download).suggestedFilename()).toContain(body.caseId);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('recorded example is explicit, uses saved model versions, downloads without creating a case',async({page})=>{
 await register(page,'recorded-example');
 const before=await (await page.request.get(`${API}/cases/`)).json();
 await page.goto('/app/recorded-example');
 await expect(page.getByText(/not a multimodal participant/)).toBeVisible();
 await page.getByRole('button',{name:'Load recorded example'}).click();
 await expect(page.getByLabel('Unified research report')).toBeVisible();
 await page.getByText('Technical details',{exact:true}).click();
 for(const version of ['facial-v1','speech-v1','gaze-v1'])await expect(page.getByText(`Model version: ${version}`,{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download example report'}).click();
 expect((await download).suggestedFilename()).toContain('RECORDED-RESEARCH-EXAMPLE');
 const after=await (await page.request.get(`${API}/cases/`)).json();expect(after).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('expired session restores owner-scoped answers in the same tab after sign-in',async({page})=>{
 const email=await register(page,'draft-recovery');
 await page.goto('/app/screening/adult');for(const box of await page.getByRole('checkbox').all())await box.check();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Your age',{exact:true}).fill('30');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('radio',{name:'Definitely agree',exact:true}).click();
 // Controlled expiry notification, with real logout/re-authentication. No server authentication bypass.
 await page.request.post(`${API}/auth/logout`,{headers:{'X-Requested-With':'NeuroSense'}});
 await page.evaluate(()=>window.dispatchEvent(new Event('ns:session-expired')));
 await expect(page).toHaveURL(/\/auth/);
 await page.locator('#login-email').fill(email);await page.locator('#login-password').fill('research-fixture-9');await page.locator('#login-submit-btn').click();
 await expect(page).toHaveURL(/\/app\/screening\/adult/);
 await page.getByRole('button',{name:/^Go to question 1 /}).click();
 await expect(page.getByRole('radio',{name:'Definitely agree',exact:true})).toHaveAttribute('aria-checked','true');
});
