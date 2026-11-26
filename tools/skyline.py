"""Generates src/components/skylineMarkup.js: a retro poster drawing of Bengaluru.

Landmarks, left to right: tiled roof bungalows, a Dravidian gopuram, the Lalbagh Glass House,
Bangalore Palace, Vidhana Soudha, Attara Kacheri (High Court), UB City and the CBD towers,
with a Namma Metro train on its viaduct, rain trees and gulmohars.

Run: python3 tools/skyline.py
"""
import json
import math
import os

G = 372  # ground line
NAVY = '#1E2F5C'


def f(n):
    return f'{n:.1f}'.rstrip('0').rstrip('.')


def rect(x, y, w, h, cls='b', rx=0):
    r = f' rx="{f(rx)}"' if rx else ''
    return f'<rect class="{cls}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"{r}/>'


def path(d, cls='b'):
    return f'<path class="{cls}" d="{d}"/>'


def lines(segs, cls='ln'):
    return path(''.join(f'M{f(a)} {f(b)}L{f(c)} {f(d)}' for a, b, c, d in segs), cls)


def circle(cx, cy, r, cls='b'):
    return f'<circle class="{cls}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/>'


def arch_win(x, y, w, h, cls='win'):
    """Window with a round top."""
    r = w / 2
    return path(f'M{f(x)} {f(y + h)}V{f(y + r)}A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y + r)}V{f(y + h)}Z', cls)


def gothic_win(x, y, w, h, cls='win'):
    """Pointed Tudor style window."""
    return path(f'M{f(x)} {f(y + h)}V{f(y + w * .55)}Q{f(x)} {f(y)} {f(x + w / 2)} {f(y - w * .15)}Q{f(x + w)} {f(y)} {f(x + w)} {f(y + w * .55)}V{f(y + h)}Z', cls)


def grid(x0, y0, cols, rows, w, h, gx, gy, cls='win', kind='rect'):
    out = []
    for r in range(rows):
        for c in range(cols):
            x = x0 + c * gx
            y = y0 + r * gy
            if kind == 'arch':
                out.append(arch_win(x, y, w, h, cls))
            else:
                out.append(rect(x, y, w, h, cls))
    return ''.join(out)


def merlons(x0, x1, y, h=5, w=5, gap=4, cls='b'):
    out, x = [], x0
    while x + w <= x1 + .1:
        out.append(rect(x, y - h, w, h, cls))
        x += w + gap
    return ''.join(out)


def onion(cx, base, w, h, cls='dome'):
    """Indo Saracenic dome sitting on y=base."""
    hw = w / 2
    return path(
        f'M{f(cx - hw * .82)} {f(base)}C{f(cx - hw * 1.12)} {f(base - h * .38)} {f(cx - hw * .8)} {f(base - h * .78)} {f(cx)} {f(base - h)}'
        f'C{f(cx + hw * .8)} {f(base - h * .78)} {f(cx + hw * 1.12)} {f(base - h * .38)} {f(cx + hw * .82)} {f(base)}Z', cls)


def kalasha(cx, top, size=1.0):
    s = size
    return (lines([(cx, top - 9 * s, cx, top)], 'ln') + circle(cx, top - 2.5 * s, 2.6 * s, 'trim'))


def chhatri(cx, base, w=26):
    """Small domed kiosk: platform, pillared drum, onion dome, finial."""
    hw = w / 2
    dh = w * .95
    return (rect(cx - hw - 3, base - 4, w + 6, 4, 'b') +
            rect(cx - hw, base - 4 - w * .5, w, w * .5, 'b') +
            ''.join(arch_win(cx - hw + 3 + i * (w - 6) / 3, base - 4 - w * .5 + 3, (w - 6) / 3 - 2.5, w * .5 - 4, 'rec') for i in range(3)) +
            rect(cx - hw - 2, base - 6 - w * .5, w + 4, 3, 'trim') +
            onion(cx, base - 6 - w * .5, w * .95, dh) +
            kalasha(cx, base - 6 - w * .5 - dh, .8))


