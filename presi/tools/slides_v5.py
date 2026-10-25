"""presi-slides v5: slides 9-11 in two bands (1: measured vs predicted, 2: original vs manipulated); new slide 12 with all scanpaths."""
import json, sys
from slides_v4 import E, PHOTOS, NAVY, INK, BLUE, ORANGE, TILE, props, style, para, textbox

PANELS = "https://raw.githubusercontent.com/eelkedevries/eek-a-look/b2e0becc38383d0722fdba54b85089228228a92a/presi/v4/"
PATHS = "https://raw.githubusercontent.com/eelkedevries/eek-a-look/5db6255a89d463afd73f72d3fd487865dcd546c2/presi/v5/"
V4 = ["lab1", "ph1", "lab2", "ph2", "b1_measured", "b1_predicted", "b1_contrast", "b2_original", "b2_manipulated", "b2_contrast",
      "b3_original", "b3_manipulated", "leg1", "leg2", "rule", "t1", "t2", "t3", "t4"]

# Shares are rounded first and the contrasts are their differences, so the numbers on a slide add up.
EX = {
  "greenery": dict(page="eag_slide", p="g", a="zurich-33", b="zurich-33-low-hedge", title="Groen langs de plint", manip="lage haag",
                   meas="7,7", pa="4,7", pb="3,7", r="0,72", mp="+3,0", ba="−1,0", sa=38, sb=34),
  "glazing":  dict(page="eat_slide", p="t", a="zurich-53", b="zurich-53-glass-frontage", title="Transparante plint", manip="transparante plint",
                   meas="22,1", pa="26,0", pb="40,4", r="0,85", mp="−3,9", ba="+14,4", sa=91, sb=98),
  "entrance": dict(page="eae_slide", p="e", a="zurich-42", b="zurich-42-entrance-block", title="Kleur rond de entree", manip="blauwgroen blok",
                   meas="8,3", pa="6,5", pb="10,9", r="0,76", mp="+1,8", ba="+4,4", sa=39, sb=74),
}

def rect(reqs, oid, page, x, y, w, h):
    reqs.append({"createShape": {"objectId": oid, "shapeType": "RECTANGLE", "elementProperties": props(page, x, y, w, h)}})
    reqs.append({"updateShapeProperties": {"objectId": oid, "shapeProperties": {"shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": TILE}}}, "outline": {"propertyState": "NOT_RENDERED"}, "contentAlignment": "MIDDLE"}, "fields": "shapeBackgroundFill.solidFill.color,outline.propertyState,contentAlignment"}})

def runs_into(reqs, oid, runs, align="START"):
    reqs.append({"insertText": {"objectId": oid, "text": "".join(r[0] for r in runs)}})
    reqs.append(para(oid, align, 100))
    i = 0
    for t, size, bold, colour in runs:
        reqs.append(style(oid, i, i + len(t), size, bold, colour)); i += len(t)

def tile(reqs, oid, page, x, y, w, h, label, number, unit, colour, meaning):
    rect(reqs, oid, page, x, y, w, h)
    runs_into(reqs, oid, [(label + "\n", 9, True, INK), (number, 20, True, colour), (unit + "\n", 10, True, colour), (meaning, 8, False, INK)])

def signed(v, plus, minus):
    return plus if v.startswith("+") else minus

