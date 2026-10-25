import json, sys
E = 5715  # EMU per mock pixel (1600 px = 9144000 EMU)
PANELS = "https://raw.githubusercontent.com/eelkedevries/eek-a-look/b2e0becc38383d0722fdba54b85089228228a92a/presi/v4/"
PHOTOS = "https://raw.githubusercontent.com/eelkedevries/eek-a-look/c09d34bf7beef360c25745b9aa530df3a9d4eaf6/public/examples/"
NAVY = {"red": 0.106, "green": 0.165, "blue": 0.278}
INK = {"red": 0.122, "green": 0.161, "blue": 0.216}
BLUE = {"red": 0.184, "green": 0.498, "blue": 0.816}
ORANGE = {"red": 0.867, "green": 0.478, "blue": 0.086}
TILE = {"red": 0.933, "green": 0.949, "blue": 0.969}
RULE = {"red": 0.812, "green": 0.835, "blue": 0.871}

SLIDES = {
  "eag_slide": dict(ex="greenery", p="g", a="zurich-33", b="zurich-33-low-hedge", title="Groen langs de plint", manip="lage haag",
      q="verschuift beplanting langs de voet van een gebouw de aandacht naar voetgangersniveau?", r="0,72", mp="+2,9", ba="−1,0", sp="−4",
      old=["eag_photo0","eag_q","eag_h0","eag_h1","eag_h2","eag_h3","eag_r1","eag_r2","eag_ph1","eag_gm","eag_pa","eag_gmd","eag_pb","eag_pd","eag_none","eag_c10","eag_c11","eag_c12","eag_c13","eag_c20","eag_c22","eag_c23","eag_foot"]),
  "eat_slide": dict(ex="glazing", p="t", a="zurich-53", b="zurich-53-glass-frontage", title="Transparante plint", manip="transparante plint",
      q="trekt een transparante, verlichte plint meer aandacht dan de oorspronkelijke plint in de schaduw?", r="0,85", mp="−4,0", ba="+14,4", sp="+7",
      old=["et3_q","et3_h0","et3_h1","et3_h2","et3_h3","et3_r1","et3_r2","et3_pha","et3_phb","et3_gm","et3_pa","et3_gmd","et3_pb","et3_pd","et3_none","et3_c10","et3_c11","et3_c12","et3_c13","et3_c20","et3_c22","et3_c23","et3_foot"]),
  "eae_slide": dict(ex="entrance", p="e", a="zurich-42", b="zurich-42-entrance-block", title="Kleur rond de entree", manip="blauwgroen blok",
      q="maakt een contrasterende kleur rond de entree die entree visueel opvallender?", r="0,76", mp="+1,8", ba="+4,4", sp="+35",
      old=["eae_photo0","eae_photo1","eae_q","eae_h0","eae_h1","eae_h2","eae_h3","eae_r1","eae_r2","eae_gm","eae_pa","eae_gmd","eae_pb","eae_pd","eae_none","eae_c10","eae_c11","eae_c12","eae_c13","eae_c20","eae_c22","eae_c23","eae_foot"]),
}

def props(page, x, y, w, h):
    return {"pageObjectId": page, "size": {"width": {"magnitude": w * E, "unit": "EMU"}, "height": {"magnitude": h * E, "unit": "EMU"}},
            "transform": {"scaleX": 1, "scaleY": 1, "translateX": x * E, "translateY": y * E, "unit": "EMU"}}

def style(oid, start, end, size, bold=False, colour=None, family="Calibri"):
    st = {"fontFamily": family, "fontSize": {"magnitude": size, "unit": "PT"}, "bold": bold}
    f = "fontFamily,fontSize,bold"
    if colour:
        st["foregroundColor"] = {"opaqueColor": {"rgbColor": colour}}; f += ",foregroundColor"
    return {"updateTextStyle": {"objectId": oid, "textRange": {"type": "FIXED_RANGE", "startIndex": start, "endIndex": end}, "style": st, "fields": f}}

