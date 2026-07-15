#!/usr/bin/env python3
"""
Sync the player-facing content/ folder from the GM's private Ontos wiki.

The GM's master wiki (in the Ontos vault, not this repo) is annotated with
two Obsidian callout types: [!gm-only] for in-world secrets not yet revealed
to players (unwrapped by hand as the campaign plays out), and [!gm-notes]
for permanent author-side content (real-world citations, planning notes)
that never reaches players.

This script reads each mapped source page, strips both callout types
entirely, trims frontmatter down to just `title:` (carrying forward any
existing `marker:` map-pin data already present in the destination file,
since that's presentation data with no equivalent in the GM's source),
drops the Sources/Last updated bookkeeping lines, and writes the result
into content/.

content/ is a generated build artifact from this point on: don't hand-edit
files this script writes, edit the Ontos source and re-run this script.
This is a mechanical strip, not a judgment call: always read `git diff
content/` yourself before publishing, the same way check-broken-links.py's
--fix mode never replaces a human read.
"""
import re
import sys
from pathlib import Path

ONTOS_SETTING = Path.home() / "Desktop/Ontos/Projects/rpgs-and-gest/daggerheart/campaigns/ut-supra-sic-infra/setting"
CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

# Display title for each source page. Kept as an explicit table (not derived
# from the filename) so it always matches Lucas's own naming choices exactly.
TITLES = {
    "althas.md": "Althas",
    "canton-of-inquisition.md": "Canton of Inquisition",
    "codex-magic.md": "Codex Magic",
    "faeries.md": "Faeries",
    "holy-relics.md": "Holy Relics",
    "miracles.md": "Miracles",
    "splendor-magic.md": "Splendor Magic",
    "the-holy-see.md": "The Holy See",
    "the-one-above.md": "The One Above",
    "the-ones-below.md": "The Ones Below",
    "the-ophanim.md": "The Ophanim",
    "armada.md": "Armada",
    "crater-lake.md": "Crater Lake",
    "draconis.md": "Draconis",
    "hilltop.md": "Hilltop",
    "hilltop-night-zone.md": "The Hilltop Night Zone",
    "convent-of-saint-trefan.md": "Convent of Saint Trefan",
    "drinmery.md": "Drinmery",
    "jesthaen.md": "Jesthaen",
    "polaris.md": "Polaris",
    "voldaen.md": "Voldaen",
    "aldric-voldis.md": "Aldric Voldis",
    "edrion-voldis.md": "Edrion Voldis",
    "eltanin.md": "Eltanin",
    "guilmore-fleming.md": "Guilmore Fleming",
    "hesper.md": "Hesper",
    "immanuel-greene.md": "Immanuel Greene",
    "izar.md": "Izar",
    "kingslayer.md": "The Kingslayer",
    "orsian-voldis.md": "Orsian Voldis",
    "thuban.md": "Thuban",
    "valis-voldis.md": "Valis Voldis",
    "valthis-voldis.md": "Valthis Voldis",
    "rastaban.md": "Rastaban",
    "rosestripe.md": "Rosestripe",
    "uriel-kenan.md": "Uriel Kenan",
    "index.md": "Althas",
}

# source filename (in Ontos setting/) -> destination path (relative to content/)
PAGE_MAP = {
    "althas.md": "setting/althas.md",
    "canton-of-inquisition.md": "setting/canton-of-inquisition.md",
    "codex-magic.md": "setting/codex-magic.md",
    "faeries.md": "setting/faeries.md",
    "holy-relics.md": "setting/holy-relics.md",
    "miracles.md": "setting/miracles.md",
    "splendor-magic.md": "setting/splendor-magic.md",
    "the-holy-see.md": "setting/the-holy-see.md",
    "the-one-above.md": "setting/the-one-above.md",
    "the-ones-below.md": "setting/the-ones-below.md",
    "the-ophanim.md": "setting/the-ophanim.md",
    "armada.md": "locations/armada/armada.md",
    "crater-lake.md": "locations/crater-lake.md",
    "draconis.md": "locations/draconis/draconis.md",
    "hilltop.md": "locations/hilltop.md",
    "hilltop-night-zone.md": "locations/hilltop-night-zone.md",
    "convent-of-saint-trefan.md": "locations/jesthaen/convent-of-saint-trefan.md",
    "drinmery.md": "locations/jesthaen/drinmery.md",
    "jesthaen.md": "locations/jesthaen/jesthaen.md",
    "polaris.md": "locations/polaris/polaris.md",
    "voldaen.md": "locations/voldaen/voldaen.md",
    "aldric-voldis.md": "npcs/aldric-voldis.md",
    "edrion-voldis.md": "npcs/edrion-voldis.md",
    "eltanin.md": "npcs/eltanin.md",
    "guilmore-fleming.md": "npcs/guilmore-fleming.md",
    "hesper.md": "npcs/hesper.md",
    "immanuel-greene.md": "npcs/immanuel-greene.md",
    "izar.md": "npcs/izar.md",
    "kingslayer.md": "npcs/kingslayer.md",
    "orsian-voldis.md": "npcs/orsian-voldis.md",
    "thuban.md": "npcs/thuban.md",
    "valis-voldis.md": "npcs/valis-voldis.md",
    "valthis-voldis.md": "npcs/valthis-voldis.md",
    "rastaban.md": "player-characters/rastaban.md",
    "rosestripe.md": "player-characters/rosestripe.md",
    "uriel-kenan.md": "player-characters/uriel-kenan.md",
    "index.md": "index.md",
}

