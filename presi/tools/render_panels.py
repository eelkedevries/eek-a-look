"""Slide panels for an eek-a-look comparison, drawn as the site draws them.

Ports src/render/heatmap.ts, src/render/fixations.ts and drawOutline in
src/views/example.ts to Python, so the measured-gaze panels match the
DeepGaze MSDB panels already on the slide.

Usage: python render_panels.py <repo> <example-id> <out-dir> [--size 1200x900]
"""

import argparse
import base64
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def lut_from_colormaps(repo: Path) -> tuple[np.ndarray, np.ndarray]:
    src = (repo / "src/render/colormaps.ts").read_text()
    hex_ = "".join(re.findall(r"'([0-9a-f]+)'", src.split("const INFERNO_HEX =")[1].split(";")[0]))
    inferno = np.frombuffer(bytes.fromhex(hex_), np.uint8).reshape(256, 3).astype(float)
    stops = re.search(r"BLUE_ORANGE: Lut = fromStops\(\[([^\]]+)\]", src).group(1)
    rgb = np.array([[int(s[i : i + 2], 16) for i in (1, 3, 5)] for s in re.findall(r"'(#[0-9a-f]{6})'", stops)], float)
    blue_orange = np.zeros((256, 3))
    for i in range(256):
        t = i / 255 * (len(rgb) - 1)
        k = min(int(t), len(rgb) - 2)
        f = t - k
        blue_orange[i] = rgb[k] * (1 - f) + rgb[k + 1] * f
    return inferno, blue_orange


def load_map(path: Path) -> np.ndarray:
    d = json.loads(path.read_text())
    w, h = d["grid"]["width"], d["grid"]["height"]
    v = np.frombuffer(base64.b64decode(d["data"]), "<u2").astype(np.float64).reshape(h, w)
    v = np.maximum(v, 0)
    return v / v.sum()


def load_mask(path: Path, region_id: str) -> np.ndarray:
    d = json.loads(path.read_text())
    w, h = d["width"], d["height"]
    region = next(r for r in d["regions"] if r["id"] == region_id)
    flat = np.zeros(w * h, np.uint8)
    pos, inside = 0, False
    for run in region["rle"]:
        if inside:
            flat[pos : pos + run] = 1
        pos += run
        inside = not inside
    return flat.reshape(h, w)


def percentile(values: np.ndarray, p: float) -> float:
    s = np.sort(values.ravel().astype(np.float32))
    return float(s[min(len(s) - 1, int(np.floor(p * len(s))))])


