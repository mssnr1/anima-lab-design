"""Writes tokens/tokens.json from tokens/tokens.css and tokens/apps/*.css (for native apps). Run: python3 scripts/tokens-json.py"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent


def colours(css: str, start: str) -> dict:
    i = css.index(start)
    return dict(re.findall(r"--color-([a-z0-9-]+):\s*([^;]+);", css[i : css.index("}", i)]))


t = (root / "tokens/tokens.css").read_text()
text = dict(re.findall(r"--text-([a-z]+):\s*([^;]+);", t))
apps = {}
for f in sorted((root / "tokens/apps").glob("*.css")):
    s = f.read_text()
    apps[f.stem] = {"day": colours(s, "\n@theme {"), "night": colours(s, "\n:root.dark {")}
    if "PROPOSAL" in s:
        apps[f.stem]["status"] = "proposal"
out = {
    "$comment": "Generated from tokens/*.css by scripts/tokens-json.py, for native apps (e.g. the SwiftUI watch app). Edit the CSS, not this file.",
    "color": {"day": colours(t, "\n@theme {"), "night": colours(t, "\n:root.dark {")},
    "text": {k: {"rem": v, "px": round(float(v.rstrip("rem")) * 16)} for k, v in text.items()},
    "font": {"sans": "Figtree", "display": {"weight": 300, "letterSpacingEm": -0.015, "lineHeight": 1.08}},
    "radius": {"control": "full", "tile": 18, "card": 22, "sheet": 28},
    "rhythm": {"inhaleMs": 5500, "exhaleMs": 5500, "curve": "smootherstep"},
    "apps": apps,
}
(root / "tokens/tokens.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
