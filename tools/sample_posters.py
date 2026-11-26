"""Makes dummy event posters for the test version: src/data/sample-images/<event id>.webp

Each poster uses the event's real name, date, time and venue, in the portal's retro colours,
with a "Sample image" tag so nobody mistakes it for the branch's artwork.
Shapes rotate between square, portrait and wide to show that images are never cropped.

Run: python3 tools/sample_posters.py   (needs playwright, pillow and Google Chrome)
"""
import base64
import html
import math
import json
import os
import re
from datetime import date

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONTS = os.path.join(ROOT, 'src', 'assets', 'fonts')
OUT = os.path.join(ROOT, 'src', 'data', 'sample-images')
SHAPES = [(1080, 1080), (1080, 1350), (1600, 900)]
PALETTES = {
    'member': [('#0C2D6B', '#FFF4E2', '#F2A541'), ('#2F6F73', '#FFF4E2', '#F4B860'), ('#B5482F', '#FFF4E2', '#F6C98B')],
    'student': [('#5B2E91', '#FFF4E2', '#F4B860'), ('#7A4BB0', '#FFFFFF', '#F6C98B')],
}


def fmt_date(a, b):
    d1 = date.fromisoformat(a)
    d2 = date.fromisoformat(b or a)
    m = lambda d: d.strftime('%b')
    if d1 == d2:
        return f"{d1.strftime('%a')}, {d1.day} {m(d1)} {d1.year}"
    if d1.month == d2.month:
        return f'{d1.day} to {d2.day} {m(d2)} {d2.year}'
    return f'{d1.day} {m(d1)} to {d2.day} {m(d2)} {d2.year}'


def fmt_time(t):
    h, mi = map(int, t.split(':'))
    ap = 'pm' if h >= 12 else 'am'
    h = h % 12 or 12
    return f'{h}:{mi:02d} {ap}' if mi else f'{h} {ap}'


def font_url(name):
    with open(os.path.join(FONTS, name), 'rb') as fh:
        return 'data:font/woff2;base64,' + base64.b64encode(fh.read()).decode()


FONT_CSS = None


