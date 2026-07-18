#!/usr/bin/env python3
"""
Unit tests for the Chronicle's sync behavior: (1) a date heading whose only
content was [!gm-only] is dropped entirely after the strip (no metadata leak:
the public page must not reveal that a secret day exists), and (2) the
current-date frontmatter passthrough from the Ontos source. Pure-function
tests on fixtures. Run: python3 scripts/test-chronicle-sync.py
"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "sync_from_ontos", Path(__file__).resolve().parent / "sync-from-ontos.py"
)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

SECRET_DAY = """Intro prose.

## Day 4 of the First Month, 363 VR

Public event that stays.

## Day 9 of the First Month, 363 VR

> [!gm-only]
> A fully secret event.

## Day 12 of the First Month, 363 VR

Another public event.
"""

def test_secret_day_leaves_no_trace():
    body = sync.strip_callouts(SECRET_DAY)
    body = sync.drop_empty_headings(body)
    assert "Day 9" not in body, "secret-only day heading must be dropped"
    assert "Day 4 of the First Month" in body
    assert "Day 12 of the First Month" in body
    assert "fully secret" not in body

MIXED_DAY = """## Day 2 of the Second Month, 363 VR

Public part.

> [!gm-only]
> Secret part.
"""

def test_mixed_day_keeps_heading_and_public_part():
    body = sync.strip_callouts(MIXED_DAY)
    body = sync.drop_empty_headings(body)
    assert "Day 2 of the Second Month" in body
    assert "Public part." in body
    assert "Secret part." not in body

FM_WITH_DATE = 'type: reference\ncurrent-date: "363-01-01"\ntags: [x]'
FM_WITHOUT = "type: reference\ntags: [x]"

def test_current_date_extraction():
    assert sync.extract_current_date(FM_WITH_DATE) == "363-01-01"
    assert sync.extract_current_date(FM_WITHOUT) is None

def test_render_emits_current_date():
    out = sync.render("Chronicle", None, "body\n", current_date="363-01-01")
    fm = out.split("---")[1]
    assert 'current-date: "363-01-01"' in fm

def test_render_omits_current_date_when_absent():
    out = sync.render("Althas", None, "body\n")
    assert "current-date" not in out

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All chronicle-sync tests passed.")