# Pages that exist in Ontos but currently have nothing left to say once
# GM-only material is stripped out. Not an error, revisit as the campaign
# reveals more; listed explicitly so a skip is a decision, not a silent gap.
NOT_YET_PUBLIC = {
    "the-co-existers.md",
    "the-fallen-houses.md",
    "sage-magic.md",
    "ophanim-heresies.md",
    "old-blood.md",
}

CALLOUT_START_RE = re.compile(r"^>\s*\[!(gm-only|gm-notes)\]", re.IGNORECASE)
HEADING_RE = re.compile(r"^#{1,6}\s")
FRONTMATTER_RE = re.compile(r"^---\n(.*?\n)---\n?", re.DOTALL)


def split_frontmatter(text):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


def extract_marker_block(frontmatter_text):
    lines = frontmatter_text.splitlines()
    for idx, line in enumerate(lines):
        if line.startswith("marker:"):
            block = [line]
            j = idx + 1
            while j < len(lines) and (lines[j][:1] in (" ", "\t") or lines[j].strip() == ""):
                block.append(lines[j])
                j += 1
            while block and block[-1].strip() == "":
                block.pop()
            return "\n".join(block)
    return None


def strip_callouts(body):
    lines = body.splitlines()
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if CALLOUT_START_RE.match(line):
            i += 1
            while i < n:
                if lines[i].startswith(">"):
                    i += 1
                    continue
                if lines[i].strip() == "":
                    j = i
                    while j < n and lines[j].strip() == "":
                        j += 1
                    if j < n and lines[j].startswith(">"):
                        i = j
                        continue
                break
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def strip_meta_lines(body):
    out = []
    for line in body.splitlines():
        s = line.strip()
        if s.startswith("**Sources**:") or s.startswith("**Last updated**:"):
            continue
        out.append(line)
    return "\n".join(out)


def drop_empty_headings(body):
    lines = body.splitlines()
    out = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if HEADING_RE.match(line):
            j = i + 1
            has_content = False
            while j < n and not HEADING_RE.match(lines[j]):
                s = lines[j].strip()
                if s and s != "---":
                    has_content = True
                j += 1
            if not has_content:
                i = j
                continue
        out.append(line)
        i += 1
    return "\n".join(out)


def clean_blank_runs(text):
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def render(title, marker_block, body):
    fm_lines = ["---", f"title: {title}"]
    if marker_block:
        fm_lines.append(marker_block)
    fm_lines.append("---")
    return "\n".join(fm_lines) + "\n\n" + body


def sync_page(src_name, dest_rel):
    src = ONTOS_SETTING / src_name
    text = src.read_text()
    _, body = split_frontmatter(text)
    body = strip_callouts(body)
    body = strip_meta_lines(body)
    body = drop_empty_headings(body)
    body = clean_blank_runs(body)

    dest = CONTENT_DIR / dest_rel
    marker_block = None
    if dest.exists():
        existing_fm, _ = split_frontmatter(dest.read_text())
        marker_block = extract_marker_block(existing_fm)

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(render(TITLES[src_name], marker_block, body))
    return dest


def main():
    written = []
    for src_name, dest_rel in PAGE_MAP.items():
        dest = sync_page(src_name, dest_rel)
        written.append(str(dest.relative_to(CONTENT_DIR)))

    print(f"Synced {len(written)} page(s) from Ontos:")
    for w in sorted(written):
        print(f"  {w}")

    print(f"\nNot yet public (no content survives once GM-only material is stripped):")
    for name in sorted(NOT_YET_PUBLIC):
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
