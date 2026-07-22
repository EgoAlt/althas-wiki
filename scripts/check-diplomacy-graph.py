#!/usr/bin/env python3
"""
Publish gate for the Diplomacy force graph (the campaign's
specs/althas-diplomacy-force-graph-design.md in Ontos): validates the
diplomacy-graph blocks in the ONTOS SOURCE page. Reports only, exits 1 on any
error, no --fix. The grammar here must stay equivalent to the parser in
quartz/components/scripts/diplomacy-graph.inline.ts.
"""
import importlib.util
import re
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
_sync = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sync)

KINDS = {"nation", "institution", "people"}
KNOWN_TYPES = {"governance", "war-history", "alliance", "rivalry", "uneasy"}
NODE_RE = re.compile(r"^node\s+([a-z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([a-z-]+)\s*\|\s*(\S+)\s*$")
EDGE_RE = re.compile(r"^edge\s+([a-z0-9-]+)\s*(->|<->)\s*([a-z0-9-]+)\s*\|\s*([a-z-]+)\s*\|\s*(.+?)\s*$")

def _unquote(line):
    s = line.strip()
    while s.startswith(">"):
        s = s[1:].lstrip()
    return s

def extract_blocks(text):
    """Returns (public_lines, gm_lines). The gm block is the one whose opening
    fence line was blockquoted (inside the [!gm-only] callout)."""
    public, gm = [], []
    current = None
    in_other_fence = False
    for raw in text.splitlines():
        line = _unquote(raw)
        if line.startswith("```"):
            lang = line[3:].strip()
            if current is not None:
                current = None
            elif in_other_fence:
                in_other_fence = False
            elif lang == "diplomacy-graph":
                current = gm if raw.lstrip().startswith(">") else public
            else:
                in_other_fence = True
            continue
        if current is not None:
            current.append(line)
    return public, gm

def parse_lines(lines):
    nodes, edges, errors = {}, [], []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("node "):
            m = NODE_RE.match(line)
            if not m:
                errors.append(f"bad node line: {line!r}")
                continue
            slug, name, kind, path = m.group(1), m.group(2), m.group(3), m.group(4)
            if kind not in KINDS:
                errors.append(f"unknown kind {kind!r} in: {line!r}")
                continue
            if slug in nodes:
                errors.append(f"duplicate node slug in same block: {slug}")
                continue
            nodes[slug] = (name, kind, path)
        elif line.startswith("edge "):
            m = EDGE_RE.match(line)
            if not m:
                errors.append(f"bad edge line: {line!r}")
                continue
            edges.append((m.group(1), m.group(3), m.group(2) == "<->", m.group(4), m.group(5)))
        else:
            errors.append(f"unrecognized line: {line!r}")
    return nodes, edges, errors

DIPLOMACY_RE = re.compile(r"^diplomacy:\s*(public|gm)\s*$", re.M)

def read_diplomacy_flags(ontos_setting):
    """{slug: "public"|"gm"} for every setting page carrying a diplomacy: flag.
    Slug is the filename stem, matching the node-slug convention."""
    flags = {}
    for md in sorted(ontos_setting.glob("*.md")):
        fm, _ = _sync.split_frontmatter(md.read_text())
        m = DIPLOMACY_RE.search(fm or "")
        if m:
            flags[md.stem] = m.group(1)
    return flags

def check_drift(pub_nodes, gm_nodes, flags, existing_pages):
    """Bidirectional drift between the diplomacy: flags and the graph blocks.
    Hard errors (any return value is a publish blocker):
      - a flagged page with no matching node (or in the wrong block)
      - a node whose backing page is unflagged or flagged for the other block
    A node whose slug has no setting/{slug}.md is a page-less abstraction
    (gm-only, e.g. reborn-inquisition) and is exempt from the flag check."""
    errors = []
    for slug, vis in sorted(flags.items()):
        here, there = (pub_nodes, gm_nodes) if vis == "public" else (gm_nodes, pub_nodes)
        wrong = "gm" if vis == "public" else "public"
        if slug in here:
            continue
        if slug in there:
            errors.append(f"page '{slug}' is flagged diplomacy: {vis} but its node is in the {wrong} block")
        else:
            errors.append(f"page '{slug}' is flagged diplomacy: {vis} but has no node in the {vis} block")
    for slug in sorted(pub_nodes):
        if slug not in existing_pages:
            continue
        if flags.get(slug) == "gm":
            errors.append(f"RULE 29 SPOILER RISK: node '{slug}' is in the PUBLIC block but its page is flagged diplomacy: gm")
        elif flags.get(slug) != "public":
            errors.append(f"node '{slug}' is in the public block but its page is not flagged diplomacy: public")
    for slug in sorted(gm_nodes):
        if slug not in existing_pages:
            continue
        if flags.get(slug) == "public":
            errors.append(f"node '{slug}' is in the gm block but its page is flagged diplomacy: public")
        elif flags.get(slug) != "gm":
            errors.append(f"node '{slug}' is in the gm block but its page is not flagged diplomacy: gm")
    return errors