def example_slide(s):
    page, p = s["page"], "v5" + s["p"] + "_"
    reqs = [{"deleteObject": {"objectId": "v4" + s["p"] + "_" + o}} for o in V4]
    PX, PW, PH = 16, 500, 375
    CX, CW, CH = [530, 884, 1238], 346, 259.5
    for band, (Y, label, step) in enumerate([(90, [("ORIGINEEL", 14, True, NAVY)], "1  Voorspelt het model waar mensen kijken?"),
                                             (503, [("GEMANIPULEERD", 14, True, NAVY), (" · " + s["manip"], 11, False, NAVY)], "2  Wat verandert de ingreep volgens het model?")]):
        n = str(band + 1)
        textbox(reqs, p + "lab" + n, page, PX, Y - 30, PW, 24, label, dy=24)
        reqs.append({"createImage": {"objectId": p + "ph" + n, "url": PHOTOS + (s["a"] if band == 0 else s["b"]) + ".jpg", "elementProperties": props(page, PX, Y, PW, PH)}})
        textbox(reqs, p + "step" + n, page, CX[0], Y - 29, 700, 24, [(step, 13, True, NAVY)], dy=23)
        sq = "■"
        leg = [(sq, 7.5, True, BLUE), (" meer gemeten   " if band == 0 else " meer origineel   ", 7.5, True, INK), (sq, 7.5, True, ORANGE), (" meer voorspeld" if band == 0 else " meer gemanipuleerd", 7.5, True, INK)]
        textbox(reqs, p + "leg" + n, page, CX[2] - 60, Y - 18, CW + 60, 14, leg, align="END", dy=19)
        names = ["b1-measured", "b1-predicted", "b1-contrast"] if band == 0 else ["b2-original", "b2-manipulated", "b2-contrast"]
        for c, name in enumerate(names):
            reqs.append({"createImage": {"objectId": p + name.replace("-", "_"), "url": f"{PANELS}{s['ex']}-{name}.png", "elementProperties": props(page, CX[c], Y, CW, CH)}})
        TY, TH = Y + CH + 6, PH - CH - 6
        first, second = (s["meas"], s["pa"]) if band == 0 else (s["pa"], s["pb"])
        tile(reqs, p + "t" + n + "a", page, CX[0], TY, CW, TH, "Op omlijnd gebied", first, " %", BLUE, "van alle blikken")
        tile(reqs, p + "t" + n + "b", page, CX[1], TY, CW, TH, "Op omlijnd gebied", second, " %", ORANGE, "van alle blikken")
        if band == 0:
            half = (CW - 8) / 2
            tile(reqs, p + "t1c", page, CX[2], TY, half, TH, "Overeenkomst", s["r"], "", NAVY, "1 = perfect")
            tile(reqs, p + "t1d", page, CX[2] + half + 8, TY, half, TH, "Verschil", s["mp"], " %-pt", signed(s["mp"], BLUE, ORANGE), signed(s["mp"], "gemeten meer", "voorspeld meer"))
        else:
            tile(reqs, p + "t2c", page, CX[2], TY, CW, TH, "Verschil", s["ba"], " %-pt", signed(s["ba"], ORANGE, BLUE), signed(s["ba"], "gemanipuleerd meer", "gemanipuleerd minder"))
    return reqs

def paths_slide():
    page = "v5_paths"
    reqs = [{"createSlide": {"objectId": page, "insertionIndex": 11, "slideLayoutReference": {"layoutId": "p22"},
             "placeholderIdMappings": [{"layoutPlaceholder": {"type": "TITLE", "index": 0}, "objectId": "v5p_title"},
                                       {"layoutPlaceholder": {"type": "SLIDE_NUMBER", "index": 0}, "objectId": "v5p_num"}]}}]
    t, gap, qb = "Voorspelde kijkpaden", "    ", "Vraag: "
    q = "raakt het kijkpad na de ingreep vaker het omlijnde gebied?"
    note = "   Getoond: pad 1 van 100, op de voorspelde heatmap"
    reqs.append({"insertText": {"objectId": "v5p_title", "text": t + gap + qb + q + note}})
    reqs.append(para("v5p_title"))
    a = len(t); b = a + len(gap) + len(qb); c = b + len(q)
    reqs += [style("v5p_title", 0, a, 20, True, NAVY, "Cambria"), style("v5p_title", a, b, 10, True, INK),
             style("v5p_title", b, c, 10, False, INK), style("v5p_title", c, c + len(note), 10, False, INK)]
    reqs.append({"updatePageElementTransform": {"objectId": "v5p_title", "applyMode": "ABSOLUTE", "transform": {"scaleX": 1520 * E / 3000000, "scaleY": 56 * E / 3000000, "translateX": 8 * E, "translateY": 0, "unit": "EMU"}}})
    reqs.append({"updatePageElementTransform": {"objectId": "v5p_num", "applyMode": "ABSOLUTE", "transform": {"scaleX": 0.20955, "scaleY": 0.08382, "translateX": 8481060, "translateY": 11430, "unit": "EMU"}}})
    reqs.append(para("v5p_num", "END"))
    W, H, X, Y = 496, 372, [40, 552, 1064], [90, 468]
    for c, (ex, s) in enumerate(EX.items()):
        textbox(reqs, f"v5p_h{c}", page, X[c], 60, W, 24, [(s["title"], 14, True, NAVY), (" · " + s["manip"], 11, False, NAVY)], dy=24)
        for r, which in enumerate(["original", "manipulated"]):
            reqs.append({"createImage": {"objectId": f"v5p_{ex}_{which}", "url": f"{PATHS}{ex}-paths-{which}.png", "elementProperties": props(page, X[c], Y[r], W, H)}})
        colour = ORANGE if s["sb"] > s["sa"] else BLUE
        rect(reqs, f"v5p_t{c}", page, X[c], Y[1] + H + 6, W, 46)
        runs_into(reqs, f"v5p_t{c}", [("Raken omlijnd gebied:  ", 9, True, INK), (f"{s['sa']} → {s['sb']}", 16, True, colour), ("  van 100 paden", 9, False, INK)])
    return reqs

out = sys.argv[1]
for ex, s in EX.items():
    s["ex"] = ex
    r = example_slide(s)
    open(f"{out}/v5-{s['page']}.json", "w").write(json.dumps(r, ensure_ascii=False))
    print(s["page"], len(r))
r = paths_slide()
open(f"{out}/v5-paths.json", "w").write(json.dumps(r, ensure_ascii=False))
print("paths", len(r))
