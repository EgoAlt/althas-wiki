#!/usr/bin/env python3
"""
Guard for the typed-infobox pilot: every frontmatter key that reaches
content/ must fit the public-fields contract.

sync-from-ontos.py whitelists the typed schema keys (kind + that kind's
fields) through to the published site, next to `title:` and the carried
`marker:` map-pin block. This gate re-checks the result mechanically, so a
bad hand edit, a schema drift between the scripts, or a future sync bug
can't quietly publish frontmatter that shouldn't be there.

What it flags, per file in content/:
  - an off-whitelist top-level key: anything that isn't `title`, `marker`,
    `submap`, `kind`, or a schema field (leakage: the contract says such a
    key cannot reach the site).
  - a `kind:` value that isn't one of the eight known kinds.
  - a schema field on a page with no `kind:` at all.
  - a schema field that doesn't belong to the page's declared kind
    (e.g. `capital:` on a person page).

Read-only: reports and exits nonzero if anything is flagged, so the publish
step can stop. Never modifies content/.
Run from the repo root: python3 scripts/check-infobox-fields.py

The schema is kept in step with scripts/sync-from-ontos.py
(INFOBOX_KIND_FIELDS), quartz/components/Infobox.tsx, and the authoring
reference (notes/article-templates.md in the Ontos campaign folder).
"""
import re
import sys
from pathlib import Path

CONTENT = Path(__file__).resolve().parent.parent / "content"

KIND_FIELDS = {
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
ALL_FIELDS = {f for fields in KIND_FIELDS.values() for f in fields}

# Non-schema keys the sync legitimately writes: the display title plus the
# frontend-only map-pin block and local-map `submap:` block (whose sub-keys
# are indented, so the top-level key scan below never sees them).
NON_SCHEMA_KEYS = {"title", "marker", "submap"}

FRONTMATTER_RE = re.compile(r"^---\n(.*?\n)---\n?", re.DOTALL)
TOP_KEY_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):")
KIND_VALUE_RE = re.compile(r"""^kind:\s*["']?([^"'\n]+?)["']?\s*$""")


def top_level_keys(fm_text):
    keys = []
    kind = None
    for line in fm_text.splitlines():
        m = TOP_KEY_RE.match(line)
        if not m:
            continue
        keys.append(m.group(1))
        if m.group(1) == "kind":
            vm = KIND_VALUE_RE.match(line)
            kind = vm.group(1).strip() if vm else ""
    return keys, kind


def main():
    flags = []
    for md in sorted(CONTENT.rglob("*.md")):
        if ".obsidian" in md.parts:
            continue
        m = FRONTMATTER_RE.match(md.read_text())
        if not m:
            continue  # no frontmatter, nothing to leak
        keys, kind = top_level_keys(m.group(1))
        rel = md.relative_to(CONTENT)

        for key in keys:
            if key in NON_SCHEMA_KEYS or key == "kind" or key in ALL_FIELDS:
                continue
            flags.append((rel, f"off-whitelist key `{key}:` (not part of the public-fields contract)"))

        if "kind" in keys and kind not in KIND_FIELDS:
            flags.append((rel, f"unknown kind `{kind}` (known: {', '.join(sorted(KIND_FIELDS))})"))
            kind = None  # field-membership checks below can't apply

        schema_keys = [k for k in keys if k in ALL_FIELDS]
        if schema_keys and "kind" not in keys:
            flags.append((rel, f"schema field(s) {', '.join(schema_keys)} present but no `kind:`"))
        elif kind in KIND_FIELDS:
            for key in schema_keys:
                if key not in KIND_FIELDS[kind]:
                    flags.append((rel, f"`{key}:` is not a `{kind}` field (allowed: {', '.join(KIND_FIELDS[kind])})"))

    if flags:
        print(f"Found {len(flags)} infobox-field issue(s):\n")
        for rel, msg in flags:
            print(f"  {rel} -> {msg}")
        return 1
    print("No infobox-field issues found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
