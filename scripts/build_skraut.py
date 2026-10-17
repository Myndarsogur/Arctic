"""Draw the envelope and a north-polar stereographic map. No lettering in these SVGs."""
from pathlib import Path
from math import radians, sin, cos, tan, pi
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[1]

def build_wordmarks():
    """The project's original gothic Luke face, exported as outlines."""
    font = TTFont(ROOT / 'Luke_thin_200.woff2')
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    em = font['head'].unitsPerEm
    def mark(lines):
        widths = [sum(font['hmtx'][cmap[ord(c)]][0] for c in line) for line in lines]
        maximum = max(widths)
        paths = []
        bounds = []
        for row, line in enumerate(lines):
            x = (maximum - widths[row]) / 2
            baseline = (1 + row * 1.05) * em
            for char in line:
                name = cmap[ord(char)]
                pen = SVGPathPen(glyphs)
                glyphs[name].draw(pen)
                if pen.getCommands():
                    paths.append(f'<path transform="translate({x:g} {baseline:g}) scale(1 -1)" d="{pen.getCommands()}"/>')
                    box = BoundsPen(glyphs); glyphs[name].draw(box)
                    if box.bounds:
                        left,bottom,right,top = box.bounds
                        bounds.append((left+x,baseline-top,right+x,baseline-bottom))
                x += font['hmtx'][name][0]
        left=min(b[0] for b in bounds)-em*.04; top=min(b[1] for b in bounds)-em*.04
        width=max(b[2] for b in bounds)-left+em*.04; height=max(b[3] for b in bounds)-top+em*.04
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left:g} {top:g} {width:g} {height:g}" fill="#23424c" data-font="Luke Medium200"><title>The Arctic Comics Journal</title>{"".join(paths)}</svg>'
    (ROOT/'assets/arctic-wordmark.svg').write_text(mark(['The Arctic','Comics Journal']))
    (ROOT/'assets/arctic-name.svg').write_text(mark(['The Arctic Comics Journal']))
    letter=mark(['A'])
    viewbox=letter.split('viewBox="')[1].split('"')[0]
    inside=letter.split('</title>')[1].removesuffix('</svg>')
    (ROOT/'assets/arctic-mark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="60" fill="#edf5f5"/><svg x="80" y="58" width="352" height="396" viewBox="{viewbox}" fill="#23424c">{inside}</svg></svg>')

def build_skraut():
    out = ROOT / 'assets/skraut'
    out.mkdir(parents=True, exist_ok=True)
    data = json.loads((ROOT / 'scripts/data/ne_110m_land.geojson').read_text())
    def project(lon, lat):
        r = 320 * tan(pi / 4 - radians(lat) / 2) / tan(pi / 8)
        # Turn Iceland toward the open upper-left part of the composition.
        theta = radians(lon - 115)
        return 360 + r * sin(theta), 360 + r * cos(theta)
    paths = []
    for feature in data['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for polygon in polygons:
            if max(lat for ring in polygon for lon, lat in ring) < 40:
                continue
            rings = []
            for ring in polygon:
                points = [project(lon, max(lat, -80)) for lon, lat in ring]
                rings.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in points) + 'Z')
            paths.append(f'<path d="{"".join(rings)}"/>')
    meridians = ''.join(f'<path d="M360 360L{360 + 320 * sin(radians(a)):.2f} {360 + 320 * cos(radians(a)):.2f}"/>' for a in range(0, 360, 30))
    parallels = ''.join(f'<circle cx="360" cy="360" r="{320 * tan(pi/4-radians(lat)/2)/tan(pi/8):.2f}"/>' for lat in [60, 75, 85])
    arctic = 320 * tan(pi/4-radians(66.56)/2)/tan(pi/8)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
<title>Norðurslóðir séðar frá norðurpólnum</title><desc>Skrautkort í pólstæðri stereógrafískri vörpun. Rauði hringurinn markar norðurheimskautsbaug. Landlínur: Natural Earth, public domain.</desc>
<defs><clipPath id="polar-edge"><circle cx="360" cy="360" r="320"/></clipPath></defs>
<circle cx="360" cy="360" r="328" fill="#fffbf0" stroke="#23424c" stroke-width="2"/>
<g clip-path="url(#polar-edge)"><circle cx="360" cy="360" r="320" fill="#c5dce2"/>
<g fill="#edf5f5" stroke="#637f83" stroke-width="1.15" stroke-linejoin="round" fill-rule="evenodd">{''.join(paths)}</g>
<g fill="none" stroke="#637f83" stroke-width=".75" opacity=".55">{meridians}{parallels}</g>
<circle cx="360" cy="360" r="{arctic:.2f}" fill="none" stroke="#b84c46" stroke-width="2" stroke-dasharray="7 6"/>
<path d="m360 341 4 15 15 4-15 4-4 15-4-15-15-4 15-4Z" fill="#23424c"/>
</g><circle cx="360" cy="360" r="320" fill="none" stroke="#637f83" stroke-width="1.5"/></svg>'''
    (out / 'heimskaut.svg').write_text(svg)
    (out / 'umslag.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="620" height="430" viewBox="0 0 620 430">
<title>Umslag með rauðu vaxinnsigli</title>
<g stroke="#23424c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
<path d="M40 178 309 12 581 177 583 395 39 398Z" fill="#e2cfad"/>
<path d="M31 175Q30 165 44 167L576 165Q591 165 589 180L587 390Q588 403 574 402L45 405Q29 405 31 390Z" fill="#f4e5c8"/>
<path d="m33 175 278 158 276-161" fill="#fff2d6"/>
<path d="m32 395 204-141m351 139L385 253" fill="none" stroke="#b6a188" stroke-width="2"/>
<path d="M35 397 235 258q18-10 31 0l44 29 44-28q15-10 32 0l197 135" fill="#f5e8cd"/>
<path d="m42 175 269 143 268-145" fill="none" stroke="#b6a188" stroke-width="2"/>
<path d="M303 263q13-5 25 2t16 14q12 2 14 15t-4 22q4 12-5 23t-20 9q-10 9-22 5t-18-11q-12-1-16-13t0-20q-4-10 3-21t18-12q1-8 9-13Z" fill="#b64b43" stroke="#6e3438" stroke-width="2.5"/>
<path d="M290 288q5-17 25-17 21 0 29 22" fill="none" stroke="#df8972" stroke-width="3"/>
<circle cx="314" cy="309" r="27" fill="#ad423c" stroke="#7e3738" stroke-width="2"/>
<path d="m314 289 4 15 15 5-15 4-4 15-5-15-14-4 14-5Z" fill="none" stroke="#e3a086" stroke-width="2"/>
<path d="m310 288 2 13 16 4m-5 25 9-8" fill="none" stroke="#7e3738" stroke-width="1.5"/>
</g></svg>''')
    build_wordmarks()

if __name__ == '__main__':
    build_skraut()
