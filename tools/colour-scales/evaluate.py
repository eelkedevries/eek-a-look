"""Measures how faithfully heatmap and difference colour scales show the stored maps (prompt 079).

Mirrors src/render/heatmap.ts: values to a colour table and an alpha, drawn over the greyed photo (Rec. 709 luminance
x 0.75), upsampled bilinearly with premultiplied alpha as a browser does. Visual strength is the CIEDE2000 difference
between the drawn pixel and the photo beneath.

    uv run evaluate.py heat         # heatmap scales over every stored map, and over the three Example pairs
    uv run evaluate.py difference   # difference scales over the three Example pairs and 79 other comparisons
    uv run evaluate.py tables       # the blue-orange table before and after balancing its halves, at the chosen scale
"""
import base64
import glob
import itertools
import json
import os
import sys

import matplotlib
import numpy as np
from PIL import Image
from scipy.ndimage import maximum_filter
from skimage.color import deltaE_ciede2000, rgb2lab

PUBLIC = os.path.join(os.path.dirname(__file__), '..', '..', 'public')
PAIRS = [('entrance', 'zurich-42', 'zurich-42-entrance-block'),
         ('greenery', 'zurich-33', 'zurich-33-low-hedge'),
         ('glazing', 'zurich-53', 'zurich-53-glass-frontage')]
NEUTRAL = 96.0  # the greyed photo's typical tone
INFERNO = matplotlib.colormaps['inferno'](np.linspace(0, 1, 256))[:, :3] * 255


def stops(hexes):
    rgb = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in hexes], float)
    t = np.linspace(0, 1, 256) * (len(rgb) - 1)
    k = np.minimum(t.astype(int), len(rgb) - 2)
    return rgb[k] * (1 - (t - k)[:, None]) + rgb[k + 1] * (t - k)[:, None]


BLUE_ORANGE_BEFORE = ['#2f7fd0', '#5ea3e3', '#a6cbeb', '#ededed', '#f7c27c', '#f0983a', '#dd7a16']
BLUE_ORANGE_BALANCED = ['#2f7fd0', '#5ea3e3', '#a6cbeb', '#ededed', '#dcb077', '#d08c42', '#bc7329']
# The scale scan of `difference` was run with the table before balancing, as recorded.
BLUE_ORANGE = stops(BLUE_ORANGE_BEFORE)


def load_map(photo, model='deepgaze-msdb'):
    p = json.load(open(os.path.join(PUBLIC, 'precomputed', model, f'{photo}.json')))
    g = p['grid']
    v = np.frombuffer(base64.b64decode(p['data']), '<u2').astype(float).reshape(g['height'], g['width'])
    return v / v.sum()


def fit(m, shape):
    if m.shape == shape:
        return m
    m = np.asarray(Image.fromarray(m.astype(np.float32)).resize(shape[::-1], Image.BILINEAR))
    return m / m.sum()


_grey = {}


def grey(photo, w=640):
    if (photo, w) not in _grey:
        im = Image.open(os.path.join(PUBLIC, 'examples', f'{photo}.jpg')).convert('RGB')
        a = np.asarray(im.resize((w, round(w * im.size[1] / im.size[0])), Image.LANCZOS), float)
        _grey[(photo, w)] = (0.75 * (a @ [0.2126, 0.7152, 0.0722]))[..., None].repeat(3, 2)
    return _grey[(photo, w)]


def up(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32)).resize((w, h), Image.BILINEAR))


def composite(bg, rgb, alpha):
    h, w = bg.shape[:2]
    a = up(alpha, w, h)
    return bg * (1 - a[..., None]) + np.stack([up(rgb[..., c] * alpha, w, h) for c in range(3)], -1), a


def lab(img):
    return rgb2lab(np.clip(img, 0, 255) / 255)


def strength(img, bg):
    return deltaE_ciede2000(lab(img), lab(bg))


def wcorr(x, y, w):
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    return np.average((x - mx) * (y - my), weights=w) / np.sqrt(np.average((x - mx) ** 2, weights=w) * np.average((y - my) ** 2, weights=w))


# Heatmaps ------------------------------------------------------------------------------------------------------------

def heat_layer(m, bottom, top, curve):
    t = np.clip((m - bottom) / (top - bottom), 0, 1) ** curve
    return INFERNO[np.round((0.35 + 0.65 * t) * 255).astype(int)], 0.9 * t ** 0.8


def over_neutral(values, bottom, top, curve):
    rgb, a = heat_layer(values, bottom, top, curve)
    col = NEUTRAL * (1 - a[..., None]) + rgb * a[..., None]
    return deltaE_ciede2000(lab(col), lab(np.full_like(col, NEUTRAL))), col


def peaks(m, k=4):
    mx = maximum_filter(m, size=15)
    return np.array(sorted([m[tuple(p)] for p in np.argwhere((m == mx) & (m * m.size > 3))], reverse=True)[:k])