def _selfcheck():
    pub = {"voldaen": ("Voldaen", "nation", "locations/voldaen")}
    gm = {"kingslayer": ("The Kingslayer", "people", "-"),
          "reborn-inquisition": ("Reborn Inquisition", "institution", "-")}
    existing = {"voldaen", "kingslayer", "lael"}  # reborn-inquisition has no page
    # clean: flags match, page-less gm node exempt
    assert check_drift(pub, gm, {"voldaen": "public", "kingslayer": "gm"}, existing) == []
    # flagged but absent
    assert any("no node" in e for e in check_drift(pub, gm, {"voldaen": "public", "lael": "public"}, existing))
    # present but unflagged
    assert any("not flagged" in e for e in check_drift(pub, gm, {"kingslayer": "gm"}, existing))
    # gm page shown in the public block
    assert any("RULE 29" in e for e in check_drift(pub, gm, {"voldaen": "gm", "kingslayer": "gm"}, existing))

def validate(pub_nodes, pub_edges, gm_nodes, gm_edges, content_dir):
    errors, warnings = [], []
    for slug in gm_nodes:
        if slug in pub_nodes:
            errors.append(f"gm block redeclares public slug: {slug}")
    union = {**pub_nodes, **gm_nodes}
    for slug, (name, kind, path) in pub_nodes.items():
        if path == "-":
            errors.append(f"public node {slug} has no page path")
            continue
        # A path may resolve either as a flat file (content/{path}.md) or as
        # a Quartz folder-index page (content/{path}/index.md) - the same
        # folder-index convention check-broken-links.py's existing_targets()
        # already accounts for; several real site pages (e.g. every nation
        # under content/locations/) are nested this way.
        flat = Path(content_dir) / f"{path}.md"
        folder_index = Path(content_dir) / path / "index.md"
        if not (flat.exists() or folder_index.exists()):
            errors.append(f"node {slug} path does not resolve: content/{path}.md")
    for slug, (name, kind, path) in gm_nodes.items():
        if path != "-":
            errors.append(f"gm node {slug} must use '-' as path (secret pages have no content/ page)")
    for src, dst, mutual, etype, label in pub_edges:
        for end in (src, dst):
            if end not in pub_nodes:
                errors.append(f"public edge references non-public node: {end}")
        if etype not in KNOWN_TYPES:
            warnings.append(f"unknown public edge type {etype!r} (renders gray): {src} -> {dst}")
    for src, dst, mutual, etype, label in gm_edges:
        for end in (src, dst):
            if end not in union:
                errors.append(f"gm edge references undeclared node: {end}")
    return errors, warnings

def main():
    if "--selfcheck" in sys.argv:
        _selfcheck()
        print("check-diplomacy-graph: self-check passed")
        return 0
    src = _sync.ONTOS_SETTING / "diplomacy.md"
    text = src.read_text()
    pub_lines, gm_lines = extract_blocks(text)
    if not pub_lines:
        print("check-diplomacy-graph: no public diplomacy-graph block found")
        return 1
    pub_nodes, pub_edges, e1 = parse_lines(pub_lines)
    gm_nodes, gm_edges, e2 = parse_lines(gm_lines)
    errors, warnings = validate(pub_nodes, pub_edges, gm_nodes, gm_edges, _sync.CONTENT_DIR)
    flags = read_diplomacy_flags(_sync.ONTOS_SETTING)
    existing_pages = {md.stem for md in _sync.ONTOS_SETTING.glob("*.md")}
    drift = check_drift(pub_nodes, gm_nodes, flags, existing_pages)
    errors = e1 + e2 + errors + drift
    for w in warnings:
        print(f"  WARN: {w}")
    if errors:
        print(f"check-diplomacy-graph: {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"check-diplomacy-graph: OK ({len(pub_nodes)} public nodes, {len(pub_edges)} public edges, gm delta {len(gm_nodes)}/{len(gm_edges)})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