def poster_html(e, w, h, pal):
    global FONT_CSS
    if FONT_CSS is None:
        FONT_CSS = (f"@font-face{{font-family:B;font-weight:800;src:url({font_url('bricolage-grotesque-latin-800-normal.woff2')})}}"
                    f"@font-face{{font-family:H;font-weight:500;src:url({font_url('hanken-grotesk-latin-500-normal.woff2')})}}"
                    f"@font-face{{font-family:H;font-weight:700;src:url({font_url('hanken-grotesk-latin-700-normal.woff2')})}}")
    bg, ink, accent = pal
    title = e['title'].replace(' | SICASA', '')
    sicasa = 'SICASA' in e['title']
    n = len(title)
    base = min(w, h)
    size = base * (0.115 if n < 18 else 0.095 if n < 30 else 0.078 if n < 44 else 0.064)
    cats = [c for c in ('member', 'nonMember', 'student') if e['categories'][c]['enabled']]
    who = 'Open to all' if len(cats) == 3 else ' and '.join({'member': 'Members', 'nonMember': 'Non-members', 'student': 'Students'}[c] for c in cats)
    topic = re.sub(r'^Topic:\s*', '', (e.get('description') or '').split('\n')[0])
    topic = topic if topic and len(topic) < 90 and not topic.lower().startswith('registration fee') else ''
    wide = w > h
    sr = base * .22
    sx, sy = w - base * .12, h - base * .22
    rays = ''.join(
        f'<path d="M{sx} {sy} L{sx + 3000 * math.cos(i * 0.2618)} {sy + 3000 * math.sin(i * 0.2618)} L{sx + 3000 * math.cos(i * 0.2618 + 0.13)} {sy + 3000 * math.sin(i * 0.2618 + 0.13)}Z"/>'
        for i in range(24))
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
{FONT_CSS}
*{{box-sizing:border-box;margin:0}}
body{{width:{w}px;height:{h}px;overflow:hidden;background:{bg};color:{ink};font-family:H,sans-serif;position:relative}}
svg.bg{{position:absolute;inset:0}}
.dots{{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.08) 1.6px,transparent 1.7px);background-size:{base * .022}px {base * .022}px}}
.frame{{position:absolute;inset:{base * .035}px;border:{base * .004}px solid rgba(255,255,255,.35);border-radius:{base * .03}px}}
.tag{{position:absolute;top:{base * .065}px;right:{base * .065}px;background:{ink};color:{bg};font-weight:700;font-size:{base * .026}px;padding:{base * .008}px {base * .02}px;border-radius:99px;letter-spacing:.02em}}
.wrap{{position:absolute;left:{base * .09}px;right:{base * .09}px;{'top' if not wide else 'top'}:{h * (.14 if not wide else .16)}px;bottom:{base * .09}px;display:flex;flex-direction:column}}
.org{{font-weight:700;font-size:{base * .03}px;opacity:.85}}
.kind{{display:inline-block;margin-top:{base * .03}px;background:{accent};color:#1E2F5C;font-weight:700;font-size:{base * .028}px;padding:{base * .008}px {base * .022}px;border-radius:{base * .012}px;align-self:flex-start}}
h1{{font-family:B,sans-serif;font-weight:800;font-size:{size}px;line-height:1.02;letter-spacing:-.02em;margin-top:{base * .035}px;max-width:{w * (.62 if wide else .84)}px}}
.topic{{font-size:{base * .034}px;margin-top:{base * .025}px;opacity:.9;max-width:{min(w * (.6 if wide else .82), sx - sr - base * .13)}px;line-height:1.3}}
.facts{{margin-top:auto;display:grid;gap:{base * .012}px;font-size:{base * .036}px;font-weight:700;max-width:{w - base * .09 - (sx - sr) + base * .04 if False else (sx - sr - base * .13)}px}}
.facts span{{display:block;font-weight:500;opacity:.8;font-size:{base * .026}px}}
.sun{{position:absolute;left:{sx - sr}px;top:{sy - sr}px;width:{2 * sr}px;height:{2 * sr}px;border-radius:50%;background:{accent};opacity:.95}}
.sun::after{{content:'';position:absolute;inset:{base * -.035}px;border-radius:50%;border:{base * .012}px solid {accent};opacity:.45}}
.ground{{position:absolute;left:0;right:0;bottom:0;height:{base * .028}px;background:{accent}}}
</style></head><body>
<svg class="bg" viewBox="0 0 {w} {h}" fill="rgba(255,255,255,.05)">{rays}</svg>
<div class="dots"></div><div class="sun"></div><div class="ground"></div><div class="frame"></div>
<div class="tag">Sample image</div>
<div class="wrap">
  <div class="org">ICAI Bengaluru Branch (SIRC){' &nbsp;|&nbsp; SICASA' if sicasa else ''}</div>
  <div class="kind">{html.escape(who)}</div>
  <h1>{html.escape(title)}</h1>
  {f'<p class="topic">{html.escape(topic)}</p>' if topic else ''}
  <div class="facts">
    <div><span>Date</span>{fmt_date(e['startDate'], e['endDate'])}</div>
    <div><span>Time and venue</span>{fmt_time(e['startTime'])} to {fmt_time(e['endTime'])}, {html.escape(e['venue'].rstrip('.'))}</div>
  </div>
</div></body></html>'''


def main():
    events = json.load(open(os.path.join(ROOT, 'src', 'data', 'events.json')))
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, '_tmp.png')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for i, e in enumerate(events):
            w, h = SHAPES[i % 3]
            student = [c for c in ('member', 'nonMember', 'student') if e['categories'][c]['enabled']] == ['student']
            pals = PALETTES['student' if student else 'member']
            pal = pals[i % len(pals)]
            pg = b.new_page(viewport={'width': w, 'height': h})
            pg.set_content(poster_html(e, w, h, pal))
            pg.wait_for_timeout(250)
            pg.screenshot(path=tmp)
            pg.close()
            im = Image.open(tmp).convert('RGB')
            s = 800 / max(im.size)
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            im.save(os.path.join(OUT, f"{e['id']}.webp"), 'WEBP', quality=78, method=6)
        b.close()
    os.remove(tmp)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(events)} posters, {total // 1024} KB')


if __name__ == '__main__':
    main()