def hdr_levels(m, fractions=(0.05, 0.10, 0.25, 0.50, 0.75, 0.90)):
    v = np.sort(m.ravel())[::-1]
    return np.array([v[np.searchsorted(np.cumsum(v), f)] for f in fractions])


def heat_metrics(maps, top_pct, curve, min_top=0.0):
    """Over maps drawn on one shared scale: clipped mass, mass-weighted linearity, peak order, level separation, veil, mass shown."""
    allv = np.concatenate([m.ravel() for m in maps])
    bottom, top = allv.min(), max(np.percentile(allv, top_pct), min_top / maps[0].size)
    s, _ = over_neutral(allv[None], bottom, top, curve)
    out = dict(excess=np.mean([np.maximum(m - top, 0).sum() for m in maps]), wlin=wcorr(allv, s[0], allv))
    order, sep, veil, shown = [], [], [], []
    for m in maps:
        pv = peaks(m)
        if len(pv) >= 2:
            ps, _ = over_neutral(pv[None], bottom, top, curve)
            order += [float(ps[0, i] - ps[0, j] >= 3) for i in range(len(pv)) for j in range(i + 1, len(pv))]
        _, col = over_neutral(hdr_levels(m)[None], bottom, top, curve)
        sep.append(deltaE_ciede2000(lab(col[:, :-1]), lab(col[:, 1:]))[0].min())
        _, a = heat_layer(m, bottom, top, curve)
        veil.append((a >= 0.5).mean())
        shown.append(m[a >= 0.15].sum())
    out.update(peak_order=np.mean(order) if order else np.nan, level_sep=np.mean(sep), veil=np.mean(veil), shown=np.mean(shown))
    return out


def heat():
    msdb = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(PUBLIC, 'precomputed', 'deepgaze-msdb', '*.json')))
    measured = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(PUBLIC, 'precomputed', 'measured', '*.json')) if os.path.basename(f).count('.') == 1)
    singles = {'deepgaze-msdb': [load_map(p) for p in msdb], 'deepgaze-iie': [load_map(p, 'deepgaze-iie') for p in msdb],
               'measured': [load_map(p, 'measured') for p in measured]}
    pairs = [[load_map(a), load_map(b)] for _, a, b in PAIRS]
    print('Heatmap scales. excess = mass above the top; wlin = mass-weighted linearity of visual strength;')
    print('peak order = share of peak pairs where the higher looks brighter (dE >= 3); level sep = smallest dE between')
    print('the colours of the 5/10/25/50/75/90 % mass levels; veil = image share at alpha >= 0.5; shown = mass at alpha >= 0.15.')
    print(f"{'top':>6} {'curve':>5} {'set':>16} {'excess':>7} {'wlin':>6} {'peak order':>10} {'level sep':>9} {'veil':>6} {'shown':>6}")
    # The chosen setting has a minimum top of 4x the average; no stored map's 99.9th percentile is below 6.1x, so it only
    # acts on nearly flat maps such as classic salience, which runs in the browser and is not stored.
    for top, curve, min_top in [(99, 1.0, 0), (99.5, 0.7, 4), (99.8, 0.6, 4), (99.9, 0.7, 4), (99.9, 0.6, 4), (100, 0.6, 4)]:
        rows = [('Example A/B', [heat_metrics(p, top, curve, min_top) for p in pairs])]
        rows += [(k, [heat_metrics([m], top, curve, min_top) for m in v]) for k, v in singles.items()]
        for name, rs in rows:
            r = {k: np.nanmean([x[k] for x in rs]) for k in rs[0]}
            print(f"{top:6} {curve:5} {name:>16} {r['excess']:7.1%} {r['wlin']:6.3f} {r['peak_order']:10.0%} {r['level_sep']:9.1f} {r['veil']:6.1%} {r['shown']:6.0%}")


# Differences ---------------------------------------------------------------------------------------------------------

def diff_layer(d, scale, curve):
    """d in multiples of the image average."""
    t = np.clip(d / scale, -1, 1)
    m = np.abs(t) ** curve
    return BLUE_ORANGE[np.round((np.sign(t) * m + 1) / 2 * 255).astype(int)], 235 / 255 * m


def comparisons():
    out = []
    for ex, a, b in PAIRS:
        A = load_map(a)
        out.append(('example', ex, (load_map(b) - A) * A.size, b))
    for p in sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(PUBLIC, 'precomputed', 'deepgaze-msdb', '*.json'))):
        A = load_map(p)
        out.append(('site', p, (fit(load_map(p, 'deepgaze-iie'), A.shape) - A) * A.size, p))
    for p in sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(PUBLIC, 'precomputed', 'measured', '*.json')) if os.path.basename(f).count('.') == 1):
        M = load_map(p, 'measured')
        for model in ('deepgaze-msdb', 'deepgaze-iie'):
            out.append(('site', p, (M - fit(load_map(p, model), M.shape)) * M.size, p))
    return out


