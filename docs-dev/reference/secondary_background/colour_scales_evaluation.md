# Colour scales: evaluation (prompt 079, 2026-10-25)

How the heatmap and difference scales of `src/render/heatmap.ts` were chosen.
The numbers come from `tools/colour-scales/evaluate.py`, which mirrors the
site's drawing (colour table, alpha, greyed photo, bilinear upsampling with
premultiplied alpha). Visual strength is the CIEDE2000 colour difference
between a drawn pixel and the greyed photo beneath it. Browser screenshots
were checked against the script's renderings.

## Heatmaps

Candidates: the top of the scale at the 99th to 100th percentile, linear or
with a transfer curve t^0.5–0.85, log scales from 0.5× or 1× the image
average to the maximum, a mass-quantile scale, alpha curves t^0.6–1 and table
offsets 0.2 and 0.35: 216 combinations on the Example pairs, the leaders
also on all 98 stored maps (41 DeepGaze MSDB, 41 DeepGaze IIE, 16 measured).

| Scale | Set | Mass above the top | Linearity (mass-weighted) | Higher peak looks brighter | Image veiled | Gaze shown |
|---|---|---|---|---|---|---|
| 99th percentile, linear (before) | Example A/B | 6.3 % | 0.838 | 17 % | 5.7 % | 83 % |
| | DeepGaze MSDB | 5.9 % | 0.907 | 44 % | 4.7 % | 83 % |
| | measured | 1.7 % | 0.977 | 61 % | 6.8 % | 85 % |
| **99.9th percentile, t^0.6 (chosen)** | Example A/B | 0.4 % | 0.971 | 83 % | 2.8 % | 89 % |
| | DeepGaze MSDB | 0.3 % | 0.980 | 78 % | 4.0 % | 91 % |
| | measured | 0.0 % | 0.992 | 76 % | 9.0 % | 97 % |

"Higher peak looks brighter" counts pairs of local maxima whose rendered
colours differ by at least 3 ΔE in the right direction. "Veiled" is the share
of the image at alpha ≥ 0.5, "shown" the share of the predicted gaze at alpha
≥ 0.15. Before, every peak above the 99th percentile rendered as one flat
yellow: on glazing's B, the door (51×) and the shop interior (12×) looked
equal. Linear scales without clipping (99.9th percentile or maximum) were
truthful but faint: a change of 1× the average between A and B was visible
in only 35–55 % of cells. Log scales separated every level but compressed the
ratios between peaks (linearity 0.87–0.91) and tinted broad areas.
Neighbouring settings (99.8th percentile, t^0.6–0.7; maximum, t^0.6) score
within a few points, so the choice is not on a knife-edge. The table (inferno
from 0.35) and alpha (0.9·t^0.8) chosen by the owner on 2026-10-18 are kept.

The two models that run in the browser were checked separately, from their
maps on the 38 library photos. UNISAL behaves like the stored models (its
99.9th percentile is 4.3–36.8× the average). Classic salience is nearly flat:
its maps peak at 1.5–2.8× the average. Scaled from its own minimum to its own
top, such a map fills the whole colour table and veiled 39 % of the photo
before (62 % with t^0.6), although it barely prefers any spot. The top of the
scale is therefore at least 4× the average. This sits below every other map's
top (the lowest is 4.3×), so it changes nothing else, and it brings classic
salience to 9 % veiled. It also makes the maps in Side by side comparable:
the correlation of visual strength with density across all models on a photo
rose from 0.66 to 0.86. Anchoring the bottom of the scale at the average
instead would have hidden a sixth of every model's predicted gaze (Example:
89 % shown → 74 %).

## Differences

Candidates: the old per-image scale (99th percentile of |d|, colour floor
0.3, alpha |t|^0.75); fixed ends of ±2× to ±12× the image average; linear
and curved (|t|^0.4–0.85) colour and alpha; a signed log; a log ratio
weighted by density; and the blue–orange, PuOr and RdBu tables. They were
tested on the three Example pairs and on 79 other comparisons (DeepGaze IIE
minus MSDB on 41 photos; measured minus MSDB and minus IIE on 16 photos).

| Comparison | 99th percentile of \|d\| | Largest \|d\| | Gaze that moves |
|---|---|---|---|
| Example B − A | 0.8–7.0× | 1.4–12.8× | 4.9–21.1 % |
| IIE − MSDB | 2.1–15.4× (median 5.0) | median 13.7× | 12–38 % |
| measured − MSDB | 3.6–12.1× (median 5.2) | median 19.4× | 25–45 % |

The old per-image scale gave greenery (4.9 % of gaze moved, largest change
1.4×) 2.2 times the visual weight of glazing (21.1 %, 12.8×).

