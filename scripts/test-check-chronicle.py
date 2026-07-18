#!/usr/bin/env python3
"""Unit tests for check-chronicle.py's validators.
Run: python3 scripts/test-check-chronicle.py"""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "check_chronicle", Path(__file__).resolve().parent / "check-chronicle.py"
)
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

def test_valid_headings():
    assert cc.check_headings("## Day 1 of the First Month, 363 VR\n") == []
    assert cc.check_headings("## Day 33 of the Tenth Month, 400 VR\n") == []
    assert cc.check_headings("## Day 3 of the Closing Holidays, 363 VR\n") == []
    assert cc.check_headings("## The Keeping of This Chronicle\n") == [], \
        "non-date h2s are allowed and ignored"

def test_invalid_headings():
    assert cc.check_headings("## Day 34 of the First Month, 363 VR\n"), "day > 33"
    assert cc.check_headings("## Day 4 of the Closing Holidays, 363 VR\n"), "holiday day > 3"
    assert cc.check_headings("## Day 5 of the Eleventh Month, 363 VR\n"), "bad ordinal"
    assert cc.check_headings("## Day 05 of the First Month, 363 VR\n"), "zero-padded day in prose heading"
    assert cc.check_headings("## day 5 of the first month, 363 VR\n"), "casing"
    assert cc.check_headings("## Day 5, First Month, 363 VR\n"), "wrong shape"

def test_current_date():
    assert cc.check_current_date('current-date: "363-01-01"') == []
    assert cc.check_current_date('current-date: "363-H-02"') == []
    assert cc.check_current_date('current-date: "363-01-34"'), "day out of range"
    assert cc.check_current_date('current-date: "363-H-04"'), "holiday out of range"
    assert cc.check_current_date('current-date: "363-11-01"'), "month out of range"
    assert cc.check_current_date('current-date: "363-1-1"'), "not zero-padded"
    assert cc.check_current_date('type: reference'), "missing entirely"

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All check-chronicle tests passed.")