TAUS = (2.3, 3.5, 5.0)  # visibility thresholds in dE: just noticeable to clearly visible on a photo


def difference_scores(items, scale, curve):
    l1 = np.log([np.abs(d).sum() / d.size / 2 for kind, _, d, _ in items if kind == 'example'])
    drawn = []
    for kind, _, d, photo in items:
        bg = grey(photo, 640 if kind == 'example' else 320)
        img, _ = composite(bg, *diff_layer(d, scale, curve))
        drawn.append((kind, strength(img, bg), up(d, bg.shape[1], bg.shape[0]), d))
    ex = [x for x in drawn if x[0] == 'example']
    site = [x for x in drawn if x[0] == 'site']
    r = dict(ratio=[], ebal=[], sbal=[], signed=[], sr=[])
    for tau in TAUS:
        def bal(s, dp):
            w = np.maximum(s - tau, 0)
            return np.log((w[dp < 0].sum() + 1e-9) / (w[dp > 0].sum() + 1e-9))
        w = np.log([np.maximum(s - tau, 0).mean() + 1e-9 for _, s, _, _ in ex])
        r['ratio'].append(np.sqrt(np.mean([((w[i] - w[j]) - (l1[i] - l1[j])) ** 2 for i in range(3) for j in range(i + 1, 3)])))
        r['ebal'].append(np.sqrt(np.mean([bal(s, dp) ** 2 for _, s, dp, _ in ex])))
        r['sbal'].append(np.sqrt(np.mean([bal(s, dp) ** 2 for _, s, dp, _ in site])))
        r['signed'].append(np.mean([bal(s, dp) for _, s, dp, _ in site]))
        ws = [np.maximum(s - tau, 0).mean() + 1e-9 for _, s, _, _ in site]
        r['sr'].append(np.corrcoef(np.log(ws), np.log([np.abs(d).sum() / d.size / 2 for _, _, _, d in site]))[0, 1])
    out = {k: float(np.mean(v)) for k, v in r.items()}
    out['wlin'] = np.mean([wcorr(np.abs(dp).ravel(), s.ravel(), np.abs(dp).ravel() + 1e-9) for _, s, dp, _ in ex])
    out['clip'] = np.mean([np.maximum(np.abs(d) - scale, 0).sum() / np.abs(d).sum() for _, _, _, d in site])
    out['tiny'] = np.mean([((np.abs(dp) < 0.25) & (s >= 5)).mean() for _, s, dp, _ in ex])
    out['vis'] = np.mean([((np.abs(dp) >= 1) & (s >= 5)).sum() / max((np.abs(dp) >= 1).sum(), 1) for _, s, dp, _ in site])
    return out


def difference():
    items = comparisons()
    print('Difference scales: |t|^curve to +-scale x the image average. Visual weight counts only dE above tau.')
    print('ex ratio = RMS error of log weight ratios between the examples against their shares of gaze moved;')
    print('balance = RMS log ratio of loss to gain weight (truth 0); site r = correlation of weight and gaze moved over')
    print('79 comparisons; tiny = image share with |d| < 0.25 shown at dE >= 5; vis = share of |d| >= 1 shown at dE >= 5.')
    print(f"{'curve':>5} {'scale':>5} | {'ex ratio':>8} {'ex bal':>7} {'site bal':>8} {'site r':>7} | {'wlin':>6} {'clip':>6} {'tiny':>6} {'vis':>6}")
    for curve, scale in itertools.product((1.0, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5), (6, 8, 10, 12)):
        r = difference_scores(items, scale, curve)
        print(f"{curve:5} {scale:5} | {r['ratio']:8.2f} {r['ebal']:7.2f} {r['sbal']:8.2f} {r['sr']:7.3f} | {r['wlin']:6.3f} {r['clip']:6.1%} {r['tiny']:6.1%} {r['vis']:6.1%}", flush=True)


def tables():
    global BLUE_ORANGE
    items = comparisons()
    print('At +-12x, curve 0.6. signed balance < 0: blue carries less visible weight than the equal orange.')
    for name, table in (('before', BLUE_ORANGE_BEFORE), ('balanced', BLUE_ORANGE_BALANCED)):
        BLUE_ORANGE = stops(table)
        r = difference_scores(items, 12, 0.6)
        print(f"{name:9s} ex ratio {r['ratio']:.2f}  ex balance {r['ebal']:.2f}  site balance {r['sbal']:.2f} (signed {r['signed']:+.2f})  tiny {r['tiny']:.1%}  vis {r['vis']:.1%}", flush=True)


if __name__ == '__main__':
    {'heat': heat, 'difference': difference, 'tables': tables}[sys.argv[1]]()
