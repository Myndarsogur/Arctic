"""Build the reader homepage, handbook and ornaments; verify all original images.
Export social artwork afterwards with: node scripts/build-og.mjs
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from html import escape
from pathlib import Path
from PIL import Image,ImageOps
import json,re

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
    copies=json.loads((OUT/'reader-copy.json').read_text())
    assert copies['is'].keys()==copies['en'].keys()
    for key in copies['is']:
        assert set(re.findall(r'\{(\w+)\}',copies['is'][key]))==set(re.findall(r'\{(\w+)\}',copies['en'][key])),key
    template=(ROOT/'templates/reader.html').read_text()
    outline='<svg class="cover-outline" viewBox="0 0 300 425" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M8 8c52-6 106 3 155-1s91 0 129 1c5 59-2 106 2 160s-3 125 0 167q2 43-2 82c-57 6-107-3-156 1s-90-2-127 0c-5-55 2-104-2-158s2-104-1-155Q3 55 8 8Z"/></svg>'
    bookmark='<svg class="story-bookmark" viewBox="0 0 24 38" aria-hidden="true"><path d="M4 3q8-3 16 0l-1 30-7-5-8 6Z"/><path d="m7 6 1 17"/></svg>'
    for lang,copy in copies.items():
        home='/' if lang=='is' else '/en/'
        handbook='/handbok/' if lang=='is' else '/handbok/en/'
        cards=[]
        for story in stories:
            page=story['pages'][0];author=escape(story['author'])
            label=escape(copy['open_story'].format(author=story['author']),quote=True)
            alt=escape(copy['first_page'].format(author=story['author']),quote=True)
            cards.append(f'<article class="story-card" data-story="{story["id"]}"><a class="story-link" href="{home}?hofundur={story["id"]}&amp;sida=1" aria-label="{label}"><div class="cover"><img src="/ARCTIC/{page["thumb"]["src"]}" srcset="/ARCTIC/{page["thumb"]["src"]} {page["thumb"]["width"]}w, /ARCTIC/{page["read"]["src"]} {page["read"]["width"]}w" sizes="(max-width: 580px) 90vw, (max-width: 1100px) 44vw, 30vw" width="{page["thumb"]["width"]}" height="{page["thumb"]["height"]}" alt="{alt}" loading="lazy" decoding="async">{outline}{bookmark}</div><div class="story-caption"><h2>{author}</h2><span class="story-trail" data-story-trail aria-hidden="true" hidden></span></div></a></article>')
        values={key:escape(value,quote=True) for key,value in copy.items()}
        values.update(lang=lang,home=home,handbook_url=handbook,language_url='/en/' if lang=='is' else '/',other_lang='en' if lang=='is' else 'is',canonical='https://arcticcomics.org'+home,og_image='bref-og.png' if lang=='is' else 'letters-og.png',story_cards='\n'.join(cards),reader_copy=json.dumps(copy,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
        html=re.sub(r'\{\{(\w+)\}\}',lambda match:values[match[1]],template)
        assert '{{' not in html
        dest=ROOT if lang=='is' else ROOT/'en'
        dest.mkdir(exist_ok=True)
        (dest/'index.html').write_text(html)
    # Keep every old author/page share link, without adding a history entry.
    (OUT/'index.html').write_text('''<!doctype html><html lang="is"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bréf frá heimskautinu</title><link rel="canonical" href="https://arcticcomics.org/"><script>location.replace('/'+location.search+location.hash);</script><noscript><meta http-equiv="refresh" content="0;url=/"></noscript></head><body><p><a href="/">Opna Bréf frá heimskautinu</a></p></body></html>\n''')
    build_skraut()
    build_handbook()
    print(json.dumps({'built':True,'home':['/','/en/'],'handbook':['/handbok/','/handbok/en/'],'stories':12,'pages':83}),flush=True)

if __name__=='__main__':main()
