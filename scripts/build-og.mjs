/* Approved Lif outlines for lettering, original Luke outlines for the name.
   Chrome rasterizes the geographic paths; no live text or system fonts enter the image.
   PLAYWRIGHT_MODULE=/path/to/package.json node scripts/build-og.mjs */
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const moduleURL=process.env.LIF_ARTWORK_MODULE||new URL('../../aron.dad/kynningarefni/letur/smidi/myndefni.mjs',import.meta.url).href;
const {renderLifArtwork}=await import(moduleURL);
const {chromium}=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url)('playwright');
const root=new URL('../',import.meta.url);
const inside=svg=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<(title|desc)>[\s\S]*?<\/\1>/g,'');
const read=async file=>readFile(new URL(file,root),'utf8');
const nameSVG=await read('assets/arctic-name.svg');
const nameViewBox=nameSVG.match(/viewBox="([^"]+)"/)[1];
const lettering=renderLifArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<text x="600" y="215" text-anchor="middle" font-size="25" fill="#526f79">kynnir</text>
<text x="600" y="350" text-anchor="middle" font-size="110" fill="#23424c">Bréf frá</text>
<text x="600" y="475" text-anchor="middle" font-size="92" fill="#23424c">heimskautinu</text></svg>`);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>Bréf frá heimskautinu · The Arctic Comics Journal</title>
<rect width="1200" height="630" fill="#edf5f5"/>
<svg x="210" y="94" width="780" height="72" viewBox="${nameViewBox}" fill="#23424c">${inside(nameSVG)}</svg>
${inside(lettering.svg)}
<path d="M154 548c144-13 270 7 404-2s323-3 488-1" fill="none" stroke="#a2c6ce" stroke-width="2.5"/>
</svg>`;
if(/<text\b/.test(svg))throw new Error('All distributed lettering must be outlined');
await writeFile(new URL('assets/bref-og.svg',root),svg);
const browser=await chromium.launch({channel:'chrome',headless:true});
let png;
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.goto(new URL('assets/bref-og.svg',root).href);
 png=await page.screenshot({path:fileURLToPath(new URL('assets/bref-og.png',root))});
}finally{await browser.close();}
await writeFile(new URL('ogmynd.png',root),png);
const mark=inside(await read('assets/arctic-mark.svg'));
for(const file of ['apple-touch-icon.png','apple-icon.png','apple-icon-precomposed.png','apple-icon-57x57.png','apple-icon-60x60.png','apple-icon-72x72.png','apple-icon-76x76.png','apple-icon-114x114.png','apple-icon-120x120.png','apple-icon-144x144.png','apple-icon-152x152.png','apple-icon-180x180.png','android-icon-36x36.png','android-icon-48x48.png','android-icon-72x72.png','android-icon-96x96.png','android-icon-144x144.png','android-icon-192x192.png','android-chrome-192x192.png','android-chrome-512x512.png','favicon-16x16.png','favicon-32x32.png','favicon-96x96.png','ms-icon-70x70.png','ms-icon-144x144.png','ms-icon-150x150.png','ms-icon-310x310.png']){
 const known={'apple-touch-icon.png':180,'apple-icon.png':192,'apple-icon-precomposed.png':192};
 const size=known[file]||Number(file.match(/(\d+)x\d+/)[1]);
 const icon=renderLifArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${mark}</svg>`);
 await writeFile(new URL(file,root),icon.png);
}
const sizes=[16,32,48];
const entries=sizes.map(size=>renderLifArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${mark}</svg>`).png);
const directory=Buffer.alloc(6+16*entries.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(entries.length,4);
let offset=directory.length;
entries.forEach((entry,i)=>{const at=6+i*16;directory[at]=sizes[i];directory[at+1]=sizes[i];directory.writeUInt16LE(1,at+4);directory.writeUInt16LE(32,at+6);directory.writeUInt32LE(entry.length,at+8);directory.writeUInt32LE(offset,at+12);offset+=entry.length;});
await writeFile(new URL('favicon.ico',root),Buffer.concat([directory,...entries]));
console.log(JSON.stringify({built:true,renderer:'approved Lif + original Luke outlines, no system-font fallback',pngBytes:png.length}));
