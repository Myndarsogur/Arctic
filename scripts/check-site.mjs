/* Verify the homepage migration and preservation of the former bilingual introduction.
   PLAYWRIGHT_MODULE=/path/to/package.json node scripts/check-site.mjs
   READER_URL selects a preview or the published site. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium,webkit}=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url)('playwright');
const base=process.env.READER_URL||'http://127.0.0.1:4338/';
const proof=process.env.READER_PROOF_DIR||path.join(root,'verkferlar/2026-10-17-forsida-handbok/profun');
await mkdir(proof,{recursive:true});
const source=JSON.parse(await readFile(path.join(root,'handbok/efni.json'),'utf8'));
const original=execFileSync('git',['show',`${source.source.commit}:${source.source.path}`],{cwd:root});
assert.equal(createHash('sha256').update(original).digest('hex'),source.source.sha256);
const report={url:base,time:new Date().toISOString(),checks:[],errors:[]};
const pass=(name)=>{report.checks.push(name);console.log(`PASS ${name}`);};
const substantive=Object.keys(source.text.en).filter(key=>key.endsWith('-body')||key.startsWith('partner-')||key.endsWith('-meta'));
const bodies=Object.fromEntries(await Promise.all(['is','en'].map(async lang=>[lang,await readFile(path.join(root,lang==='is'?'handbok/index.html':'handbok/en/index.html'),'utf8')])));
for(const html of Object.values(bodies)){
 for(const key of substantive)assert.ok(html.includes(`data-source-key="${key}"`),key);
 for(const [key,href]of Object.entries(source.links).filter(([key])=>key.startsWith('partner-')||key.startsWith('contact-')||key==='cta-primary'))assert.ok(html.includes(href.replaceAll('&','&amp;')),key);
 assert.ok(html.includes('/assets/arctic-wordmark.svg'));
 assert.ok(!html.includes('src="/logo.png"'));
}
assert.ok(!(await readFile(path.join(root,'assets/bref-og.svg'),'utf8')).includes('<text'));
pass('All substantive former homepage text and collaboration links preserved; requested gothic wordmark replaces the iceberg');
for(const [engine,label]of[[chromium,'Chrome'],[webkit,'WebKit']]){
 const b=await engine.launch({headless:true,...(label==='Chrome'?{channel:'chrome'}:{})});
 try{
  const c=await b.newContext({viewport:{width:1440,height:1000}});
  const p=await c.newPage();
  p.on('pageerror',e=>report.errors.push(`${label}: ${e.message}`));
  p.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  for(const width of [320,390,768,1024,1440]){
   await p.setViewportSize({width,height:width>=768?1024:844});
   for(const route of ['','handbok/','handbok/en/']){
    await p.goto(new URL(route,base).href);
    await p.evaluate(()=>document.fonts.ready);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label} ${width} ${route}`);
    assert.equal(await p.evaluate(()=>document.fonts.check('24px Lif','ÁÐÉÍÓÖÞÆÚÝáéíóöþæúýð')),true);
    const headingFont=await p.locator('h1').first().evaluate(h=>getComputedStyle(h).fontFamily);
    assert.ok(headingFont.includes('Lif'));
    assert.ok((await p.locator('.brand').evaluate(h=>getComputedStyle(h).fontFamily)).includes('ArcticLuke'));
    if(route===''){
     assert.equal(await p.locator('.story-card').count(),12);
     assert.equal(await p.locator('.project-link').getAttribute('href'),'/handbok/');
     assert.equal(await p.locator('.mail-art .polar-map').isVisible(),true);
     assert.equal(await p.locator('.mail-art .envelope').isVisible(),true);
     await p.waitForFunction(()=>[...document.querySelectorAll('.mail-art img')].every(i=>i.complete&&i.naturalWidth>0));
     const icelandClear=await p.evaluate(()=>{
      const map=document.querySelector('.mail-art .polar-map'),parent=map.parentElement.getBoundingClientRect(),css=getComputedStyle(map);
      const w=parseFloat(css.width),h=parseFloat(css.height),theta=(-19-115)*Math.PI/180;
      const r=320*Math.tan(Math.PI/4-65*Math.PI/360)/Math.tan(Math.PI/8);
      const x=(360+r*Math.sin(theta))/720*w-w/2,y=(360+r*Math.cos(theta))/720*h-h/2;
      const m=new DOMMatrix(css.transform),px=parent.left+parseFloat(css.left)+w/2+m.a*x+m.c*y,py=parent.top+parseFloat(css.top)+h/2+m.b*x+m.d*y;
      return [...document.querySelectorAll('.mail-art .envelope,.letter-pages img')].every(i=>{const b=i.getBoundingClientRect();return px<b.left||px>b.right||py<b.top||py>b.bottom;});
     });
     assert.equal(icelandClear,true,`${label} ${width}: Iceland must remain outside the envelope and letter images`);
    }else{
     assert.equal(await p.locator('.book-chapter').count(),6);
     assert.equal(await p.locator('.partner-links a').count(),8);
     assert.equal(await p.locator('.book-question').count(),5);
     await p.locator('.book-question summary').last().click();
     assert.equal(await p.locator('.book-question').last().getAttribute('open'),'');
     assert.ok(await p.locator('.dated-note').first().textContent());
    }
    if([390,1440].includes(width)){
     await p.screenshot({path:path.join(proof,`${label.toLowerCase()}-${route.replaceAll('/','-')||'home'}-${width}.png`),fullPage:true});
    }
   }
  }
  pass(`${label}: homepage and bilingual handbook fit 320–1440 pixels with the approved heading font`);
  await p.goto(new URL('ARCTIC/?hofundur=vigd%C3%ADs&sida=6',base).href);
  await p.waitForSelector('#reader[data-story=vigdis][data-page="6"][data-ready=true]');
  assert.equal(new URL(p.url()).pathname,'/');
  assert.ok(p.url().includes('hofundur=vigdis&sida=6'));
  await p.locator('#all-stories').click();
  assert.equal(await p.locator('#continue-author').textContent(),'Vigdís');
  assert.ok((await p.locator('#continue-reading').getAttribute('href')).includes('sida=6'));
  pass(`${label}: old accented author/page links move to the new homepage and retain reading position`);
  for(const id of ['mission','join','workshops','faq','contact']){
   await p.goto(new URL(`#${id}`,base).href);
   await p.waitForURL(`**/handbok/#${id}`);
   assert.equal(await p.locator(`#${id}`).count(),1);
  }
  await p.goto(new URL('handbok/',base).href);
  await p.locator('.book-toc a[href="#workshops"]').click();
  await p.waitForFunction(()=>document.querySelector('.book-toc a[href="#workshops"]').getAttribute('aria-current')==='true');
  await p.locator('.language-link').click();
  assert.equal(await p.locator('html').getAttribute('lang'),'en');
  await p.locator('.project-link').click();
  await p.waitForSelector('.story-card');
  pass(`${label}: former introduction anchors, handbook contents, language switch and return to comics`);
  await c.close();
  const plain=await b.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const noJS=await plain.newPage();
  await noJS.goto(new URL('handbok/',base).href);
  assert.equal(await noJS.locator('.book-chapter').count(),6);
  await noJS.locator('.book-question summary').first().click();
  assert.equal(await noJS.locator('.book-question p').first().isVisible(),true);
  await plain.close();
  pass(`${label}: handbook and questions work without JavaScript`);
 }finally{await b.close();}
}
assert.deepEqual(report.errors,[]);
report.passed=true;
await writeFile(path.join(proof,'site-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:report.checks.length,proof}));