def upscale_rgba(rgba: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Bilinear upscaling in premultiplied alpha, as a canvas drawImage with smoothing does."""
    a = rgba[..., 3:4] / 255
    pre = np.concatenate([rgba[..., :3] * a, a * 255], axis=-1)
    out = np.stack([np.asarray(Image.fromarray(pre[..., c].astype(np.float32), "F").resize(size, Image.BILINEAR)) for c in range(4)], -1)
    return out  # premultiplied, 0–255


def heat_rgba(m: np.ndarray, lut: np.ndarray, bottom: float, top: float) -> np.ndarray:
    span = (top - bottom) or 1
    t = np.clip((m - bottom) / span, 0, 1)
    k = np.round((0.35 + 0.65 * t) * 255).astype(int)
    rgba = np.zeros(m.shape + (4,))
    rgba[..., :3] = lut[k]
    rgba[..., 3] = np.round(255 * 0.9 * t**0.8)
    return rgba


def diff_rgba(field: np.ndarray, lut: np.ndarray, top: float | None = None) -> tuple[np.ndarray, float]:
    top = top or percentile(np.abs(field), 0.99) or 1
    t = np.clip(field / top, -1, 1)
    c = np.sign(t) * (0.3 + 0.7 * np.abs(t))
    k = np.round((c + 1) / 2 * 255).astype(int)
    rgba = np.zeros(field.shape + (4,))
    rgba[..., :3] = lut[k]
    rgba[..., 3] = np.round(235 * np.abs(t) ** 0.75)
    return rgba, top


def greyed(photo: Path, size: tuple[int, int], dim: float = 0.75) -> np.ndarray:
    rgb = np.asarray(Image.open(photo).convert("RGB")).astype(float)
    g = dim * (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2])
    g = np.asarray(Image.fromarray(g.astype(np.float32), "F").resize(size, Image.LANCZOS))
    return np.repeat(g[..., None], 3, -1)


def over(base: np.ndarray, pre: np.ndarray) -> np.ndarray:
    return pre[..., :3] + base * (1 - pre[..., 3:4] / 255)


def outline_layer(mask: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    m = mask.astype(bool)
    pad = np.pad(m, 1)
    interior = pad[1:-1, :-2] & pad[1:-1, 2:] & pad[:-2, 1:-1] & pad[2:, 1:-1]
    edge = m & ~interior
    edge[0, :] |= m[0, :]
    edge[-1, :] |= m[-1, :]
    edge[:, 0] |= m[:, 0]
    edge[:, -1] |= m[:, -1]
    big = np.kron(edge, np.ones((2, 2))).astype(np.float32)
    rgba = np.zeros(big.shape + (4,))
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 127, 255, 212
    rgba[..., 3] = big * 255
    return upscale_rgba(rgba, size)


def fixation_layer(points: list, src_size: tuple[int, int], size: tuple[int, int], displayed: float, opacity: float = 0.65) -> np.ndarray:
    """Cyan dots with a dark edge (src/render/fixations.ts), drawn 4× and reduced for anti-aliasing."""
    ss = 4
    W, H = size[0] * ss, size[1] * ss
    css_r = min(3, max(1.25, displayed / 300))
    r = css_r * size[0] / displayed * ss
    sx, sy = W / src_size[0], H / src_size[1]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = max(1, r * 0.5)
    for x, y in points:
        cx, cy = (x + 0.5) * sx, (y + 0.5) * sy
        d.ellipse([cx - r - lw / 2, cy - r - lw / 2, cx + r + lw / 2, cy + r + lw / 2], fill=(0, 0, 0, 191))
    for x, y in points:
        cx, cy = (x + 0.5) * sx, (y + 0.5) * sy
        d.ellipse([cx - r + lw / 2, cy - r + lw / 2, cx + r - lw / 2, cy + r - lw / 2], fill=(0, 229, 255, 255))
    img = img.resize(size, Image.LANCZOS)
    a = np.asarray(img).astype(float)
    a[..., 3] *= opacity
    pre = np.concatenate([a[..., :3] * a[..., 3:4] / 255, a[..., 3:4]], -1)
    return pre


def save(arr: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(np.round(arr), 0, 255).astype(np.uint8)).save(path, optimize=True)
    print("wrote", path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", type=Path)
    ap.add_argument("example")
    ap.add_argument("out", type=Path)
    ap.add_argument("--size", default="1200x900")
    ap.add_argument("--displayed", type=float, default=150.0, help="displayed width in CSS px (sets dot radius)")
    args = ap.parse_args()
    size = tuple(int(v) for v in args.size.split("x"))
    repo, out = args.repo, args.out
    out.mkdir(parents=True, exist_ok=True)
    inferno, blue_orange = lut_from_colormaps(repo)

    comp = json.loads((repo / "public/examples/comparisons.json").read_text())
    ex = next(e for e in comp["examples"] if e["id"] == args.example)
    a_id, b_id = ex["a"], ex["b"]
    ref_id = ex.get("reference", a_id)
    pre = repo / "public/precomputed"
    region_file = pre / "comparisons" / f"{args.example}.json"
    region_id = json.loads(region_file.read_text())["regions"][0]["id"]
    mask = load_mask(region_file, region_id)

    meas = load_map(pre / "measured" / f"{ref_id}.json")
    pts = json.loads((pre / "measured" / f"{ref_id}.points.json").read_text())
    ma = load_map(pre / "deepgaze-msdb" / f"{a_id}.json")
    mb = load_map(pre / "deepgaze-msdb" / f"{b_id}.json")

    photo_a = repo / "public/examples" / f"{a_id}.jpg"
    photo_b = repo / "public/examples" / f"{b_id}.jpg"
    grey_a, grey_b = greyed(photo_a, size), greyed(photo_b, size)
    ol = outline_layer(mask, size)

    def heat_panel(base, m, rng, with_outline=True, points=None):
        img = over(base, upscale_rgba(heat_rgba(m, inferno, *rng), size))
        if points is not None:
            img = over(img, fixation_layer(points, (pts["width"], pts["height"]), size, args.displayed))
        return over(img, ol) if with_outline else img

    def diff_panel(base, field):
        rgba, top = diff_rgba(field, blue_orange)
        return over(over(base, upscale_rgba(rgba, size)), ol), top

    # Measured gaze exists only for the untouched photograph (the reference); when A is itself an
    # edit (glazing), the measured panels are compared with the model's map of the reference.
    if ref_id == a_id:
        mref, grey_ref = ma, grey_a
    else:
        mref = load_map(pre / "deepgaze-msdb" / f"{ref_id}.json")
        grey_ref = greyed(repo / "public/examples" / f"{ref_id}.jpg", size)

    # sharedRange as on the site, but over every heat map on the slide, so one colour is one density everywhere.
    maps = [meas, mref, ma, mb]
    rng = (min(m.min() for m in maps), percentile(np.concatenate([m.ravel() for m in maps]), 0.99))

    save(heat_panel(grey_a, ma, rng), out / f"{args.example}-msdb-a.png")
    save(heat_panel(grey_b, mb, rng), out / f"{args.example}-msdb-b.png")
    d_ba, top_ba = diff_panel(grey_b, mb - ma)
    save(d_ba, out / f"{args.example}-msdb-diff.png")
    save(heat_panel(grey_ref, meas, rng, points=pts["points"]), out / f"{args.example}-measured.png")
    d_mp, top_mp = diff_panel(grey_ref, meas - mref)
    save(d_mp, out / f"{args.example}-measured-minus-msdb.png")
    d_pm, _ = diff_panel(grey_ref, mref - meas)
    save(d_pm, out / f"{args.example}-msdb-minus-measured.png")
    if ref_id != a_id:
        save(heat_panel(grey_ref, mref, rng), out / f"{args.example}-msdb-ref.png")

    def resample(src: np.ndarray, w: int, h: int) -> np.ndarray:
        """src/maps/saliency-map.ts resample(): bilinear, cell centres aligned, renormalised."""
        sh, sw = src.shape
        fy = np.clip((np.arange(h) + 0.5) * sh / h - 0.5, 0, sh - 1)
        fx = np.clip((np.arange(w) + 0.5) * sw / w - 0.5, 0, sw - 1)
        y0, x0 = np.floor(fy).astype(int), np.floor(fx).astype(int)
        y1, x1 = np.minimum(y0 + 1, sh - 1), np.minimum(x0 + 1, sw - 1)
        wy, wx = (fy - y0)[:, None], (fx - x0)[None, :]
        top = src[y0][:, x0] * (1 - wx) + src[y0][:, x1] * wx
        bottom = src[y1][:, x0] * (1 - wx) + src[y1][:, x1] * wx
        out = top * (1 - wy) + bottom * wy
        return out / out.sum()

    # As attentionShares() in src/maps/areas.ts: the map upsampled to the mask, summed inside it.
    share = lambda x: float(resample(x, mask.shape[1], mask.shape[0])[mask.astype(bool)].sum())
    r = float(np.corrcoef(meas.ravel(), mref.ravel())[0, 1])
    stats = {
        "example": args.example, "a": a_id, "b": b_id, "reference": ref_id,
        "observers": pts["observers"], "fixations": len(pts["points"]),
        "share_in_region": {"measured": share(meas), "msdb_reference": share(mref), "msdb_a": share(ma), "msdb_b": share(mb)},
        "region_share_of_image": float(mask.mean()),
        "pearson_measured_msdb_reference": r,
        "diff_scale_top": {"b_minus_a": top_ba, "measured_minus_reference": top_mp},
    }
    (out / f"{args.example}-stats.json").write_text(json.dumps(stats, indent=1))
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
