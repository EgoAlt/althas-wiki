# sigils/

Source assets for magic-circle (seal) composition: the drawable building blocks
of the Codex of Arcane Arts notation, which is canonical Althas seal grammar.

**These are committed source files. Treat them as immutable.** They are the
upstream art, not generated output. See [LICENSE.md](LICENSE.md), whose
attribution requirement is a license condition rather than a courtesy.

## Layout

```
sigils/
  manifest.json        every sigil's id, category, original filename, viewBox w/h
  LICENSE.md           CC-BY 4.0 attribution and what it obliges
  elements/    (46)    the Heart: what the seal reaches for
  functions/   (16)    the Daggers: how the seal acts
  modifiers/    (8)    Create, Manipulate, Loop, Reset, Delay, Senses, 2 Shapes
  targets/      (5)    the Ring: who or what the seal acts on
  triggers/     (2)    the Ring: when the seal fires (extracted, see below)
  reference-circles/ (24)  the author's own finished compositions, for comparison
```

Filenames are slugified from the source pack for code use (`Nature (air) -
create.svg` became `elements/nature-air-create.svg`). `manifest.json` records
each original filename, so provenance back to the source pack is preserved. The
canonical archive of the untouched packs, including the 24 reference PNGs not
copied here, lives in the Ontos vault at
`Projects/rpgs-and-gest/daggerheart/raw/`.

`reference-circles/` is for verification, not for shipping. Comparing generated
output against the author's own composition of the same seal is the cheapest way
to catch a layout regression.

## Why here, and not in content/ or quartz/static/

- **Not `content/`**: that directory is a generated artifact. `scripts/sync-from-ontos.py`
  regenerates pages from the Ontos vault, and only a small set of non-lore
  presentation fields is carried forward. Build-critical source assets do not
  belong somewhere a sync writes. Quartz would also treat files there as part of
  the markdown corpus to process and publish.
- **Not `quartz/static/`**: everything there is served at the site root, so all
  75 sigils would become individually downloadable files the site does not need
  to serve. Harmless legally, but it is payload and API surface for nothing.
- **Here, at the repo root**: plainly source, outside the sync's reach, outside
  the served tree, and committed (`.gitignore` excludes none of it).

## The constraint any consumer has to respect

**A composed seal must be fully self-contained SVG at the moment it is
rasterized.** All sigil geometry has to be inlined into the single SVG element,
with no `<image>`, no `<use xlink:href>`, and no external references of any kind
pointing at these files.

Two independent reasons, both verified on 2026-08-06:

1. An SVG rasterized through an `<img>` element (which is how canvas-based PNG
   export works) is loaded in a restricted mode where external references are
   not fetched at all. A composed seal that referenced sigil files would render
   with pieces silently missing.
2. Keeping everything inline keeps the canvas untainted, so `getImageData` and
   `toDataURL` both succeed and PNG export works. Verified end to end: SVG
   serialization produced valid markup, and a 2000x2000 canvas export succeeded
   with 198,610 ink pixels and no `SecurityError`.

## How to get these into a browser bundle

Not yet built, and the pipeline decision matters, so it is recorded here.

The inline-script loader in `quartz/cli/handlers.js` bundles `*.inline.ts`
through esbuild with **no `.svg` loader configured**, so a direct
`import sigil from "../../sigils/functions/absorption.svg"` fails with
"No loader is configured for .svg files".

Two ways forward:

1. **Patch the esbuild call** in `quartz/cli/handlers.js` to add an `.svg` text
   loader. Works, but edits a Quartz core file and adds upgrade friction. That
   file already carries one local patch (the `stub-node-crypto` plugin) and the
   Ontos wiki backlog notes that patch is broader than it should be.
2. **Generate a plain TypeScript module** from `sigils/` and import that
   normally. No core changes, works with the pipeline exactly as it stands, and
   the generator is the natural place to do the normalization work anyway:
   stripping the XML declaration and DOCTYPE, extracting each `viewBox` plus its
   inner markup, and rescaling stroke widths.

**Option 2 is the recommended one.** Option 1's only advantage is skipping a
generator script, and a generator is wanted regardless.

On stroke widths, one trap is worth naming because it looks like the fix and is
not: do **not** flatten every `stroke-width` to a single value. The artist varies
weights deliberately (`functions/absorption.svg` carries 4.87px, 5.05px *and*
15.7px strokes, the last being an arrowhead). Rescale proportionally so the
ratios between strokes within one sigil survive.

## Composition notes worth knowing before writing layout code

Established by inspecting the author's own reference circles, so these describe
how the source art actually behaves rather than how it might.

- **Placement is rigid-transform only.** `targets/caster.svg`'s path data appears
  **verbatim, four times** inside `reference-circles/flight.svg`. No warping, no
  bezier deformation. Translate, rotate, uniform scale is enough to reproduce the
  author's own layouts.
- **All five targets share one footprint**, exactly 326x50, so they are drop-in
  interchangeable in the Ring band.
- **Create and Manipulate variants ship pre-composed** for each element, so
  `elements/body-manipulate.svg` already includes the modifier. The standalone
  `modifiers/create.svg` and `modifiers/manipulate.svg` exist for cases the
  pre-composed set does not cover.
- **Finished circles use a normalized square canvas**, 1000x1000 for most and
  1500 or 2000 for the largest compound seals.
- **The two trigger sigils are not from the author's asset pack.** Caster's Will
  and Target's Will ship no SVG in the pack; the files in `triggers/` were
  extracted from the PDF's own p9 vector art by
  `scripts/extract-trigger-sigils.py` (method validated against a known glyph,
  approved by Lucas 2026-08-06). Their manifest entries carry a `provenance`
  field saying exactly this.
