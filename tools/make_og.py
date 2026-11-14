#!/usr/bin/env python3
"""Render per-page social preview cards (1200x630 PNG) into src/static/og/<slug>.png.

    python3 tools/make_og.py            # every lesson, tool and guide without a hand-made card
    python3 tools/make_og.py what-is-rizz how-to-ask-someone-out

Uses the page's kicker, h1 and summary from its <!--meta --> header, the site's own fonts,
and headless Google Chrome (macOS path below, or set CHROME=/path/to/chrome). build.py picks
the files up automatically. Re-run after changing a page's h1 or summary, then commit the PNGs.
Pages with an explicit "og_image" in their meta (e.g. the challenge) are skipped.
"""
import html
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FONTS = (ROOT / "src" / "static" / "fonts").as_uri()
OUT = ROOT / "src" / "static" / "og"

# Optional extra line per page (plain text chips under the summary).
CHIPS = {
    "friend-zone-quiz": ["The Open Book", "The Slow Burn", "The Secret Admirer", "Deep Undercover"],
    "body-language-signs-of-interest": ["Green: lean in", "Amber: give space", "Red: stop"],
    "how-to-tell-a-story-on-a-date": ["Moment", "Stakes", "Turn", "Meaning"],
    "how-to-ask-someone-out": ["Callback", "Specific plan", "Easy out"],
}

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;src:url(FONTS/fraunces-latin.woff2);font-weight:500 700}
@font-face{font-family:Fraunces;src:url(FONTS/fraunces-italic-latin.woff2);font-weight:500 700;font-style:italic}
@font-face{font-family:Inter;src:url(FONTS/inter-latin.woff2);font-weight:400 600}
html,body{margin:0}
.c{width:1200px;height:630px;background:#fbf8f5;position:relative;overflow:hidden;font-family:Inter;color:#1e1a1d;box-sizing:border-box;padding:60px 80px 0 92px}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:#c63d57}
.logo{display:flex;align-items:center;gap:14px;font-family:Fraunces;font-weight:700;font-size:30px;color:#2a2230}
.m{width:50px;height:50px;border-radius:13px;background:#c63d57;color:#fff;display:grid;place-items:center;font-style:italic;font-size:25px}
.k{margin:40px 0 14px;font-weight:600;font-size:22px;letter-spacing:3px;color:#b3354e;text-transform:uppercase}
h1{font-family:Fraunces;font-weight:600;font-size:SIZEpx;line-height:1.06;letter-spacing:-1px;margin:0 0 22px;color:#2a2230;max-width:1010px}
h1 em{color:#c63d57}
p{font-size:27px;color:#675d63;margin:0;max-width:960px;line-height:1.4}
.chips{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
.chip{background:#fff;border:1.5px solid #ebe2db;border-radius:999px;padding:9px 18px;font-size:21px;font-weight:600;color:#2a2230}
.foot{position:absolute;left:92px;right:80px;bottom:46px;display:flex;justify-content:space-between;font-size:22px}
.url{font-weight:600;color:#b3354e}
.free{color:#675d63}
</style></head><body><div class="c"><div class="bar"></div>
<div class="logo"><div class="m">fl</div>Flirt Lessons</div>
<div class="k">KICKER</div>
<h1>H1</h1>
<p>SUMMARY</p>
CHIPS
<div class="foot"><span class="url">URL</span><span class="free">Free · No sign-up</span></div>
</div></body></html>"""


def card_html(p):
    h1 = p.get("h1", html.escape(p["title"]))
    size = 64 if len(build.plain(h1)) <= 48 else 56
    chips = CHIPS.get(p["slug"])
    chips_html = ('<div class="chips">' + "".join(f'<span class="chip">{html.escape(c)}</span>' for c in chips) + "</div>"
                  if chips else "")
    out = TEMPLATE
    for key, val in {"FONTS": FONTS, "SIZE": str(size), "KICKER": html.escape(p.get("kicker", "")),
                     "H1": h1, "SUMMARY": html.escape(p.get("summary", p["description"])),
                     "CHIPS": chips_html, "URL": "flirtlessons.com" + build.url_for(p["slug"]).rstrip("/")}.items():
        out = out.replace(key, val)
    return out


def render(slug, p, tmp):
    src = Path(tmp) / f"{slug}.html"
    src.write_text(card_html(p), encoding="utf-8")
    dest = OUT / f"{slug}.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={Path(tmp) / 'profile'}", "--window-size=1200,630",
                    "--virtual-time-budget=3000", f"--screenshot={dest}", src.as_uri()],
                   check=True, capture_output=True)
    print(f"wrote {dest.relative_to(ROOT)}")


def main():
    pages = build.load_pages()
    wanted = sys.argv[1:] or [s for s in build.SERIES if not pages[s].get("og_image")]
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for slug in wanted:
            if slug not in pages:
                sys.exit(f"unknown page {slug}")
            render(slug, pages[slug], tmp)


if __name__ == "__main__":
    main()