What counts as "visual weight" decided the outcome. Summed over all pixels,
linear scales looked most faithful. But most of that sum comes from tints
below the threshold of visibility, and an independent blind reviewer, asked
to judge rendered sets against the true numbers, found that linear scales
overstate glazing against the other examples (about 7× instead of 4.1×) and
hide spread-out losses, which carry as much gaze as the concentrated gains.
The evaluation was therefore repeated counting only colour above a visibility
threshold τ (2.3, 3.5 and 5 ΔE, from just noticeable to clearly visible on a
textured photo):

| Curve | Scale | Example ratio error | Example loss/gain error | Other comparisons loss/gain error | Weight vs gaze moved (r) | Tiny changes visible | Changes ≥ 1× visible |
|---|---|---|---|---|---|---|---|
| linear | ±6 | 1.05 | 2.26 | 0.34 | 0.887 | 0.0 % | 96.8 % |
| linear | ±8 | 1.42 | 7.33 | 0.36 | 0.882 | 0.0 % | 91.6 % |
| t^0.75 | ±8 | 0.46 | 1.00 | 0.39 | 0.885 | 0.0 % | 99.0 % |
| t^0.7 | ±10 | 0.44 | 0.96 | 0.38 | 0.885 | 0.0 % | 98.4 % |
| t^0.65 | ±12 | 0.38 | 0.83 | 0.40 | 0.881 | 0.0 % | 98.3 % |
| **t^0.6** | **±12** | **0.29** | **0.54** | **0.46** | **0.865** | **0.6 %** | **99.1 %** |
| t^0.5 | ±8 | 0.53 | 0.26 | 0.67 | 0.782 | 13.8 % | 100 % |

All 28 settings are printed by `uv run evaluate.py difference`. Errors are root-mean-square log ratios averaged over the three thresholds (0
is perfect). "Tiny changes visible" is the share of an Example image where
|d| < 0.25× yet the colour reaches 5 ΔE: the original complaint that small
differences showed up as large contrast. Square-root and steeper curves
balance gains and losses best on the examples but light up tiny changes
(8–18 % of the image) and inflate the diffuse side of measured gaze. Linear
scales keep tiny changes invisible but under-show diffuse change. Curves of
t^0.6–0.7 at ±10–12× form a flat optimum. Within it, t^0.6 at ±12× is the
most faithful on the three examples, clips none of them (2.2 % of |d| on
the other comparisons), and uses the same curve as the heatmaps.

### Balancing blue and orange

Over the greyed photo, the blue half of the original table differed from the
grey less than the orange half at equal values: ΔE 24.6 against 32.6 at full
strength, 18.7 against 23.5 at half. Every difference map therefore gave
gains about a third more weight than the equal losses (mean signed balance
−0.38 on the other comparisons; e^−0.38 ≈ 0.68). No blue of the same hue
matches the orange's strength at part opacity without turning pale, so the
orange half was toned towards the grey instead (stops #dcb077, #d08c42,
#bc7329; the blue half and the hues are unchanged). At ±12×, t^0.6:

| Table | Example ratio error | Example loss/gain error | Other comparisons loss/gain error (signed) | Tiny changes visible |
|---|---|---|---|---|
| before | 0.29 | 0.54 | 0.46 (−0.38) | 0.6 % |
| balanced | 0.29 | 0.46 | 0.34 (−0.19) | 0.5 % |

Matching the halves fully (orange end #ac7033, brown) gained only 0.01 more.
The remaining −0.19 comes from the data: measured gaze is spread more widely
than the predictions, so its side of a contrast is more diffuse. Under
simulated protanopia, deuteranopia and tritanopia (Machado, Oliveira and
Fernandes, 2009) blue and the toned orange differ by ΔE 50–59, and both
differ from the grey by 24–28.

## Blind reviews

Two independent reviewers, given only the anonymised images and the true
numbers, ranked candidate sets on truthfulness, legibility and
comparability.

1. Six full sets (heatmaps and differences). The reviewer ranked the
   per-image difference of before last ("the row-to-row truth is inverted")
   and the 99th-percentile heatmaps second to last ("peaks become flat,
   opaque discs"). It judged the chosen heatmaps "the best peak contrast of
   all sets", and preferred a square-root difference to the linear ones,
   which led to the perceptual re-evaluation above.
2. Five difference styles, with the heatmaps fixed and three measured-versus-
   predicted rows added. A second reviewer, unaware of the first round,
   ranked t^0.6 at ±12× first and t^0.7 at ±10× a close second; the square
   root at ±8× failed the small-difference test ("this repeats the original
   complaint"); linear ±4× and ±6× came last on proportion and magnitude.
   Its remaining points (blue weaker than orange; a faint lightening where
   almost nothing changes, +3 to +8 grey levels) led to the table balancing
   above; the lightening is the table's pale middle at low alpha and was
   left as it is.

## Limits

Visual strength in CIEDE2000 over a greyed photo is a model of perception,
not a measurement of it; texture masking is approximated by the thresholds.
The reviewers were language models judging rendered images against numbers,
not the site's visitors. No eye-tracking or user test was run.
