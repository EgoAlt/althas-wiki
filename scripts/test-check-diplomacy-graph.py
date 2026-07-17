#!/usr/bin/env python3
"""Unit tests for check-diplomacy-graph.py. Run: python3 scripts/test-check-diplomacy-graph.py"""
import importlib.util
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "check_dg", Path(__file__).resolve().parent / "check-diplomacy-graph.py"
)
dg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dg)

PAGE = """Intro prose.

```diplomacy-graph
node a | Nation A | nation | locations/a
node b | Org B | institution | organizations/b
edge a -> b | governance | rules
```

> [!gm-only] GM layer
> ```diplomacy-graph
> node s | Secret S | people | -
> edge s <-> a | secret | hidden tie
> ```

```python
print("an unrelated fence that must not confuse extraction")
```
"""

def test_extract_blocks():
    pub, gm = dg.extract_blocks(PAGE)
    assert any(l.startswith("node a ") for l in pub)
    assert any(l.startswith("node s ") for l in gm)
    assert not any("unrelated" in l for l in pub + gm)

def test_parse_grammar():
    nodes, edges, errors = dg.parse_lines([
        "# comment", "",
        "node a | Nation A | nation | locations/a",
        "edge a -> a2 | rivalry | rivals",
        "edge a <-> a2 | alliance | pact",
        "garbage line",
        "node bad | Name | dragon | locations/x",
    ])
    assert nodes["a"] == ("Nation A", "nation", "locations/a")
    assert edges[0] == ("a", "a2", False, "rivalry", "rivals")
    assert edges[1][2] is True, "<-> parses as mutual"
    assert any("garbage" in e for e in errors)
    assert any("dragon" in e for e in errors), "unknown kind rejected"

def _tmp_content(*relpaths):
    d = Path(tempfile.mkdtemp())
    for rel in relpaths:
        p = d / (rel + ".md")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("x")
    return d

def test_validate():
    content = _tmp_content("locations/a", "organizations/b")
    pub_n = {"a": ("A", "nation", "locations/a"), "b": ("B", "institution", "organizations/b")}
    gm_n = {"s": ("S", "people", "-")}
    ok_pub_e = [("a", "b", False, "governance", "rules")]
    ok_gm_e = [("s", "a", True, "secret", "tie")]
    errors, warnings = dg.validate(pub_n, ok_pub_e, gm_n, ok_gm_e, content)
    assert errors == [] and warnings == []
    # public edge referencing a gm-only node is an error (leak by reference)
    errors, _ = dg.validate(pub_n, [("a", "s", False, "governance", "x")], gm_n, [], content)
    assert errors, "public edge must not reference a gm node"
    # gm edge referencing an undeclared slug is an error
    errors, _ = dg.validate(pub_n, [], gm_n, [("s", "ghost", False, "secret", "x")], content)
    assert errors
    # missing content page is an error; '-' path on a public node is an error
    errors, _ = dg.validate({"c": ("C", "nation", "locations/missing")}, [], {}, [], content)
    assert errors
    errors, _ = dg.validate({"c": ("C", "nation", "-")}, [], {}, [], content)
    assert errors
    # duplicate slug across blocks is an error
    errors, _ = dg.validate(pub_n, [], {"a": ("A2", "people", "-")}, [], content)
    assert errors
    # unknown type in the PUBLIC block warns, does not error
    errors, warnings = dg.validate(pub_n, [("a", "b", False, "friendship", "pals")], gm_n, [], content)
    assert errors == [] and warnings

def test_validate_accepts_folder_index_pages():
    """A node path pointing at a Quartz folder-index page (content/{path}/index.md,
    not content/{path}.md) must resolve. Several real site pages (e.g. every
    nation under content/locations/) are nested this way - the same convention
    check-broken-links.py's existing_targets() already accounts for."""
    d = Path(tempfile.mkdtemp())
    (d / "locations" / "voldaen").mkdir(parents=True)
    (d / "locations" / "voldaen" / "index.md").write_text("x")
    pub_n = {"v": ("Voldaen", "nation", "locations/voldaen")}
    errors, warnings = dg.validate(pub_n, [], {}, [], d)
    assert errors == [] and warnings == [], "folder-index page must resolve"

if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  PASS {name}")
    print("All check-diplomacy-graph tests passed.")
