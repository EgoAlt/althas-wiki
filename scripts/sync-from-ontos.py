#!/usr/bin/env python3
"""
Sync the player-facing content/ folder from the GM's private Ontos wiki.

The GM's master wiki (in the Ontos vault, not this repo) is annotated with
two Obsidian callout types: [!gm-only] for in-world secrets not yet revealed
to players (unwrapped by hand as the campaign plays out), and [!gm-notes]
for permanent author-side content (real-world citations, planning notes)
that never reaches players.

This script reads each mapped source page, strips both callout types
entirely, trims frontmatter down to `title:` plus the whitelisted typed
infobox fields (see INFOBOX_KIND_FIELDS below; carrying forward any
existing `marker:` map-pin data, `submap:` local-map block, and `image:`
portrait filename already present in the destination file, since those are
presentation data with no equivalent in the GM's source),
drops the Sources/Last updated bookkeeping lines, and writes the result
into content/.

content/ is a generated build artifact from this point on: don't hand-edit
files this script writes, edit the Ontos source and re-run this script.
This is a mechanical strip, not a judgment call: always read `git diff
content/` yourself before publishing, the same way check-broken-links.py's
--fix mode never replaces a human read.

Each of the five nations (Armada, Polaris, Voldaen, Jesthaen, Hilltop) syncs
to its own folder's index.md directly, not to a same-named file alongside
it — a folder and a page inside it should never share a name. This relies
on a patched "shortest" link-resolution strategy in quartz/util/path.ts
that treats a folder's own index.md as satisfying a wikilink to that
folder's name, and a matching patch in check-broken-links.py's own
existing_targets(). If either patch is ever reverted, [[armada]] (and the
other four) will break across the whole site.
"""
import re
import sys
from pathlib import Path

ONTOS_SETTING = Path.home() / "Desktop/Ontos/Projects/rpgs-and-gest/daggerheart/campaigns/ut-supra-sic-infra/setting"
CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

# Display title for each source page. Kept as an explicit table (not derived
# from the filename) so it always matches Lucas's own naming choices exactly.
TITLES = {
    "diplomacy.md": "Diplomacy",
    "calendar.md": "Calendar",
    "timeline.md": "Timeline",
    "canton-of-inquisition.md": "Canton of Inquisition",
    "codex-magic.md": "Codex Magic",
    "faeries.md": "Faeries",
    "giants.md": "Giants",
    "clanks.md": "Clanks",
    "infernis.md": "Infernis",
    "divine-relics.md": "Divine Relics",
    "miracles.md": "Miracles",
    "splendor-magic.md": "Splendor Magic",
    "the-holy-see.md": "The Holy See",
    "the-one-above.md": "The One Above",
    "the-ones-below.md": "The Ones Below",
    "the-ophanim.md": "The Ophanim",
    "armada.md": "Armada",
    "guild.md": "The Guild",
    "crater-lake.md": "Crater Lake",
    "draconis.md": "Draconis",
    "hilltop.md": "Hilltop",
    "hilltop-night-zone.md": "The Hilltop Night Zone",
    "convent-of-saint-trefan.md": "Convent of Saint Trefan",
    "drinmery.md": "Drinmery",
    "jesthaen.md": "Jesthaen",
    "polaris.md": "Polaris",
    "voldaen.md": "Voldaen",
    "house-voldis.md": "House Voldis",
    "aldric-voldis.md": "Aldric Voldis",
    "edrion-voldis.md": "Edrion Voldis",
    "eltanin.md": "Eltanin",
    "guilmore-fleming.md": "Guilmore Fleming",
    "hesper.md": "Hesper",
    "izar.md": "Izar",
    "immanuel-greene.md": "Immanuel Greene",
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
    # Type-based folders (2026-07-16 Explorer/categories reorg, see the
    # campaign's specs/althas-explorer-categories-design.md in Ontos):
    # folders answer "what is this" (setting/ = world & concepts,
    # organizations/, magic/, beings/, ancestries/, locations/ purely
    # geographic), metadata answers "whose is this" (the generated
    # per-nation sections, quartz/components/NationIndex.tsx). Every page
    # moved in that reorg has a RENAMES entry below so its old URL keeps
    # redirecting.
    "diplomacy.md": "setting/diplomacy.md",
    "calendar.md": "setting/calendar.md",
    "timeline.md": "setting/timeline.md",
    "canton-of-inquisition.md": "organizations/canton-of-inquisition.md",
    "the-holy-see.md": "organizations/the-holy-see.md",
    "guild.md": "organizations/guild.md",
    "house-voldis.md": "organizations/house-voldis.md",
    "codex-magic.md": "magic/codex-magic.md",
    "divine-relics.md": "magic/divine-relics.md",
    "miracles.md": "magic/miracles.md",
    "splendor-magic.md": "magic/splendor-magic.md",
    "the-one-above.md": "beings/the-one-above.md",
    "the-ones-below.md": "beings/the-ones-below.md",
    "the-ophanim.md": "beings/the-ophanim.md",
    "faeries.md": "ancestries/faeries.md",
    "giants.md": "ancestries/giants.md",
    "clanks.md": "ancestries/clanks.md",
    "infernis.md": "ancestries/infernis.md",
    # The five nations (Armada, Polaris, Voldaen, Jesthaen, Hilltop) are each
    # a folder whose own index.md IS the nation's page, not a separate file
    # alongside it — [[armada]] resolves to a folder's index.md exactly the
    # same way it resolves to a same-named file, via the patched "shortest"
    # link-resolution strategy in quartz/util/path.ts. This avoids ever
    # having a folder and a page inside it share the same name.
    "armada.md": "locations/armada/index.md",
    "hilltop.md": "locations/hilltop/index.md",
    "crater-lake.md": "locations/hilltop/crater-lake.md",
    "convent-of-saint-trefan.md": "locations/jesthaen/convent-of-saint-trefan.md",
    "drinmery.md": "locations/jesthaen/drinmery.md",
    "jesthaen.md": "locations/jesthaen/index.md",
    "polaris.md": "locations/polaris/index.md",
    "voldaen.md": "locations/voldaen/index.md",
    "aldric-voldis.md": "npcs/aldric-voldis.md",
    "edrion-voldis.md": "npcs/edrion-voldis.md",
    "hesper.md": "npcs/hesper.md",
    "izar.md": "npcs/izar.md",
    "kingslayer.md": "npcs/kingslayer.md",
    "orsian-voldis.md": "npcs/orsian-voldis.md",
    "valis-voldis.md": "npcs/valis-voldis.md",
    "valthis-voldis.md": "npcs/valthis-voldis.md",
    "rastaban.md": "player-characters/rastaban.md",
    "rosestripe.md": "player-characters/rosestripe.md",
    "uriel-kenan.md": "player-characters/uriel-kenan.md",
    "index.md": "index.md",
}

