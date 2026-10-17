/* Export all lettering through the approved Lif artwork renderer. */
import {readFile, writeFile} from 'node:fs/promises';
const moduleURL = process.env.LIF_ARTWORK_MODULE || new URL('../../aron.dad/kynningarefni/letur/smidi/myndefni.mjs',import.meta.url).href;
const {renderLifArtwork} = await import(moduleURL);
const root = new URL('../',import.meta.url);
const inline = async file => (await readFile(new URL(file,root),'utf8')).replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<(title|desc)>[\s\S]*?<\/\1>/g,'');
const map = await inline('assets/skraut/heimskaut.svg');
const envelope = await inline('assets/skraut/umslag.svg');
const art=renderLifArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f6f1e3"/>
<path d="M42 45 1155 43M45 583 1154 586" stroke="#2a2633" stroke-width="3"/>
<g transform="translate(720 46) scale(.61)" opacity=".7">${map}</g>
<g transform="translate(750 202) rotate(-7 200 150) scale(.67)">${envelope}</g>
<text x="59" y="194" font-size="91" fill="#2a2633">Bréf frá</text>
<text x="59" y="303" font-size="73" fill="#2a2633">heimskautinu.</text>
<path d="M63 338Q302 350 581 339" fill="none" stroke="#f6a5c9" stroke-width="11"/>
<text x="61" y="399" font-size="27" fill="#655e6e">12 höfundar · 83 teiknaðar síður</text>
<text x="61" y="530" font-size="24" fill="#2a2633">The Arctic Comics Journal</text>
</svg>`);
await writeFile(new URL('assets/bref-og.svg',root),art.svg);
await writeFile(new URL('assets/bref-og.png',root),art.png);
await writeFile(new URL('ogmynd.png',root),art.png);
console.log(JSON.stringify({built:true,renderer:'approved Lif artwork, outlined lettering, no system fonts',pngBytes:art.png.length}));
