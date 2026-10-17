"""Turn the former bilingual homepage into a small, readable project handbook."""
from pathlib import Path
from html import escape as esc
import json

ROOT = Path(__file__).resolve().parents[1]

def build_handbook():
    source = json.loads((ROOT / 'handbok/efni.json').read_text())
    # Preserve the full original copy in efni.json; these edits clarify dated notices.
    overrides = {
        'is': {
            'hero-body': 'The Arctic Comics Journal tengir saman samfélög á norðurslóðum og skapar vettvang fyrir staðbundin sjónarhorn á loftslagsbreytingar og hnattvæðingu. Frásagnirnar koma beint frá fólkinu sem þar býr og varpa ljósi á málefni sem annars fá litla athygli.',
            'mission-body': 'Við sköpum vettvang fyrir samtal og samvinnu á norðurslóðum og nálægum svæðum. Við söfnum sögum frá fólki í dreifbýli og nýtum mátt myndasögunnar til að koma þeim á framfæri.',
            'drawing-body': 'Þú getur lagt þitt af mörkum með teikningu eða uppsetningu. Ef þig vantar innblástur getum við tengt þig við fólk og hugmyndir sem þú þróar áfram á þínum forsendum.',
            'insp-body': 'Öll sjónarhorn eru velkomin. Að deila veruleika loftslagsbreytinga, sameiginlegum sigrum og áskorunum opnar glugga að því sem skiptir okkur og nágranna okkar máli.',
            'pitch-meta': 'Á fyrri forsíðu var 1. maí 2026 kynntur sem skilafrestur fyrir prentútgáfu. Sá frestur er liðinn; hafðu samband um næstu útgáfu.',
            'faq1-body': 'Sendu hugmyndina í gegnum eyðublaðið eða með tölvupósti. Skissur og stutt lýsing duga.',
            'faq5-body': 'Á fyrri forsíðu var 1. maí kynntur sem skilafrestur fyrir prentútgáfu, en einnig tekið fram að taka mætti við hugmyndum allt árið fyrir síðari útgáfur. Hafðu samband til að fá upplýsingar um næstu skil.',
            'partner-nordic-culture-point': 'Nordic Culture Point',
        },
        'en': {
            'pitch-meta': 'The former homepage announced 1 May 2026 as the print deadline. That date has passed; please contact the project about the next edition.',
            'faq5-body': 'The former homepage announced 1 May as the print deadline and welcomed projects year-round for future issues. Contact the project for the next submission dates.',
        },
    }
    for lang in ('is', 'en'):
        is_is = lang == 'is'
        copy = {**source['text']['en'], **source['text'].get(lang, {}), **overrides[lang]}
        def text(key, tag='p', cls=''):
            return f'<{tag} data-source-key="{key}"' + (f' class="{cls}"' if cls else '') + f'>{esc(copy[key])}</{tag}>'
        def sub(title, body):
            return f'<div class="book-subsection">{text(title,"h3")}{text(body)}</div>'
        def chapter(number, id_, title, content):
            return f'<section class="book-chapter" id="{id_}" aria-labelledby="chapter-{number}"><header class="chapter-heading"><span aria-hidden="true">{number:02d}</span><h2 id="chapter-{number}">{esc(title)}</h2></header>{content}</section>'
        def button(key, href):
            return f'<a class="book-button" href="{esc(href,quote=True)}"'+(' target="_blank" rel="noopener"' if href.startswith('https:') else '')+f' data-source-key="{key}">{esc(copy[key])}</a>'
        sections = [
            ('mission', 'Verkefnið' if is_is else 'The project'),
            ('stories', 'Raddir og frásagnir' if is_is else 'Voices & stories'),
            ('join', 'Að taka þátt' if is_is else 'Taking part'),
            ('workshops', 'Smiðjurnar' if is_is else 'The workshops'),
            ('faq', 'Spurt og svarað' if is_is else 'Questions & answers'),
            ('contact', 'Tengsl og samstarf' if is_is else 'Connections & collaboration'),
        ]
        quotes = ''.join(f'<div>{text(f"quote{n}-title","h3")}{text(f"quote{n}-body")}</div>' for n in range(1,5))
        mission = text('eyebrow',cls='eyebrow') + text('hero-title','h3','mission-title') + text('hero-body') + text('mission-body')
        mission += '<figure class="project-drawing"><img src="/logo.png" alt="'+('Teiknaður ísjaki með spegilmynd í sjónum' if is_is else 'An illustrated iceberg reflected in the sea')+'" width="3000" height="3000" loading="lazy"><figcaption>The Arctic Comics Journal</figcaption></figure>'
        mission += f'<div class="project-principles">{quotes}</div>'
        voice = ''.join(sub(k+'-title', k+'-body') for k in ('drawing','story','insp'))
        voice += '<div class="book-keywords">'+''.join(text(k,'span') for k in ('pill-graphic','pill-community','pill-across'))+'</div>'
        join = text('join-body') + sub('pitch-title','pitch-body') + text('pitch-meta',cls='dated-note')
        join += sub('pair-title','pair-body') + text('pair-meta',cls='small-note')
        join += sub('publish-title','publish-body') + text('publish-meta',cls='small-note')
        join += '<div class="book-actions">'+button('cta-primary',source['links']['cta-primary'])+f'<a class="book-text-link" href="mailto:info@arcticcomics.org">info@arcticcomics.org</a></div>'
        dated = 'Eftirfarandi staðir og áætlanir voru kynnt á fyrri forsíðu. Dagsetningar án árs og „tilkynnt síðar“ eru varðveitt hér sem verkefnisminni. Hafðu samband um núverandi dagskrá.' if is_is else 'These locations and plans were announced on the former homepage. Dates without a year and “TBA” entries are retained here as project notes. Contact the project for the current programme.'
        workshops = text('workshops-body') + f'<p class="dated-note">{esc(dated)}</p><div class="workshop-notes">'
        workshops += ''.join(sub(k+'-title',k+'-body') for k in ('iceland','finland','greenland','faroe')) + '</div>'
        faq = ''.join(f'<details class="book-question"><summary data-source-key="faq{n}-title">{esc(copy[f"faq{n}-title"])}</summary>{text(f"faq{n}-body")}</details>' for n in range(1,6))
        contact = text('contact-title','h3') + text('contact-body') + '<div class="book-actions">'+button('contact-cta',source['links']['contact-cta'])+'<a class="book-text-link" href="mailto:info@arcticcomics.org">info@arcticcomics.org</a></div>'
        contact += '<div id="partners">'+text('partners-title','h3')+text('partners-body')
        contact += '<p class="small-note">'+('Samstarfstenglar frá fyrri forsíðu verkefnisins.' if is_is else 'Collaboration links from the former project homepage.')+'</p><ul class="partner-links">'
        for key, href in source['links'].items():
            if key.startswith('partner-'):
                contact += f'<li><a href="{esc(href,quote=True)}" data-source-key="{key}" target="_blank" rel="noopener">{esc(copy[key])}</a></li>'
        contact += '</ul></div>'
        content = ''.join(chapter(n, id_, title, body) for n,((id_,title),body) in enumerate(zip(sections,[mission,voice,join,workshops,faq,contact]),1))
        toc = ''.join(f'<li><a href="#{id_}"><span aria-hidden="true">{n:02d}</span>{esc(title)}</a></li>' for n,(id_,title) in enumerate(sections,1))
        title = 'Handbók verkefnisins' if is_is else 'Project handbook'
        label = 'Lítill leiðarvísir að sögum, samvinnu og norðurslóðum.' if is_is else 'A small guide to stories, collaboration and the North.'
        intro = 'Hér er hugmyndin að baki The Arctic Comics Journal: hvaðan sögurnar koma, hvernig við vinnum saman og hvernig þú getur lagt þitt af mörkum. Efnið af fyrri forsíðu er nú samankomið í þessari handbók.' if is_is else 'This is the idea behind The Arctic Comics Journal: where the stories come from, how we work together, and how you can take part. The material from the former homepage is gathered here in one handbook.'
        language = '<a class="language-link" href="/handbok/en/" lang="en" hreflang="en">English</a>' if is_is else '<a class="language-link" href="/handbok/" lang="is" hreflang="is">Íslenska</a>'
        read = 'Lesa sögurnar' if is_is else 'Read the comics'
        html = f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · The Arctic Comics Journal</title><meta name="description" content="{esc(label,quote=True)}"><meta name="theme-color" content="#f6f1e3"><link rel="canonical" href="https://arcticcomics.org/handbok/{'en/' if not is_is else ''}"><link rel="alternate" hreflang="is" href="https://arcticcomics.org/handbok/"><link rel="alternate" hreflang="en" href="https://arcticcomics.org/handbok/en/"><meta property="og:title" content="{title} · The Arctic Comics Journal"><meta property="og:image" content="https://arcticcomics.org/assets/bref-og.png"><link rel="icon" href="/favicon.ico"><link rel="preload" href="/ARCTIC/letur/lif-latina.ttf" as="font" type="font/ttf" crossorigin><link rel="stylesheet" href="/ARCTIC/lesari.css?v=bref2"><link rel="stylesheet" href="/assets/husstill.css?v=bref2"><link rel="stylesheet" href="/handbok/handbok.css?v=bref2"><script src="/handbok/handbok.js?v=bref2" defer></script></head><body class="handbook-page"><a class="skip" href="#book-title">{'Beint í handbókina' if is_is else 'Skip to the handbook'}</a>