# Old URL -> forever-redirect table. A page that has ever moved keeps every
# path it has ever lived at as a Quartz `aliases:` frontmatter entry (written
# by render() below on every sync, so re-syncs preserve the redirects
# forever). Each alias is a root-relative slug (no leading slash, no .md):
# quartz/plugins/transformers/frontmatter.ts slugifies it as-is and the
# AliasRedirects emitter then writes a redirect stub at that exact old URL.
# Keyed by CURRENT destination (the PAGE_MAP value); values are the old
# destination slugs. If a page moves again, append the newly-old slug here,
# never remove one: players' bookmarks don't expire.
#
# NOTE: frontmatter.ts deliberately does NOT feed these alias slugs into
# wikilink resolution (allSlugs). An alias by construction shares its
# basename with the real page, so counting it would make every [[basename]]
# link ambiguous under the "shortest" strategy and break site-wide. See the
# comment in quartz/plugins/transformers/frontmatter.ts.
RENAMES = {
    # 2026-07-17 landing-page merge: the standalone overview at /setting/althas
    # was folded into the home page (index.md). Keep that old URL redirecting to
    # home so player bookmarks survive. All [[althas]] wikilinks in the source
    # were repointed to [[index]] at the same time.
    "index.md": ["setting/althas"],
    # 2026-07-16 Explorer/categories reorg
    "locations/hilltop/crater-lake.md": ["locations/crater-lake"],
    "organizations/house-voldis.md": ["locations/voldaen/house-voldis"],
    "organizations/guild.md": ["locations/armada/guild"],
    "organizations/the-holy-see.md": ["setting/the-holy-see"],
    "organizations/canton-of-inquisition.md": ["setting/canton-of-inquisition"],
    "magic/miracles.md": ["setting/miracles"],
    "magic/codex-magic.md": ["setting/codex-magic"],
    "magic/splendor-magic.md": ["setting/splendor-magic"],
    "magic/divine-relics.md": ["setting/divine-relics"],
    "beings/the-one-above.md": ["setting/the-one-above"],
    "beings/the-ones-below.md": ["setting/the-ones-below"],
    "beings/the-ophanim.md": ["setting/the-ophanim"],
    "ancestries/faeries.md": ["setting/faeries"],
    "ancestries/giants.md": ["setting/giants"],
    "ancestries/clanks.md": ["setting/clanks"],
    "ancestries/infernis.md": ["setting/infernis"],
}

