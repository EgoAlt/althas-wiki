import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "quartz/components/scripts/sealcarver/sigils.gen.ts"


def run_generator():
    subprocess.run([sys.executable, str(ROOT / "scripts/generate-sigil-module.py")], check=True)
    return OUT.read_text()


def test_generates_all_manifest_sigils():
    text = run_generator()
    manifest = json.loads((ROOT / "sigils/manifest.json").read_text())
    for s in manifest["sigils"]:
        assert f'"{s["category"]}/{s["id"]}"' in text, f'missing {s["id"]}'


def test_bodies_are_self_contained_and_theme_aware():
    text = run_generator()
    assert "<?xml" not in text and "DOCTYPE" not in text
    assert "stroke:black" not in text  # rewritten to currentColor
    assert "currentColor" in text
    assert "<image" not in text and "xlink:href" not in text


def test_header_marks_generated():
    assert "AUTO-GENERATED" in run_generator().splitlines()[0]