def para(oid, align="START", spacing=100):
    return {"updateParagraphStyle": {"objectId": oid, "textRange": {"type": "ALL"}, "style": {"alignment": align, "lineSpacing": spacing, "spaceAbove": {"magnitude": 0, "unit": "PT"}, "spaceBelow": {"magnitude": 0, "unit": "PT"}}, "fields": "alignment,lineSpacing,spaceAbove,spaceBelow"}}

def textbox(reqs, oid, page, x, y, w, h, runs, align="START", dy=8):
    """runs: list of (text, size, bold, colour). Text boxes have 16 px side and 8 px top insets, so the box is offset by them."""
    reqs.append({"createShape": {"objectId": oid, "shapeType": "TEXT_BOX", "elementProperties": props(page, x - 16, y - dy, w + 32, h + 16)}})
    text = "".join(r[0] for r in runs)
    reqs.append({"insertText": {"objectId": oid, "text": text}})
    reqs.append(para(oid, align))
    i = 0
    for t, size, bold, colour in runs:
        reqs.append(style(oid, i, i + len(t), size, bold, colour)); i += len(t)

def tile(reqs, oid, page, x, y, w, h, label, number, colour, meaning):
    reqs.append({"createShape": {"objectId": oid, "shapeType": "RECTANGLE", "elementProperties": props(page, x, y, w, h)}})
    reqs.append({"updateShapeProperties": {"objectId": oid, "shapeProperties": {"shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": TILE}}}, "outline": {"propertyState": "NOT_RENDERED"}, "contentAlignment": "MIDDLE"}, "fields": "shapeBackgroundFill.solidFill.color,outline.propertyState,contentAlignment"}})
    unit = " %-pt" if number not in ("0,72", "0,85", "0,76") else ""
    text = f"{label}\n{number}{unit}\n{meaning}"
    reqs.append({"insertText": {"objectId": oid, "text": text}})
    reqs.append(para(oid, "START", 100))
    a = len(label) + 1; b = a + len(number)
    reqs.append(style(oid, 0, len(label), 8, True, INK))
    reqs.append(style(oid, a, b, 16, True, colour))
    if unit: reqs.append(style(oid, b, b + len(unit), 7.5, True, colour))
    c = b + len(unit) + 1
    reqs.append(style(oid, c, c + len(meaning), 7, False, INK))

def sign_colour(v, positive):  # positive: colour for a positive value
    return positive if v.startswith("+") else (ORANGE if positive is BLUE else BLUE)