# Pages that exist in Ontos but produce no public page: everything on them is
# wrapped [!gm-only] (an in-world secret not yet revealed in play) or [!gm-notes]
# (author notes), so nothing survives the strip. They are deliberately left out
# of PAGE_MAP above. Listed here so a skip is a visible decision, not a silent
# gap. To publish one, unwrap its [!gm-only] material in the Ontos source and add
# it back to PAGE_MAP + TITLES.
#
# 2026-07-16: the former NOT_YET_SHARED list (pages held back despite having
# public-ready content) was retired at Lucas's request. Those pages' content was
# wrapped [!gm-only] instead, so "is this page public?" is now answered purely by
# its tags, one mechanism, not two. The giants (Draconis / Eltanin / Thuban), the
# Drinmery nobles (Guilmore Fleming / Immanuel Greene), Izar, and the Hilltop
# night zone joined this list as a result.
NOT_YET_PUBLIC = {
    "the-co-existers.md",
    "the-fallen-houses.md",
    "sage-magic.md",
    "ophanim-heresies.md",
    "old-blood.md",
    "draconis.md",
    "eltanin.md",
    "thuban.md",
    "guilmore-fleming.md",
    "immanuel-greene.md",
    "hilltop-night-zone.md",
}

# The public-fields contract for the typed-infobox pilot (see the campaign's
# specs/althas-article-templates-design.md in Ontos). These are the ONLY
# frontmatter keys, besides `title:` and the carried-forward `marker:` block,
# that are allowed to pass from the GM's source through to the published site.
# They pass VERBATIM (wikilink values stay raw; the frontend Infobox component
# parses them). A key not listed here cannot reach the site, so any future
# vault-side frontmatter field is private by default. Keys only pass for the
# page's own declared `kind:` (no kind, nothing passes): `date` on a non-event
# page, for example, is vault bookkeeping, not schema, and stays stripped.
# Kept in step with quartz/components/Infobox.tsx, scripts/check-infobox-fields.py,
# and the authoring reference (notes/article-templates.md in the campaign folder).
INFOBOX_KIND_FIELDS = {
    "person": ("born", "died", "house", "allegiance", "role", "pc"),
    "nation": ("capital", "ruler", "government", "founded"),
    "location": ("nation", "region"),
    "organization": ("seat", "leader", "founded"),
    "magic-system": ("practitioners", "source"),
    "being": ("nature", "domain", "fate"),
    "artifact": ("wielder", "origin"),
    "event": ("when", "outcome"),
    "ancestry": ("homeland", "standing"),
}

CALLOUT_START_RE = re.compile(r"^>\s*\[!(gm-only|gm-notes)\]", re.IGNORECASE)
HEADING_RE = re.compile(r"^#{1,6}\s")
FRONTMATTER_RE = re.compile(r"^---\n(.*?\n)---\n?", re.DOTALL)


def split_frontmatter(text):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


def extract_frontmatter_block(frontmatter_text, key):
    """Capture a top-level frontmatter key plus all its indented continuation
    lines (including YAML comments inside the block), verbatim."""
    lines = frontmatter_text.splitlines()
    for idx, line in enumerate(lines):
        if line.startswith(f"{key}:"):
            block = [line]
            j = idx + 1
            while j < len(lines) and (lines[j][:1] in (" ", "\t") or lines[j].strip() == ""):
                block.append(lines[j])
                j += 1
            while block and block[-1].strip() == "":
                block.pop()
            return "\n".join(block)
    return None


def extract_marker_block(frontmatter_text):
    return extract_frontmatter_block(frontmatter_text, "marker")


def extract_submap_block(frontmatter_text):
    """A page's embedded local map (`submap:` block: image, caption, local
    pins) is presentation data with no equivalent in the GM's source, same
    category as `marker:` map-pin coordinates. Carry it forward from the
    existing destination file so re-syncs never wipe it."""
    return extract_frontmatter_block(frontmatter_text, "submap")


def extract_image_block(frontmatter_text):
    """A page's portrait filename (`image:` key, value = a bare asset filename
    resolving to content/assets/) is presentation data with no equivalent in
    the GM's source, same category as `marker:` and `submap:`. Carry it forward
    from the existing destination file so re-syncing text content never wipes
    it. The frontend Infobox component renders it at the top of the card."""
    return extract_frontmatter_block(frontmatter_text, "image")