# ---------------------------------------------------------------- landmarks

def small_dome(cx, base, w):
    """Low stone dome on a short drum, as on the Vidhana Soudha pavilions."""
    hw = w / 2
    return (rect(cx - hw - 3, base - 3, w + 6, 3, 'trim') +
            rect(cx - hw + 2, base - 3 - w * .32, w - 4, w * .32, 'b') +
            lines([(cx - hw + 2 + k * (w - 4) / 4, base - 3 - w * .32, cx - hw + 2 + k * (w - 4) / 4, base - 3) for k in range(1, 4)]) +
            rect(cx - hw, base - 5 - w * .32, w, 2.5, 'trim') +
            path(f'M{f(cx - hw * .92)} {f(base - 5 - w * .32)}C{f(cx - hw * .95)} {f(base - 5 - w * .32 - w * .55)} {f(cx + hw * .95)} {f(base - 5 - w * .32 - w * .55)} {f(cx + hw * .92)} {f(base - 5 - w * .32)}Z', 'dome') +
            kalasha(cx, base - 5 - w * .32 - w * .42, .7))


def vidhana_soudha(cx=720):
    """Vidhana Soudha, east front: granite wings, low corner pavilions, a 12 column portico on a grand
    staircase, the central tower, and the ribbed stone dome crowned by the Ashoka lions."""
    o = []
    L, R = cx - 272, cx + 272
    # plinth along the whole front
    o.append(rect(L - 14, G - 14, (R - L) + 28, 14, 'b2'))
    # wings: four storeys with a deep chajja and a Dravidian parapet
    for x0, x1 in ((L + 34, cx - 104), (cx + 104, R - 34)):
        o.append(rect(x0, G - 96, x1 - x0, 82, 'b'))
        o.append(rect(x0 - 4, G - 100, x1 - x0 + 8, 5, 'trim'))
        o.append(merlons(x0, x1, G - 100, 5, 4, 4))
        n = int((x1 - x0 - 8) // 12)
        o.append(grid(x0 + 6, G - 90, n, 1, 6, 12, 12, 0, 'rec', 'arch'))
        o.append(grid(x0 + 6, G - 70, n, 3, 6, 9, 12, 17, 'rec'))
        o.append(lines([(x0, G - 74, x1, G - 74), (x0, G - 40, x1, G - 40)]))
    # low corner pavilions at both ends
    for tx in (L + 18, R - 18):
        o.append(rect(tx - 34, G - 118, 68, 104, 'b'))
        o.append(rect(tx - 38, G - 122, 76, 5, 'trim'))
        o.append(merlons(tx - 36, tx + 36, G - 122, 5, 4, 4))
        o.append(grid(tx - 26, G - 112, 4, 1, 7, 14, 15, 0, 'rec', 'arch'))
        o.append(grid(tx - 26, G - 90, 4, 4, 7, 10, 15, 18, 'rec'))
        o.append(small_dome(tx, G - 122, 30))
    # pavilions either side of the central block
    for tx in (cx - 130, cx + 130):
        o.append(rect(tx - 26, G - 112, 52, 98, 'b'))
        o.append(rect(tx - 30, G - 116, 60, 5, 'trim'))
        o.append(merlons(tx - 28, tx + 28, G - 116, 5, 4, 4))
        o.append(grid(tx - 19, G - 106, 3, 1, 7, 13, 15, 0, 'rec', 'arch'))
        o.append(grid(tx - 19, G - 86, 3, 4, 7, 10, 15, 18, 'rec'))
        o.append(small_dome(tx, G - 116, 26))
    # grand staircase up to the portico
    o.append(path(f'M{cx - 122} {G}L{cx - 100} {G - 40}H{cx + 100}L{cx + 122} {G}Z', 'b2'))
    o.append(lines([(cx - 122 + i * 2.2, G - i * 4, cx + 122 - i * 2.2, G - i * 4) for i in range(1, 10)]))
    # portico: dark recess, twelve tall granite columns, entablature and the inscription band
    o.append(rect(cx - 104, G - 116, 208, 76, 'rec'))
    o.append(arch_win(cx - 12, G - 80, 24, 40, 'win'))
    for xx in (cx - 60, cx + 36):
        o.append(arch_win(xx, G - 74, 24, 34, 'win'))
    o.append(rect(cx - 106, G - 44, 212, 6, 'b'))
    for i in range(12):
        x = cx - 96 + i * (192 / 11)
        o.append(rect(x - 3.6, G - 110, 7.2, 66, 'col'))
        o.append(rect(x - 5.5, G - 114, 11, 4.5, 'b'))
        o.append(rect(x - 5.5, G - 46, 11, 3, 'b'))
    o.append(rect(cx - 108, G - 128, 216, 14, 'b'))
    o.append(lines([(cx - 108, G - 121, cx + 108, G - 121)]))
    o.append(rect(cx - 70, G - 138, 140, 10, 'trim'))
    o.append(path(''.join(f'M{f(cx - 60 + k * 6.2)} {G - 133}h3.6' for k in range(20)), 'ln'))
    o.append(rect(cx - 112, G - 142, 224, 4, 'trim'))
    # central tower above the portico, with small corner domes
    o.append(rect(cx - 72, G - 184, 144, 42, 'b'))
    o.append(grid(cx - 64, G - 178, 10, 1, 7, 15, 13.4, 0, 'rec', 'arch'))
    o.append(lines([(cx - 72, G - 158, cx + 72, G - 158)]))
    o.append(grid(cx - 64, G - 154, 10, 1, 7, 8, 13.4, 0, 'rec'))
    o.append(rect(cx - 78, G - 188, 156, 5, 'trim'))
    o.append(merlons(cx - 76, cx + 76, G - 188, 5, 4, 4.5))
    for tx in (cx - 64, cx + 64):
        o.append(small_dome(tx, G - 193, 22))
    # drum with pilasters, lotus band, then the ribbed stone dome
    o.append(rect(cx - 46, G - 214, 92, 26, 'b'))
    o.append(lines([(cx - 46 + k * 9.2, G - 214, cx - 46 + k * 9.2, G - 188) for k in range(1, 10)]))
    o.append(grid(cx - 41.5, G - 208, 9, 1, 4.4, 9, 9.2, 0, 'rec'))
    o.append(rect(cx - 50, G - 219, 100, 5, 'trim'))
    o.append(path(''.join(f'M{f(cx - 48 + k * 8)} {G - 219}q4 -7 8 0' for k in range(12)), 'trim'))
    dome = f'M{cx - 46} {G - 222}C{cx - 52} {G - 252} {cx - 30} {G - 276} {cx} {G - 280}C{cx + 30} {G - 276} {cx + 52} {G - 252} {cx + 46} {G - 222}Z'
    o.append(path(dome, 'dome'))
    o.append(path(''.join(f'M{f(cx + k * 46)} {G - 222}C{f(cx + k * 50)} {G - 250} {f(cx + k * 26)} {G - 274} {cx} {G - 280}' for k in (-.66, -.33, .33, .66)), 'ln'))
    o.append(lines([(cx, G - 280, cx, G - 222)]))
    # lantern and the Ashoka lion capital
    o.append(rect(cx - 7, G - 290, 14, 10, 'b'))
    o.append(rect(cx - 10, G - 293, 20, 4, 'gold'))
    o.append(path(f'M{cx - 9} {G - 293}V{G - 300}Q{cx - 9} {G - 305} {cx - 5} {G - 305}Q{cx - 3} {G - 309} {cx} {G - 309}Q{cx + 3} {G - 309} {cx + 5} {G - 305}Q{cx + 9} {G - 305} {cx + 9} {G - 300}V{G - 293}Z', 'gold'))
    return o


def attara_kacheri(x=1000):
    """Red Greco Roman High Court with a central Corinthian portico."""
    o = []
    w = 176
    o.append(rect(x, G - 50, w, 50, 'b'))
    o.append(rect(x - 3, G - 54, w + 6, 5, 'trim'))
    o.append(merlons(x + 2, x + w - 2, G - 54, 4, 3, 3, 'trim'))  # balustrade
    o.append(grid(x + 8, G - 44, 11, 1, 7, 11, 15.5, 0, 'win2'))
    o.append(grid(x + 8, G - 24, 11, 1, 7, 14, 15.5, 0, 'win2', 'arch'))
    o.append(lines([(x, G - 28, x + w, G - 28)], 'ln2'))
    cx = x + w / 2
    o.append(rect(cx - 34, G - 66, 68, 66, 'b'))
    o.append(path(f'M{cx - 38} {G - 66}L{cx} {G - 84}L{cx + 38} {G - 66}Z', 'trim'))
    o.append(rect(cx - 30, G - 60, 60, 58, 'rec2'))
    for i in range(6):
        xx = cx - 26 + i * 10.4
        o.append(rect(xx - 2.2, G - 60, 4.4, 58, 'col2'))
    o.append(rect(cx - 36, G - 64, 72, 4, 'trim'))
    return o


def bangalore_palace(x=168):
    """Tudor style palace: crenellated towers, turrets and pointed windows."""
    o = []
    # low side wings
    for x0 in (x, x + 222):
        o.append(rect(x0, G - 58, 40, 58, 'b'))
        o.append(merlons(x0, x0 + 40, G - 58, 5, 5, 3.5))
        o.append(grid(x0 + 6, G - 46, 3, 2, 6, 13, 11, 22, 'rec'))
    # main hall
    o.append(rect(x + 40, G - 86, 182, 86, 'b'))
    o.append(rect(x + 38, G - 90, 186, 4, 'trim'))
    o.append(merlons(x + 40, x + 222, G - 90, 5, 5, 4))
    for r in range(2):
        for c in range(9):
            xx = x + 50 + c * 19
            if 80 < xx - x < 168:
                continue
            o.append(gothic_win(xx, G - 76 + r * 34, 8, 22, 'rec'))
    o.append(lines([(x + 40, G - 44, x + 222, G - 44)]))
    # octagonal flanking towers with turrets
    for tx in (x + 52, x + 210):
        o.append(rect(tx - 15, G - 122, 30, 122, 'b'))
        o.append(lines([(tx - 6, G - 122, tx - 6, G), (tx + 6, G - 122, tx + 6, G)]))
        o.append(rect(tx - 17, G - 126, 34, 5, 'trim'))
        o.append(merlons(tx - 17, tx + 17, G - 126, 6, 5, 2.25))
        o.append(gothic_win(tx - 4, G - 112, 8, 18, 'rec'))
        o.append(gothic_win(tx - 4, G - 78, 8, 18, 'rec'))
        for px in (tx - 15, tx + 15):
            o.append(rect(px - 3, G - 140, 6, 14, 'b'))
            o.append(path(f'M{px - 4} {G - 140}L{px} {G - 152}L{px + 4} {G - 140}Z', 'roof'))
    # central entrance tower, tallest, with a spire turret
    cx = x + 131
    o.append(rect(cx - 26, G - 148, 52, 148, 'b'))
    o.append(rect(cx - 29, G - 152, 58, 5, 'trim'))
    o.append(merlons(cx - 29, cx + 29, G - 152, 7, 6, 2.6))
    o.append(gothic_win(cx - 7, G - 136, 14, 26, 'rec'))
    o.append(gothic_win(cx - 7, G - 98, 14, 26, 'rec'))
    o.append(gothic_win(cx - 13, G - 44, 26, 44, 'win'))
    o.append(rect(cx + 14, G - 176, 10, 24, 'b'))
    o.append(path(f'M{cx + 12} {G - 176}L{cx + 19} {G - 196}L{cx + 26} {G - 176}Z', 'roof'))
    o.append(lines([(cx + 19, G - 204, cx + 19, G - 196)]))
    return o


def glass_house(cx=0):
    """Lalbagh Glass House: a tall arched nave between two lower arched wings."""
    o = []
    o.append(rect(cx - 132, G - 10, 264, 10, 'b2'))
    for wx in (cx - 94, cx + 94):
        o.append(path(f'M{wx - 38} {G - 10}V{G - 48}A38 34 0 0 1 {wx + 38} {G - 48}V{G - 10}Z', 'glass'))
        o.append(path(''.join(f'M{f(wx)} {G - 48}L{f(wx + 38 * math.cos(a))} {f(G - 48 - 34 * math.sin(a))}' for a in [math.pi * k / 6 for k in range(1, 6)]), 'ln'))
        o.append(lines([(wx - 38, G - 48, wx + 38, G - 48)] + [(wx + d, G - 48, wx + d, G - 10) for d in (-25, -12, 0, 12, 25)]))
    o.append(path(f'M{cx - 58} {G - 10}V{G - 70}A58 56 0 0 1 {cx + 58} {G - 70}V{G - 10}Z', 'glass'))
    o.append(path(f'M{cx - 46} {G - 70}A46 44 0 0 1 {cx + 46} {G - 70}', 'ln'))
    o.append(path(''.join(f'M{f(cx)} {G - 70}L{f(cx + 58 * math.cos(a))} {f(G - 70 - 56 * math.sin(a))}' for a in [math.pi * k / 8 for k in range(1, 8)]), 'ln'))
    o.append(lines([(cx - 58, G - 70, cx + 58, G - 70)] + [(cx + d, G - 70, cx + d, G - 10) for d in (-44, -30, -15, 0, 15, 30, 44)] + [(cx - 58, G - 40, cx + 58, G - 40)]))
    o.append(path(f'M{cx - 9} {G - 10}V{G - 28}A9 9 0 0 1 {cx + 9} {G - 28}V{G - 10}Z', 'rec'))
    o.append(kalasha(cx, G - 126, 1))
    return o


def gopuram(cx=-236):
    """Dravidian temple gateway tower: stone base, five tapering tiers, barrel vault with kalashas."""
    o = []
    o.append(rect(cx - 48, G - 44, 96, 44, 'b2'))
    o.append(rect(cx - 52, G - 48, 104, 5, 'trim'))
    o.append(path(f'M{cx - 12} {G}V{G - 26}H{cx + 12}V{G}Z', 'rec'))
    o.append(rect(cx - 16, G - 30, 32, 4, 'trim'))
    o.append(grid(cx - 40, G - 38, 2, 1, 7, 12, 14, 0, 'rec', 'arch'))
    o.append(grid(cx + 19, G - 38, 2, 1, 7, 12, 14, 0, 'rec', 'arch'))
    y = G - 48
    for i in range(5):
        hw = 44 - i * 7.5
        th = 22 - i * 1.5
        o.append(path(f'M{f(cx - hw)} {f(y)}L{f(cx - hw + 3)} {f(y - th)}H{f(cx + hw - 3)}L{f(cx + hw)} {f(y)}Z', 'b'))
        o.append(rect(cx - hw + 1, y - th - 3, 2 * hw - 2, 3, 'trim'))
        n = max(2, int(hw // 9))
        for k in range(n):
            xx = cx - hw + 8 + k * ((2 * hw - 16) / max(1, n - 1)) - 2.5
            o.append(arch_win(xx, y - th + 6, 5, th - 8, 'rec'))
        y -= th + 3
    # shala roof and five kalashas
    o.append(path(f'M{cx - 22} {f(y)}V{f(y - 10)}Q{cx - 22} {f(y - 22)} {cx - 10} {f(y - 22)}H{cx + 10}Q{cx + 22} {f(y - 22)} {cx + 22} {f(y - 10)}V{f(y)}Z', 'roof'))
    for k in range(5):
        o.append(kalasha(cx - 16 + k * 8, y - 22, .8))
    return o


def bungalow(x, w, h, cls_extra=''):
    """Old Bengaluru house with a Mangalore tile roof."""
    o = [rect(x, G - h, w, h, 'b')]
    o.append(path(f'M{x - 5} {G - h}L{x + w * .2} {G - h - 18}H{x + w * .8}L{x + w + 5} {G - h}Z', 'roof'))
    o.append(lines([(x + w * .2 - 3 + k * 2.5, G - h - 18 + k * 4.5, x + w * .8 + 3 - k * 2.5, G - h - 18 + k * 4.5) for k in range(1, 4)], 'ln'))
    o.append(rect(x + w / 2 - 5, G - 18, 10, 18, 'rec'))
    o.append(rect(x + 5, G - h + 8, 8, 9, 'win'))
    o.append(rect(x + w - 13, G - h + 8, 8, 9, 'win'))
    return o


def rain_tree(cx, r, trunk=26, flowers=False):
    o = [path(f'M{cx} {G}V{G - trunk}M{cx} {G - trunk + 8}L{cx - r * .4} {G - trunk - 4}M{cx} {G - trunk + 4}L{cx + r * .35} {G - trunk - 6}', 'trunk')]
    blobs = [(-.62, .12, .55), (-.22, -.22, .62), (.25, -.18, .6), (.62, .12, .52), (0, .18, .6)]
    o.append(''.join(circle(cx + dx * r, G - trunk - 6 + dy * r, s * r, 'leaf-fill') for dx, dy, s in blobs))
    o.append(path(''.join(f'M{f(cx + dx * r - s * r)} {f(G - trunk - 6 + dy * r)}a{f(s * r)} {f(s * r)} 0 0 1 {f(2 * s * r)} 0' for dx, dy, s in blobs), 'leaf'))
    if flowers:
        pts = [(-.7, .1), (-.4, -.35), (-.1, -.55), (.2, -.4), (.5, -.2), (.75, .1), (-.2, .05), (.3, .1), (0, -.2), (-.55, -.15), (.6, -.05)]
        o.append(''.join(circle(cx + dx * r, G - trunk - 6 + dy * r, 2.4, 'flower') for dx, dy in pts))
    return o


def towers():
    """UB City, World Trade Center and CBD office blocks."""
    o = []
    # office block, brick
    o.append('<g class="tw tw-brick">' + rect(1196, G - 138, 64, 138) + grid(1203, G - 130, 5, 12, 6, 6, 11.4, 10.5, 'win') + rect(1193, G - 142, 70, 5, 'trim') + '</g>')
    # UB City, Comet block with its crown
    ub = [rect(1276, G - 262, 58, 262)]
    ub.append(lines([(1276 + k * 7.25, G - 258, 1276 + k * 7.25, G) for k in range(1, 8)], 'fin'))
    ub.append(lines([(1276, G - 200 + k * 34, 1334, G - 200 + k * 34) for k in range(6)], 'fin'))
    ub.append(path(f'M1270 {G - 262}H1340L1334 {G - 276}H1276Z', 'trim'))
    ub.append(path(f'M1280 {G - 276}L1288 {G - 300}H1322L1330 {G - 276}Z'))
    ub.append(path(f'M1290 {G - 300}L1305 {G - 336}L1320 {G - 300}Z', 'crown'))
    ub.append(lines([(1305, G - 352, 1305, G - 336)]))
    o.append('<g class="tw tw-glass">' + ''.join(ub) + '</g>')
    # UB City, Canberra block with a sloped top
    o.append('<g class="tw tw-glass2">' + path(f'M1342 {G}V{G - 178}L1392 {G - 196}V{G}Z') + lines([(1342 + k * 10, G - 180 - k * 3.6, 1342 + k * 10, G) for k in range(1, 5)], 'fin') + '</g>')
    # World Trade Center, rounded glass tower
    wtc = [path(f'M1424 {G}V{G - 214}Q1424 {G - 236} 1450 {G - 238}Q1476 {G - 236} 1476 {G - 214}V{G}Z')]
    wtc.append(lines([(1424, G - 206 + k * 13, 1476, G - 206 + k * 13) for k in range(15)], 'fin'))
    o.append('<g class="tw tw-teal">' + ''.join(wtc) + '</g>')
    # mustard deco block with a water tank
    o.append('<g class="tw tw-mustard">' + rect(1500, G - 116, 76, 116) + rect(1497, G - 120, 82, 5, 'trim') + rect(1522, G - 134, 28, 14) + grid(1508, G - 108, 6, 10, 6, 6, 10.6, 10.5, 'win') + '</g>')
    # tall slab with balconies
    o.append('<g class="tw tw-cream">' + rect(1600, G - 186, 54, 186) + lines([(1600, G - 176 + k * 12, 1654, G - 176 + k * 12) for k in range(15)], 'ln') + rect(1597, G - 190, 60, 5, 'trim') + '</g>')
    o.append('<g class="tw tw-brick">' + rect(1676, G - 104, 70, 104) + grid(1683, G - 96, 5, 9, 6, 6, 12.4, 10.5, 'win') + rect(1673, G - 108, 76, 5, 'trim') + '</g>')
    o.append('<g class="tw tw-teal">' + rect(1770, G - 158, 50, 158) + lines([(1770 + k * 10, G - 154, 1770 + k * 10, G) for k in range(1, 5)], 'fin') + rect(1767, G - 162, 56, 5, 'trim') + '</g>')
    return o


def metro():
    """Namma Metro viaduct and a purple train."""
    o = []
    deck = G - 54
    # starts behind the photo's right wing so the line runs on out of the scene
    for px in range(1056, 1921, 72):
        o.append(path(f'M{px - 5} {G}V{deck + 14}H{px - 10}V{deck + 6}H{px + 10}V{deck + 14}H{px + 5}V{G}Z', 'b'))
    o.append(rect(1000, deck, 940, 8, 'b'))
    o.append(lines([(1000, deck + 4, 1940, deck + 4)]))
    for i in range(3):
        x = 1330 + i * 64
        o.append(path(f'M{x} {deck}V{deck - 14}Q{x} {deck - 22} {x + 8} {deck - 22}H{x + 58}V{deck}Z', 'metro'))
        o.append(grid(x + 8, deck - 17, 5, 1, 7, 6, 10, 0, 'win'))
        o.append(rect(x, deck - 6, 58, 2.5, 'trim'))
    return o


# The real Vidhana Soudha: Aaron Antony Paul's photo (Unsplash License), cut out and graded into
# evening light in the portal palette by IC Solutions. Placed between the drawn buildings.
PHOTO_W = 880
PHOTO_IMG = (1034, 288, 10)  # width, height, padding added for the outline and print shadow
PHOTO_H = round(PHOTO_W * PHOTO_IMG[1] / PHOTO_IMG[0], 1)
PHOTO = {'x': 720 - PHOTO_W / 2, 'y': round(G - PHOTO_H * (PHOTO_IMG[1] - PHOTO_IMG[2]) / PHOTO_IMG[1], 1), 'width': PHOTO_W, 'height': PHOTO_H}


def hedge(x0, x1):
    """Garden shrubs in front of the photo, so its base sits in the same drawn ground as the rest."""
    sizes = [15, 11, 18, 13, 16, 10, 14, 19, 12, 16, 11, 17, 13]
    d_back, d_front, d_line, x, k = '', '', '', x0, 0
    while x < x1:
        r = sizes[k % len(sizes)]
        w = 2 * r
        # a low rounded shrub: wider than tall
        shape = f'M{f(x)} {G}c0 {-r * .9} {f(r * .4)} {-r * 1.15} {r} {-r * 1.15}s{r} {f(r * .25)} {r} {r * 1.15}'
        if k % 2:
            d_front += shape + 'Z'
        else:
            d_back += shape + 'Z'
        d_line += shape
        x += w - (5 if k % 2 else 7)
        k += 1
    return [path(d_back, 'leaf-fill'), path(d_front, 'leaf-fill2'), path(d_line, 'leaf')]


def svg_parts():
    # behind the photo: the CBD towers and the metro, which runs out from behind the building's right wing
    city_back = ''.join([
        '<g class="towers">' + ''.join(towers()) + '</g>',
        '<g class="metro-line">' + ''.join(metro()) + '</g>',
    ])
    # in front of the photo
    city = ''.join([
        '<g class="houses">' + ''.join(bungalow(-476, 40, 30)) + '</g>',
        '<g class="gopuram">' + ''.join(gopuram(-370)) + '</g>',
        '<g class="glasshouse">' + ''.join(glass_house(-150)) + '</g>',
        '<g class="palace">' + ''.join(bangalore_palace(10)) + '</g>',
        '<g class="hedge">' + ''.join(hedge(PHOTO['x'] + 4, PHOTO['x'] + PHOTO['width'] - 14)) + '</g>',
        '<g class="houses">' + ''.join(bungalow(1846, 44, 30)) + '</g>',
        ''.join('<g class="tree">' + ''.join(rain_tree(*a)) + '</g>' for a in [
            (-300, 18, 18, False), (-4, 16, 16, True), (286, 22, 24, False), (1150, 26, 28, True), (1898, 22, 22, False)]),
    ])
    cx, cy = 790, 176
    rays = ''.join(
        f'M{cx} {cy}L{f(cx + 900 * math.cos(2 * math.pi * i / 28))} {f(cy + 900 * math.sin(2 * math.pi * i / 28))}'
        f'L{f(cx + 900 * math.cos(2 * math.pi * i / 28 + math.pi / 28))} {f(cy + 900 * math.sin(2 * math.pi * i / 28 + math.pi / 28))}Z'
        for i in range(28))
    sky = (f'<path class="rays" d="{rays}"/>' + circle(cx, cy, 116, 'sun-ring') + circle(cx, cy, 90, 'sun') +
           path(''.join(f'M{cx - 130} {cy + 18 + k * 13}H{cx + 130}' for k in range(5)), 'sun-line') +
           ''.join(path(f'M{x} {y}h{w}a{w * .2} {w * .2} 0 0 0 -{w * .37} -{w * .14}a{w * .26} {w * .26} 0 0 0 -{w * .5} {w * .06}a{w * .13} {w * .13} 0 0 0 -{w * .13} {w * .08}z', 'cloud')
                   for x, y, w in ((196, 92, 70), (930, 64, 86), (-260, 70, 70), (1700, 88, 70), (430, 50, 60))))
    back = (path('M-480 300C-300 236-120 254 40 282C200 236 380 210 560 266C700 302 760 302 900 266C1080 214 1260 226 1420 272C1580 236 1760 226 1920 262V392H-480Z', 'hill-1') +
            path('M-480 332C-320 298-160 302 0 324C180 302 340 290 520 320C680 342 780 338 940 314C1120 290 1300 300 1460 324C1620 302 1780 298 1920 318V392H-480Z', 'hill-2'))
    ground = path(f'M-480 {G}H1920V392H-480Z', 'ground-band') + path(f'M-480 {G}H1920', 'ground') + path(f'M-480 {G + 12}H1920', 'road')
    return {'sky': sky, 'back': back, 'city_back': city_back, 'city': city, 'ground': ground}


if __name__ == '__main__':
    parts = svg_parts()
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, '..', 'src', 'components', 'skylineMarkup.js')
    with open(out, 'w') as fh:
        fh.write('// Generated by tools/skyline.py. Edit that file, not this one.\n'
                 '// Retro poster drawing of Bengaluru: Vidhana Soudha under a sunburst, Attara Kacheri, Bangalore Palace,\n'
                 '// the Lalbagh Glass House, a gopuram, UB City and the CBD towers, Namma Metro, rain trees and gulmohars.\n'
                 "export const SKYLINE_VIEWBOX = '-480 0 2400 392'\n")
        for k, v in parts.items():
            fh.write(f'export const SKY_{k.upper()} = {json.dumps(v)}\n')
        fh.write(f'export const SKY_PHOTO = {json.dumps(PHOTO)}\n')
    print({k: len(v) for k, v in parts.items()})
