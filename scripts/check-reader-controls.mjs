/* Verify immersive reading, temporary controls, touch and keyboard access.
   PLAYWRIGHT_MODULE=/path/to/package.json node scripts/check-reader-controls.mjs */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium,webkit}=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url)('playwright');
const base=process.env.READER_URL||'http://127.0.0.1:4338/';
const proof=process.env.READER_PROOF_DIR||fileURLToPath(new URL('../verkferlar/2026-10-17-lesstika/profun',import.meta.url));
await mkdir(proof,{recursive:true});
const report={base,time:new Date().toISOString(),checks:[],errors:[]};
const pass=name=>{report.checks.push(name);console.log(`PASS ${name}`);};
const ready=async p=>{
 await p.goto(new URL('?hofundur=breki&sida=2',base).href);
 await p.waitForSelector('#reader[data-ready=true][data-page="2"]');
 await p.evaluate(()=>document.fonts.ready);
};
for(const [engine,name] of [[chromium,'Chrome'],[webkit,'WebKit']]){
 const browser=await engine.launch({headless:true,...(name==='Chrome'?{channel:'chrome'}:{})});
 try{
  const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await touchContext.newPage();
  page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
  for(const [width,height] of [[320,844],[390,844],[768,1024],[1024,768],[844,390],[1440,1000]]){
   await page.setViewportSize({width,height});
   await ready(page);
   const fit=await page.evaluate(()=>{
    const image=document.querySelector('#page-image'),rect=image.getBoundingClientRect();
    const space=document.querySelector('.reading-space'),style=getComputedStyle(space);
    const w=innerWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    const h=innerHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    const scale=Math.min(w/image.naturalWidth,h/image.naturalHeight);
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,
     height:space.getBoundingClientRect().height,viewport:innerHeight,
     widthDifference:Math.abs(rect.width-image.naturalWidth*scale),heightDifference:Math.abs(rect.height-image.naturalHeight*scale),
     controls:[...document.querySelectorAll('#reader-controls>a,#reader-controls>button')].every(b=>{
      const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width>=43&&r.height>=43;
     })};
   });
   assert.equal(fit.overflow,false,`${name} ${width}: no horizontal overflow`);
   assert.ok(Math.abs(fit.height-fit.viewport)<2,`${name} ${width}: page has the full viewport`);
   assert.ok(fit.widthDifference<2&&fit.heightDifference<2,`${name} ${width}: entire artwork uses the available space ${JSON.stringify(fit)}`);
   assert.equal(fit.controls,true,`${name} ${width}: all controls are reachable touch targets`);
   if([390,844,1024].includes(width))await page.screenshot({path:path.join(proof,`${name}-${width}-strip.png`)});
  }
  pass(`${name}: artwork fills available space without cropping at phone, tablet, desktop and landscape sizes`);
  await page.setViewportSize({width:390,height:844});
  await ready(page);
  const artBefore=await page.locator('#page-image').boundingBox();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#reader-controls')).visibility==='hidden');
  assert.equal(await page.getByRole('button',{name:'Næsta síða',exact:true}).count(),0);
  assert.equal(await page.locator('#page-art').getAttribute('aria-expanded'),'false');
  const artAfter=await page.locator('#page-image').boundingBox();
  assert.deepEqual(artAfter,artBefore,'Hiding the strip must not move or resize the artwork');
  assert.equal(await page.locator('#reader-controls').evaluate(bar=>{
   const box=bar.getBoundingClientRect();
   return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest('#reader-controls')===null;
  }),true,'The hidden strip must not intercept touches');
  await page.screenshot({path:path.join(proof,`${name}-390-quiet.png`)});
  await page.locator('#page-art').tap();
  await page.locator('#reader-controls').waitFor({state:'visible'});
  assert.equal(await page.locator('#zoom-dialog').isVisible(),false);
  await page.locator('#next-page').tap();
  await page.waitForSelector('#reader[data-ready=true][data-page="3"]');
  await page.locator('#page-art').tap();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#reader-controls')).visibility==='hidden');
  await page.locator('#page-art').tap();
  await page.locator('#page-counter').tap();
  await page.waitForTimeout(3300);
  assert.equal(await page.locator('#pages-dialog').isVisible(),true);
  await page.getByRole('button',{name:'Síða 4',exact:true}).tap();
  await page.waitForSelector('#reader[data-ready=true][data-page="4"]');
  assert.equal(await page.locator('#reader-controls').isVisible(),true);
  await page.locator('#zoom-page').tap();
  await page.locator('#zoom-dialog').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Loka stækkun',exact:true}).tap();
  assert.equal(await page.locator('#reader-controls').isVisible(),true);
  pass(`${name}: strip fades after inactivity, does not shift artwork, wakes on tap and remains usable through dialogs`);
  await touchContext.close();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const desktop=await context.newPage();
  await ready(desktop);
  await desktop.waitForFunction(()=>getComputedStyle(document.querySelector('#reader-controls')).visibility==='hidden');
  await desktop.mouse.move(400,400);
  await desktop.locator('#reader-controls').waitFor({state:'visible'});
  await desktop.locator('#next-page').hover();
  await desktop.waitForTimeout(3300);
  assert.equal(await desktop.locator('#reader-controls').isVisible(),true,'Do not hide a strip under the mouse');
  await desktop.mouse.move(10,10);
  await desktop.waitForFunction(()=>getComputedStyle(document.querySelector('#reader-controls')).visibility==='hidden');
  // Tab must restore the inert controls before normal browser focus traversal.
  await desktop.locator('#page-art').focus();
  await desktop.keyboard.press('Tab');
  assert.equal(await desktop.locator('#all-stories').evaluate(b=>b===document.activeElement),true);
  await desktop.waitForTimeout(3300);
  assert.equal(await desktop.locator('#reader-controls').isVisible(),true,'Keep keyboard-focused controls visible');
  await desktop.keyboard.press('Tab');
  assert.equal(await desktop.locator('#previous-page').evaluate(b=>b===document.activeElement),true);
  await desktop.keyboard.press('Enter');
  await desktop.waitForSelector('#reader[data-ready=true][data-page="1"]');
  pass(`${name}: mouse movement wakes the strip, hover protects it and Tab restores working keyboard navigation`);
  await context.close();
 }finally{await browser.close();}
}
assert.deepEqual(report.errors,[]);
report.passed=true;
await writeFile(path.join(proof,'controls-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:report.checks.length,proof}));
