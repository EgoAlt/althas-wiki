#!/usr/bin/env python3
"""
Scan content/*.md for Obsidian-style wikilinks ([[target]] or [[target|Display]])
pointing at a page that doesn't exist in content/. Quartz itself renders these
identically to working links (same class, no visual difference), so this is the
only way to know before a player finds one by clicking a dead end.

Never fails the build: this is a report, not a gate. Deciding what to do about
a broken link (delete the mention, repoint it, convert to plain text) needs
human judgment, not an automatic fix.
"""
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"
LINK_RE = re.compile(r"\[\[([^\]|#]+)")


def main():
    existing = {p.stem for p in CONTENT_DIR.glob("*.md")}
    broken = []
    for md_file in sorted(CONTENT_DIR.glob("*.md")):
        for lineno, line in enumerate(md_file.read_text().splitlines(), 1):
            for match in LINK_RE.finditer(line):
                target = match.group(1).strip()
                if target and target not in existing:
                    broken.append((md_file.name, lineno, target))

    if not broken:
        print("No broken wikilinks found.")
        return 0

    print(f"Found {len(broken)} broken wikilink(s):\n")
    for fname, lineno, target in broken:
        print(f"  {fname}:{lineno} -> [[{target}]]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
