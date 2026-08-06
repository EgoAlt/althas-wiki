#!/usr/bin/env python3
"""One-shot: extract the two trigger sigils from the Codex of Arcane Arts PDF
(p9) as standalone SVGs matching the sigil-pack conventions.

The author's asset pack ships every sigil EXCEPT the two Ring triggers
(Caster's Will, Target's Will), which exist only as vector art in the PDF's
p9 table. Method: page.get_drawings() returns the page's vector items; keep
strokes whose bbox falls inside a hardcoded clip rect around each glyph and
re-emit them as <path> elements in a tight local viewBox.

Validation: --validate extracts the known Caster target glyph the same way so
the output can be compared against sigils/targets/caster.svg by eye.

CC-BY 4.0, Roc Humet Vidal; provenance is recorded in sigils/manifest.json.
"""
import pathlib
import sys

import fitz

PDF = pathlib.Path(
    "/Users/lucaslino/Desktop/Ontos/Projects/rpgs-and-gest/daggerheart/raw/Codex_of_Arcane_Arts_v1.pdf"
)
OUT = pathlib.Path(__file__).resolve().parent.parent / "sigils/triggers"
CLIPS = {  # PDF points, from the p9 render (labels at x>=370; glyphs sit left of them)
    "casters-will": fitz.Rect(290, 470, 370, 512),
    "targets-will": fitz.Rect(300, 515, 360, 558),
}
VALIDATE_CLIP = ("caster-validation", fitz.Rect(40, 470, 132, 500))


def emit(name: str, clip: fitz.Rect, out_dir: pathlib.Path) -> None:
    page = fitz.open(PDF)[8]
    paths, bbox = [], fitz.Rect(fitz.Rect().x0, 0, 0, 0)
    bbox = None
    for d in page.get_drawings():
        if not clip.contains(d["rect"]):
            continue
        bbox = d["rect"] if bbox is None else bbox | d["rect"]
        segs = []
        for item in d["items"]:
            if item[0] == "l":
                segs.append(f"M{item[1].x:.2f},{item[1].y:.2f}L{item[2].x:.2f},{item[2].y:.2f}")
            elif item[0] == "c":
                p1, p2, p3, p4 = item[1:5]
                segs.append(
                    f"M{p1.x:.2f},{p1.y:.2f}C{p2.x:.2f},{p2.y:.2f} "
                    f"{p3.x:.2f},{p3.y:.2f} {p4.x:.2f},{p4.y:.2f}"
                )
            elif item[0] == "re":
                r = item[1]
                segs.append(f"M{r.x0:.2f},{r.y0:.2f}H{r.x1:.2f}V{r.y1:.2f}H{r.x0:.2f}Z")
        w = d.get("width") or 1.0
        paths.append((" ".join(segs), w))
    if not paths:
        sys.exit(f"{name}: no drawings inside clip {clip}")
    m = 4  # margin
    vw, vh = bbox.width + 2 * m, bbox.height + 2 * m
    body = "\n".join(
        f'    <path d="{d}" transform="translate({m - bbox.x0:.2f},{m - bbox.y0:.2f})" '
        f'style="fill:none;stroke:black;stroke-width:{w:.2f}px;stroke-linecap:round;'
        f'stroke-linejoin:round;"/>'
        for d, w in paths
    )
    out_dir.mkdir(exist_ok=True)
    (out_dir / f"{name}.svg").write_text(
        f'<svg width="100%" height="100%" viewBox="0 0 {vw:.0f} {vh:.0f}" '
        f'version="1.1" xmlns="http://www.w3.org/2000/svg">\n{body}\n</svg>\n'
    )
    print(f"{name}: {len(paths)} drawing(s), viewBox 0 0 {vw:.0f} {vh:.0f}")


if __name__ == "__main__":
    if "--validate" in sys.argv:
        name, clip = VALIDATE_CLIP
        emit(name, clip, pathlib.Path("/tmp"))
    else:
        for name, clip in CLIPS.items():
            emit(name, clip, OUT)
