#!/usr/bin/env python3
"""
Unit tests for sync-from-ontos.py's presentation-data carry-forward: the
`marker:` map-pin block and the `submap:` local-map block must survive a
re-sync verbatim (including YAML comment lines inside the block), because
both exist only in content/ and would otherwise be wiped every time the
page is regenerated from the GM's source.

Pure-function tests on fixtures; never reads the Ontos vault and never
touches content/. Run from the repo root:
    python3 scripts/test-sync-carry-forward.py
"""
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

MARKER_BLOCK = """marker:
    - coordinates: "900, 1750"
      icon: lucide-building-2
      colour: "#c98a4b"
      category: settlement"""

SUBMAP_BLOCK = """submap:
    # Placeholder art: local pin coordinates are in this image's own pixel
    # space and will NOT survive the art swap.
    image: assets/map-placeholder.png
    caption: Annoying dog stole the map
    minZoom: 0
    maxZoom: 2
    defaultZoom: 1
    zoomDelta: 0.5
    markers:
        - name: You are here
          coordinates: "155, 180"
          icon: lucide-paw-print"""

# What a destination file looks like after a previous sync: title + typed
# infobox fields from the source, marker/submap blocks hand-maintained here.
EXISTING_DEST = f"""---
title: Drinmery
kind: location
nation: "[[jesthaen|Jesthaen]]"
{MARKER_BLOCK}
{SUBMAP_BLOCK}
---

Old body text about Drinmery.
"""


def test_extracts_marker_block():
    fm, _ = sync.split_frontmatter(EXISTING_DEST)
    assert sync.extract_marker_block(fm) == MARKER_BLOCK, "marker block not extracted verbatim"


def test_extracts_submap_block():
    fm, _ = sync.split_frontmatter(EXISTING_DEST)
    assert sync.extract_submap_block(fm) == SUBMAP_BLOCK, "submap block not extracted verbatim"


def test_missing_blocks_return_none():
    fm, _ = sync.split_frontmatter("---\ntitle: Bare\nkind: location\n---\n\nBody.\n")
    assert sync.extract_marker_block(fm) is None
    assert sync.extract_submap_block(fm) is None


def test_submap_key_does_not_match_marker_extractor():
    fm, _ = sync.split_frontmatter(f"---\ntitle: X\n{SUBMAP_BLOCK}\n---\n\nBody.\n")
    assert sync.extract_marker_block(fm) is None
    assert sync.extract_submap_block(fm) == SUBMAP_BLOCK


def test_resync_round_trip_preserves_both_blocks():
    """Simulate sync_page's carry-forward: extract from the existing dest,
    render a fresh page around a new body, and confirm a second extraction
    still yields the identical blocks (so N re-syncs are lossless)."""
    fm, _ = sync.split_frontmatter(EXISTING_DEST)
    marker = sync.extract_marker_block(fm)
    submap = sync.extract_submap_block(fm)
    rendered = sync.render(
        "Drinmery",
        marker,
        "New body text from a re-sync.",
        infobox_lines=["kind: location", 'nation: "[[jesthaen|Jesthaen]]"'],
        submap_block=submap,
    )
    fm2, body2 = sync.split_frontmatter(rendered)
    assert sync.extract_marker_block(fm2) == MARKER_BLOCK, "marker block lost on re-sync"
    assert sync.extract_submap_block(fm2) == SUBMAP_BLOCK, "submap block lost on re-sync"
    assert "New body text from a re-sync." in body2


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"  PASS {t.__name__}")
    print(f"{len(tests)} test(s) passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