def extract_infobox_fields(frontmatter_text):
    """Pull the typed infobox lines out of the GM's source frontmatter,
    verbatim. Only `kind:` plus the fields belonging to that declared kind
    pass; a page without a valid `kind:` passes nothing. Indented
    continuation lines (block-style YAML lists) travel with their key,
    mirroring extract_marker_block()."""
    lines = frontmatter_text.splitlines()
    kind = None
    for line in lines:
        m = re.match(r"""^kind:\s*["']?([a-z-]+)["']?\s*$""", line)
        if m:
            kind = m.group(1)
            break
    if kind not in INFOBOX_KIND_FIELDS:
        return []
    allowed = ("kind",) + INFOBOX_KIND_FIELDS[kind]
    out = []
    i, n = 0, len(lines)
    while i < n:
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):", lines[i])
        if m and m.group(1) in allowed:
            block = [lines[i]]
            j = i + 1
            while j < n and (lines[j][:1] in (" ", "\t") or lines[j].strip() == ""):
                block.append(lines[j])
                j += 1
            while block and block[-1].strip() == "":
                block.pop()
            out.extend(block)
            i = j
            continue
        i += 1
    return out


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


IMAGE_EMBED_RE = re.compile(r"^!\[[^\]]*\]\([^)]+\)\s*$|^!\[\[[^\]|]+(\|[^\]]+)?\]\]\s*$")


def strip_leading_image(body):
    """Drop a standalone image embed if it's the first non-blank line of the
    Ontos body, and capture an italic caption line immediately following it.
    Returns (body_without_image_and_caption, caption_or_None).

    Portraits live in the GM's source page too (so Lucas's own vault renders
    them), but frontend art is managed separately here: the filename lives in
    the content-side `image:` frontmatter key (carried forward by
    extract_image_block) and the Infobox renders it, with the author's caption
    beneath it via the `image_caption:` key (this function's second return
    value, derived from the source each sync so Ontos stays authoritative for
    the caption text). Left in the body, the source embed would double up with
    the infobox portrait and the caption would render as loose article text
    instead of under the image. Only the leading image and its immediately
    following caption are touched; inline images elsewhere are untouched."""
    lines = body.splitlines()
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx >= len(lines) or not IMAGE_EMBED_RE.match(lines[idx]):
        return body, None
    drop = {idx}
    caption = None
    j = idx + 1
    while j < len(lines) and lines[j].strip() == "":
        j += 1
    if j < len(lines):
        cap = lines[j].strip()
        # A single-italic line (*...*): not bold (**...**), not a "* " bullet.
        if (
            len(cap) >= 2
            and cap.startswith("*")
            and cap.endswith("*")
            and not cap.startswith("**")
            and not cap.startswith("* ")
        ):
            caption = cap.strip("*").strip()
            drop.add(j)
    new_lines = [line for k, line in enumerate(lines) if k not in drop]
    return "\n".join(new_lines), caption


def render(
    title, marker_block, body, image_block=None, infobox_lines=None, submap_block=None,
    alias_slugs=None, image_caption=None,
):
    fm_lines = ["---", f"title: {title}"]
    if alias_slugs:
        fm_lines.append("aliases:")
        fm_lines.extend(f"  - {slug}" for slug in alias_slugs)
    if infobox_lines:
        fm_lines.extend(infobox_lines)
    if image_block:
        fm_lines.append(image_block)
        if image_caption:
            fm_lines.append(f'image_caption: "{image_caption.replace(chr(34), chr(92) + chr(34))}"')
    if marker_block:
        fm_lines.append(marker_block)
    if submap_block:
        fm_lines.append(submap_block)
    fm_lines.append("---")
    return "\n".join(fm_lines) + "\n\n" + body


def sync_page(src_name, dest_rel):
    src = ONTOS_SETTING / src_name
    text = src.read_text()
    src_fm, body = split_frontmatter(text)
    infobox_lines = extract_infobox_fields(src_fm)
    body = strip_callouts(body)
    body, image_caption = strip_leading_image(body)
    body = strip_meta_lines(body)
    body = drop_empty_headings(body)
    body = clean_blank_runs(body)

    dest = CONTENT_DIR / dest_rel
    marker_block = None
    submap_block = None
    image_block = None
    if dest.exists():
        existing_text = dest.read_text()
        existing_fm, _ = split_frontmatter(existing_text)
        marker_block = extract_marker_block(existing_fm)
        submap_block = extract_submap_block(existing_fm)
        image_block = extract_image_block(existing_fm)

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        render(
            TITLES[src_name], marker_block, body, image_block, infobox_lines, submap_block,
            alias_slugs=RENAMES.get(dest_rel), image_caption=image_caption,
        )
    )
    return dest


def main():
    written = []
    for src_name, dest_rel in PAGE_MAP.items():
        dest = sync_page(src_name, dest_rel)
        written.append(dest)

    print(f"Synced {len(written)} page(s) from Ontos:")
    for w in sorted(str(d.relative_to(CONTENT_DIR)) for d in written):
        print(f"  {w}")

    print(f"\nNot public (everything on the page is GM-only; kept out of PAGE_MAP):")
    for name in sorted(NOT_YET_PUBLIC):
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