def build(page, s):
    p, ex = "v4" + s["p"] + "_", s["ex"]
    reqs = [{"deleteObject": {"objectId": o}} for o in s["old"]]
    # title and question on one line, in the title placeholder
    title = page.split("_")[0] + "_title"
    reqs.append({"deleteText": {"objectId": title, "textRange": {"type": "ALL"}}})
    t = s["title"]; gap = "    "; qb = "Vraag: "; q = s["q"]
    reqs.append({"insertText": {"objectId": title, "text": t + gap + qb + q}})
    reqs.append(para(title))
    reqs.append(style(title, 0, len(t), 20, True, NAVY, "Cambria"))
    reqs.append(style(title, len(t), len(t) + len(gap) + len(qb), 10, True, INK))
    reqs.append(style(title, len(t) + len(gap) + len(qb), len(t) + len(gap) + len(qb) + len(q), 10, False, INK))
    reqs.append({"updatePageElementTransform": {"objectId": title, "applyMode": "ABSOLUTE", "transform": {"scaleX": 1520 * E / 3000000, "scaleY": 56 * E / 3000000, "translateX": 8 * E, "translateY": 0, "unit": "EMU"}}})
    num = page.split("_")[0] + "_num"
    reqs.append({"updatePageElementTransform": {"objectId": num, "applyMode": "ABSOLUTE", "transform": {"scaleX": 70 * E / 3000000, "scaleY": 44 * E / 3000000, "translateX": 1526 * E, "translateY": 2 * E, "unit": "EMU"}}})
    # left: the two photographs, larger than the rest
    textbox(reqs, p + "lab1", page, 24, 64, 440, 34, [("ORIGINEEL", 14, True, NAVY)], dy=24)
    reqs.append({"createImage": {"objectId": p + "ph1", "url": PHOTOS + s["a"] + ".jpg", "elementProperties": props(page, 24, 98, 440, 330)}})
    textbox(reqs, p + "lab2", page, 24, 452, 440, 34, [("GEMANIPULEERD", 14, True, NAVY), (" · " + s["manip"], 11, False, NAVY)], dy=24)
    reqs.append({"createImage": {"objectId": p + "ph2", "url": PHOTOS + s["b"] + ".jpg", "elementProperties": props(page, 24, 486, 440, 330)}})
    # bands: columns at 480, 795, 1110 (309 × 232) and 1425 (150) for the stats
    X = [480, 795, 1110]; Y1, Y2, Y3 = 88, 362, 604
    for name, col, y in [("b1-measured", 0, Y1), ("b1-predicted", 1, Y1), ("b1-contrast", 2, Y1),
                         ("b2-original", 0, Y2), ("b2-manipulated", 1, Y2), ("b2-contrast", 2, Y2),
                         ("b3-original", 0, Y3), ("b3-manipulated", 1, Y3)]:
        reqs.append({"createImage": {"objectId": p + name.replace("-", "_"), "url": f"{PANELS}{ex}-{name}.png", "elementProperties": props(page, X[col], y, 309, 232)}})
    sq = "■"
    textbox(reqs, p + "leg1", page, 1110, 66, 474, 20, [("gemeten − voorspeld:  ", 7, True, NAVY), (sq, 7, True, BLUE), (" meer gemeten   ", 7, True, INK), (sq, 7, True, ORANGE), (" meer voorspeld", 7, True, INK)], dy=19)
    textbox(reqs, p + "leg2", page, 1110, 340, 474, 20, [("gemanipuleerd − origineel:  ", 7, True, NAVY), (sq, 7, True, BLUE), (" meer origineel   ", 7, True, INK), (sq, 7, True, ORANGE), (" meer gemanipuleerd", 7, True, INK)], dy=19)
    reqs.append({"createLine": {"objectId": p + "rule", "lineCategory": "STRAIGHT", "elementProperties": props(page, 480, 329, 1095, 0)}})
    reqs.append({"updateLineProperties": {"objectId": p + "rule", "lineProperties": {"lineFill": {"solidFill": {"color": {"rgbColor": RULE}}}, "weight": {"magnitude": 1, "unit": "PT"}}, "fields": "lineFill.solidFill.color,weight"}})
    mp_c = sign_colour(s["mp"], BLUE)
    tile(reqs, p + "t1", page, 1425, Y1, 150, 113, "Overeenkomst", s["r"], NAVY, "1 = perfect")
    tile(reqs, p + "t2", page, 1425, Y1 + 119, 150, 113, "Blikken op omlijnd gebied", s["mp"], mp_c, "gemeten meer" if s["mp"].startswith("+") else "voorspeld meer")
    ba_c = sign_colour(s["ba"], ORANGE)
    tile(reqs, p + "t3", page, 1425, Y2, 150, 232, "Blikken op omlijnd gebied", s["ba"], ba_c, "gemanipuleerd meer" if s["ba"].startswith("+") else "gemanipuleerd minder")
    sp_c = sign_colour(s["sp"], ORANGE)
    tile(reqs, p + "t4", page, 1110, Y3, 465, 232, "Voorspelde kijkpaden die het omlijnde gebied raken", s["sp"], sp_c,
         ("gemanipuleerd meer" if s["sp"].startswith("+") else "gemanipuleerd minder") + " · 100 paden per afbeelding; getoond: pad 1")
    return reqs

out = sys.argv[1]
for page, s in SLIDES.items():
    r = build(page, s)
    open(f"{out}/req-{page}.json", "w").write(json.dumps(r, ensure_ascii=False))
    print(page, len(r), "requests", len(json.dumps(r, ensure_ascii=False)), "chars")