<header class="library-header"><a class="brand" href="/">THE ARCTIC<br>COMICS JOURNAL</a><nav class="site-nav" aria-label="{'Valmynd' if is_is else 'Navigation'}"><a class="project-link" href="/">{read}</a>{language}</nav></header>
<main class="handbook"><section class="book-cover"><div><p class="eyebrow">The Arctic Comics Journal · {'Handbók' if is_is else 'Handbook'}</p><h1 id="book-title" tabindex="-1">{'Handbók' if is_is else 'Project<br>handbook'}<span>.</span></h1><p class="book-lead">{label}</p><p>{intro}</p></div><div class="book-decoration" aria-hidden="true"><img src="/assets/skraut/heimskaut.svg" alt="" width="720" height="720"><img src="/assets/skraut/umslag.svg" alt="" width="620" height="430"></div></section>
<div class="book-layout"><nav class="book-toc" aria-label="{'Efnisyfirlit' if is_is else 'Contents'}"><h2>{'Í handbókinni' if is_is else 'In this handbook'}</h2><ol>{toc}</ol><a class="toc-read" href="/">{read}</a></nav><div class="book-pages">{content}<footer class="book-colophon"><p>The Arctic Comics Journal © All Rights Reserved</p><p>{'Kortaskraut' if is_is else 'Map ornament'}: <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> · {'Séð frá norðurpólnum' if is_is else 'Seen from the North Pole'}.</p><a href="/">{read}</a></footer></div></div></main></body></html>'''
        dest = ROOT / ('handbok' if is_is else 'handbok/en')
        dest.mkdir(parents=True,exist_ok=True)
        (dest / 'index.html').write_text(html)

if __name__ == '__main__':
    build_handbook()
