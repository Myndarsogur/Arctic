"""Build the reader homepage, handbook and ornaments; verify all original images.
Export social artwork afterwards with: node scripts/build-og.mjs
"""
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
            path=original.with_name(f'{page["number"]:02d}-{kind}-{page["sha256"][:10]}.webp')
            if path.exists():
                with Image.open(path) as existing: width,height=existing.size
            else:
                preview=im.copy();preview.thumbnail(size,Image.Resampling.LANCZOS)
                preview.save(path,'WEBP',quality=quality,method=5)
                width,height=preview.size
            result[kind]={'src':path.relative_to(OUT).as_posix(),'width':width,'height':height,'bytes':path.stat().st_size}
    return result

def main():
    from build_handbook import build_handbook
    from build_skraut import build_skraut
    source=json.loads((OUT/'heimildir.json').read_text())
    stories=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for story in source['stories']:
            pages=list(pool.map(build_page,story['pages']))
            stories.append({'id':story['id'],'legacyKey':story['legacyKey'],'author':story['author'],'pages':pages})
    catalogue={'title':source['collection'],'totalAuthors':len(stories),'totalPages':sum(len(x['pages']) for x in stories),'stories':stories}
    assert catalogue['totalAuthors']==12 and catalogue['totalPages']==83
    (OUT/'sogur.json').write_text(json.dumps(catalogue,ensure_ascii=False,separators=(',',':'))+'\n')
    cards=[]
    for n,story in enumerate(stories,1):
        page=story['pages'][0];author=escape(story['author']);count=len(story['pages'])
        cards.append(f'<article class="story-card" data-story="{story["id"]}"><a class="story-link" href="/?hofundur={story["id"]}&amp;sida=1" aria-label="Opna sögu — {author}, {count} síður"><div class="cover"><span class="story-number" aria-hidden="true">{n:02d}</span><img src="/ARCTIC/{page["thumb"]["src"]}" width="{page["thumb"]["width"]}" height="{page["thumb"]["height"]}" alt="Fyrsta síða — {author}" loading="lazy" decoding="async"></div><div class="story-caption"><h2>{author}</h2><span class="page-count">{count} síður</span></div><div class="story-bottom"><span data-progress-label>Opna söguna</span><span class="open-mark" aria-hidden="true"><svg><use href="#i-open"/></svg></span></div></a></article>')
    letters=''.join(f'<img src="/ARCTIC/{story["pages"][0]["thumb"]["src"]}" width="{story["pages"][0]["thumb"]["width"]}" height="{story["pages"][0]["thumb"]["height"]}" alt="">' for story in stories[:2])
    html=(ROOT/'templates/reader.html').read_text().replace('{{STORY_CARDS}}','\n'.join(cards)).replace('{{LETTER_PAGES}}',letters)
    assert '{{' not in html
    (ROOT/'index.html').write_text(html)
    # Keep every old author/page share link, without adding a history entry.
    (OUT/'index.html').write_text('''<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bréf frá heimskautinu</title><link rel="canonical" href="https://arcticcomics.org/"><script>location.replace('/'+location.search+location.hash);</script><noscript><meta http-equiv="refresh" content="0;url=/"></noscript></head><body><p><a href="/">Opna Bréf frá heimskautinu</a></p></body></html>\n''')
    build_skraut()
    build_handbook()
    print(json.dumps({'built':True,'home':'/','handbook':['/handbok/','/handbok/en/'],'stories':12,'pages':83}),flush=True)

if __name__=='__main__':main()
