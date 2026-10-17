"""Build a self-hosted reader for the twelve original Arctic stories."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from html import escape
from pathlib import Path
from PIL import Image,ImageOps
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'ARCTIC'

def build_page(page):
    original=OUT/page['original']
    data=original.read_bytes()
    assert sha256(data).hexdigest()==page['sha256'],str(original)
    result={'number':page['number'],'original':{'src':page['original'],'bytes':len(data),'sha256':page['sha256']}}
    with Image.open(original) as source:
        im=ImageOps.exif_transpose(source)
        result['original'].update(width=im.width,height=im.height)
        if 'A' in im.getbands():
            opaque=Image.new('RGB',im.size,'white');opaque.paste(im,mask=im.getchannel('A'));im=opaque
        else:im=im.convert('RGB')
        for kind,size,quality in [('read',(1800,2400),86),('thumb',(420,560),82)]:
            preview=im.copy();preview.thumbnail(size,Image.Resampling.LANCZOS)
            path=original.with_name(f'{page["number"]:02d}-{kind}-{page["sha256"][:10]}.webp')
            preview.save(path,'WEBP',quality=quality,method=5)
            result[kind]={'src':path.relative_to(OUT).as_posix(),'width':preview.width,'height':preview.height,'bytes':path.stat().st_size}
    return result

def main():
    source=json.loads((OUT/'heimildir.json').read_text())
    stories=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for story in source['stories']:
            pages=list(pool.map(build_page,story['pages']))
            stories.append({'id':story['id'],'legacyKey':story['legacyKey'],'author':story['author'],'pages':pages})
            print(story['author'],len(pages),flush=True)
    catalogue={'title':source['collection'],'totalAuthors':len(stories),'totalPages':sum(len(x['pages']) for x in stories),'stories':stories}
    assert catalogue['totalAuthors']==12 and catalogue['totalPages']==83
    (OUT/'sogur.json').write_text(json.dumps(catalogue,ensure_ascii=False,separators=(',',':'))+'\n')
    cards=[]
    for n,story in enumerate(stories,1):
        page=story['pages'][0];author=escape(story['author']);count=len(story['pages'])
        cards.append(f'''<article class="story-card" data-story="{story['id']}"><a class="story-link" href="?hofundur={story['id']}&amp;sida=1" aria-label="Opna sögu — {author}, {count} síður"><div class="cover"><span class="story-number" aria-hidden="true">{n:02d}</span><img src="{page['thumb']['src']}" width="{page['thumb']['width']}" height="{page['thumb']['height']}" alt="Fyrsta síða — {author}" loading="lazy" decoding="async"></div><div class="story-caption"><h2>{author}</h2><span class="page-count">{count} síður</span></div><div class="story-bottom"><span data-progress-label>Opna söguna</span><span class="open-mark" aria-hidden="true"><svg><use href="#i-open"/></svg></span></div></a></article>''')
    hero=''.join(f'<img src="{s["pages"][0]["thumb"]["src"]}" alt="" aria-hidden="true" width="420" height="560">' for s in stories[:3])
    html='''<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f3f0e6"><title>Bréf frá heimskautinu · The Arctic Comics Journal</title><meta name="description" content="Tólf myndasögur, hver með sinni rödd. Opnaðu sögur Breka, Elvu, Emblu Eirar og hinna höfundanna í upprunalega Arctic-verkefninu."><meta property="og:title" content="Bréf frá heimskautinu"><meta property="og:description" content="Tólf höfundar. Áttatíu og þrjár teiknaðar síður."><meta property="og:image" content="https://arcticcomics.org/logo.png"><link rel="canonical" href="https://arcticcomics.org/ARCTIC/"><link rel="icon" href="/favicon.ico"><link rel="preload" href="letur/lif-latina.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="lesari.css?v=bref1"><script src="lesari.js?v=bref1" defer></script></head><body>
<a class="skip" href="#library-title">Beint í sögurnar</a>
<svg class="symbols" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><symbol id="i-left" viewBox="0 0 48 48"><path d="M38 24H10m12-13L9 24l13 13"/></symbol><symbol id="i-right" viewBox="0 0 48 48"><path d="M10 24h28M26 11l13 13-13 13"/></symbol><symbol id="i-open" viewBox="0 0 48 48"><path d="M12 35 35 12M15 12h21v21"/></symbol><symbol id="i-close" viewBox="0 0 48 48"><path d="m13 13 22 22M35 13 13 35"/></symbol><symbol id="i-zoom" viewBox="0 0 48 48"><circle cx="21" cy="21" r="12"/><path d="m30 30 11 11M21 15v12M15 21h12"/></symbol><symbol id="i-pages" viewBox="0 0 48 48"><path d="M8 9h13v14H8zM27 9h13v14H27zM8 29h13v12H8zM27 29h13v12H27z"/></symbol><symbol id="i-link" viewBox="0 0 48 48"><path d="m19 29 10-10m-7-6 5-5a9 9 0 0 1 13 13l-8 8m-6 6-5 5A9 9 0 0 1 8 27l8-8"/></symbol><symbol id="i-plus" viewBox="0 0 48 48"><path d="M24 10v28M10 24h28"/></symbol><symbol id="i-minus" viewBox="0 0 48 48"><path d="M10 24h28"/></symbol></svg>
<div id="library"><header class="library-header"><a class="brand" href="/">THE ARCTIC<br>COMICS JOURNAL</a><a class="project-link" href="/">Um verkefnið</a></header><main class="library-main"><section class="introduction"><div class="intro-copy"><p class="eyebrow">Upprunalegu sögurnar · 12 höfundar · 83 síður</p><h1 id="library-title" tabindex="-1">Bréf frá<br>heimskautinu<span>.</span></h1><p class="standfirst">Tólf myndasögur, hver með sinni rödd.</p><p class="intro-note">Veldu höfund og gefðu þér tíma.</p></div><div class="intro-art" aria-hidden="true">'''+hero+'''</div></section>
<a id="continue-reading" class="continue-reading" href="./" hidden><img id="continue-cover" alt="" width="52" height="68"><span><small>Halda áfram</small><strong id="continue-author"></strong><span id="continue-page"></span></span><svg aria-hidden="true"><use href="#i-right"/></svg></a>
<p id="library-status" class="notice" role="status" hidden></p><section class="story-grid" aria-label="Sögurnar tólf">'''+''.join(cards)+'''</section><footer class="library-footer"><p>Teikningar og textar eftir höfunda sagnanna.<br>Sögurnar og síðurnar halda upprunalegri röð.</p><a href="/">The Arctic Comics Journal</a></footer></main></div>
<main id="reader" class="reader" hidden><header class="reader-header"><a href="./" id="all-stories" class="back-link"><svg aria-hidden="true"><use href="#i-left"/></svg><span>Allar sögurnar</span></a><h1 id="reader-author" tabindex="-1"></h1><div class="reader-tools"><button id="share-story" class="tool-button" type="button" aria-label="Afrita deilihlekk"><svg aria-hidden="true"><use href="#i-link"/></svg><span>Deila</span></button><button id="show-pages" class="tool-button" type="button" aria-label="Síðuyfirlit"><svg aria-hidden="true"><use href="#i-pages"/></svg><span>Síður</span></button></div></header>
<div class="reading-progress" id="reading-progress" role="progressbar" aria-label="Staða í sögunni" aria-valuemin="1" aria-valuemax="8" aria-valuenow="1"><span></span></div>
<section class="reading-space" aria-label="Myndasagan"><p id="reader-status" class="reader-status" aria-live="polite"></p><button id="page-art" class="page-art" type="button" aria-label="Stækka síðu" disabled><img id="page-image" alt="" draggable="false" hidden></button><div class="page-error" id="page-error" hidden><h2>Myndin náðist ekki.</h2><p>Reyndu aftur; lesstaðurinn þinn helst.</p><button id="retry-page" class="paper-button" type="button">Reyna aftur</button></div></section>
<section id="story-end" class="story-end" aria-label="Lok sögunnar" hidden><p class="eyebrow">Sagan endar hér</p><h2>Takk fyrir lesturinn.</h2><a id="next-story" class="next-story" href="./"><img id="next-cover" alt="" width="64" height="88"><span><small>Önnur saga</small><strong id="next-author"></strong></span><svg aria-hidden="true"><use href="#i-right"/></svg></a><a class="all-link" href="./" data-library-link>Velja úr öllum sögunum</a></section>
<nav class="reader-bar" aria-label="Fletta sögunni"><button id="previous-page" class="turn-button" type="button" aria-label="Fyrri síða"><svg aria-hidden="true"><use href="#i-left"/></svg><span>Fyrri</span></button><button id="page-counter" class="page-counter" type="button" aria-label="Velja síðu">1 / 8</button><button id="zoom-page" class="zoom-button" type="button"><svg aria-hidden="true"><use href="#i-zoom"/></svg><span>Stækka</span></button><button id="next-page" class="turn-button next" type="button" aria-label="Næsta síða"><span>Næsta</span><svg aria-hidden="true"><use href="#i-right"/></svg></button></nav><span class="action-status" id="action-status" role="status"></span></main>
<dialog id="pages-dialog" class="pages-dialog" aria-labelledby="pages-title"><header class="dialog-header"><div><p class="eyebrow">Síðuyfirlit</p><h2 id="pages-title"></h2></div><button class="icon-button" type="button" data-close="pages-dialog" aria-label="Loka síðuyfirliti"><svg aria-hidden="true"><use href="#i-close"/></svg></button></header><div id="page-thumbnails" class="page-thumbnails"></div></dialog>
<dialog id="zoom-dialog" class="zoom-dialog" aria-labelledby="zoom-title"><header class="zoom-header"><h2 id="zoom-title"></h2><div class="zoom-tools"><button id="zoom-out" class="icon-button" type="button" aria-label="Minnka"><svg aria-hidden="true"><use href="#i-minus"/></svg></button><span id="zoom-level">200%</span><button id="zoom-in" class="icon-button" type="button" aria-label="Stækka meira"><svg aria-hidden="true"><use href="#i-plus"/></svg></button><a id="open-original" class="open-original" href="./" target="_blank" rel="noopener">Opna mynd</a><button class="icon-button" type="button" data-close="zoom-dialog" aria-label="Loka stækkun"><svg aria-hidden="true"><use href="#i-close"/></svg></button></div></header><p id="zoom-status" class="zoom-status" role="status"></p><div id="zoom-frame" class="zoom-frame"><img id="zoom-image" alt="" draggable="false"></div></dialog>
<dialog id="share-dialog" class="share-dialog" aria-labelledby="share-title"><header class="dialog-header"><h2 id="share-title">Deila sögunni</h2><button class="icon-button" type="button" data-close="share-dialog" aria-label="Loka deilingu"><svg aria-hidden="true"><use href="#i-close"/></svg></button></header><p>Afritaðu slóðina til að deila þessari síðu.</p><input id="share-url" type="url" readonly aria-label="Deilihlekkur"></dialog>
<noscript><p class="no-script">Lesarinn þarf JavaScript til að fletta og stækka síðurnar. Myndirnar á höfundaspjöldunum sýna fyrstu síðu hverrar sögu.</p></noscript>
</body></html>'''
    (OUT/'index.html').write_text(html)
    print(json.dumps({'built':True,'stories':12,'pages':83,'readBytes':sum(p['read']['bytes'] for s in stories for p in s['pages']),'originalBytes':sum(p['original']['bytes'] for s in stories for p in s['pages'])}),flush=True)

if __name__=='__main__':main()
