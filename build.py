#!/usr/bin/env python3
"""Build the Flirt Lessons static site: src/ -> site/.

    python3 build.py

Edit pages in src/pages/*.html, shared chrome in src/layout.html and assets in
src/static/. site/ is generated output and is wiped on every build, so never
edit it by hand. Each page starts with a JSON header:

    <!--meta { "title": "...", "description": "...", ... } -->

The build adds per-page SEO tags, JSON-LD (Article / BreadcrumbList / FAQPage),
breadcrumbs, previous/next navigation, sitemap.xml and cache-busting, and fails
on broken internal links. Standard library only.
"""
import datetime
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "site"
BASE = "https://flirtlessons.com"
BRAND = "Flirt Lessons"
OG_IMAGE = BASE + "/og-image.png"
OG_ALT = "Flirt Lessons — how to flirt with confidence and respect"
MARKER = ".generated"

# First-party, cookieless event beacon (see docs/measurement.md). Off until the owner
# approves it AND the privacy policy is updated; while off, track() is a no-op.
ANALYTICS_ENABLED = False

# Reading order. Drives home-page cards, previous/next links and "keep learning".
LESSONS = [
    "what-is-flirting",
    "how-to-start-a-conversation",
    "body-language-signs-of-interest",
    "how-to-be-more-attractive",
    "how-to-tell-a-story-on-a-date",
]
TOOLS = [
    "rizz-test",
    "friend-zone-quiz",
    "how-to-text-someone-you-like",
    "attractive-habits",
    "fun-date-games",
]
SERIES = LESSONS + TOOLS

NAV = [
    ("Lessons", "/#lessons", None),
    ("Rizz test", "/rizz-test/", "rizz-test"),
    ("Self-check", "/friend-zone-quiz/", "friend-zone-quiz"),
    ("Texting", "/how-to-text-someone-you-like/", "how-to-text-someone-you-like"),
    ("FAQ", "/#faq", None),
]


def esc(s):
    return html.escape(s, quote=True)


def plain(fragment):
    """HTML fragment -> plain text (for schema and word counts)."""
    text = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def url_for(slug):
    if slug == "index":
        return "/"
    if slug == "404":
        return "/404.html"
    return f"/{slug}/"


def out_path(slug):
    if slug == "index":
        return OUT / "index.html"
    if slug == "404":
        return OUT / "404.html"
    return OUT / slug / "index.html"


def load_pages():
    pages = {}
    for path in sorted((SRC / "pages").glob("*.html")):
        text = path.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", text, re.S)
        if not m:
            sys.exit(f"{path.name}: missing <!--meta {{...}} --> header")
        try:
            meta = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            sys.exit(f"{path.name}: bad meta JSON: {e}")
        meta["slug"] = path.stem
        meta["body"] = text[m.end():]
        for key in ("title", "description"):
            if key not in meta:
                sys.exit(f"{path.name}: meta needs '{key}'")
        pages[path.stem] = meta
    missing = [s for s in SERIES if s not in pages]
    if missing:
        sys.exit(f"pages listed in SERIES but missing from src/pages: {missing}")
    return pages


def og_image(p):
    return BASE + p["og_image"] if p.get("og_image") else OG_IMAGE


def faq_items(body):
    """FAQ entries are <details><summary>Q</summary><p>A</p></details> (no attributes)."""
    return [(plain(q), plain(a)) for q, a in
            re.findall(r"<details><summary>(.*?)</summary>\s*<p>(.*?)</p>\s*</details>", body, re.S)]


def kicker(p):
    return p.get("kicker", "")


def card(p, cta):
    return (f'<a class="card" href="{url_for(p["slug"])}">'
            f'<span class="card-kicker">{esc(kicker(p))}</span>'
            f'<span class="card-title">{esc(p["label"])}</span>'
            f'<span class="card-sum">{esc(p["summary"])}</span>'
            f'<span class="card-cta">{cta} <span aria-hidden="true">→</span></span></a>')


def cta_for(p):
    return "Read the lesson" if p["slug"] in LESSONS else "Open the tool"


def nav_links(current):
    rows = []
    for label, href, slug in NAV:
        cur = ' aria-current="page"' if slug and slug == current else ""
        rows.append(f'      <a href="{href}"{cur}>{label}</a>')
    return "\n".join(rows)


def jsonld(p, today):
    if p.get("noindex"):
        return ""
    url = BASE + url_for(p["slug"])
    graph = []
    if p["slug"] == "index":
        graph += [
            {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": BRAND,
             "inLanguage": "en", "publisher": {"@id": BASE + "/#org"}},
            {"@type": "Organization", "@id": BASE + "/#org", "name": BRAND, "url": BASE + "/",
             "logo": BASE + "/apple-touch-icon.png", "email": "hello@flirtlessons.com"},
            {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": p["title"],
             "description": p["description"], "isPartOf": {"@id": BASE + "/#website"},
             "primaryImageOfPage": OG_IMAGE, "dateModified": p.get("updated", today)},
        ]
    elif p.get("type") == "article":
        graph += [
            {"@type": "Article", "@id": url + "#article", "headline": plain(p.get("h1", p["title"]))[:110],
             "description": p["description"], "image": og_image(p), "inLanguage": "en",
             "datePublished": p.get("published", today), "dateModified": p.get("updated", today),
             "author": {"@type": "Organization", "name": BRAND, "url": BASE + "/"},
             "publisher": {"@type": "Organization", "name": BRAND,
                           "logo": {"@type": "ImageObject", "url": BASE + "/apple-touch-icon.png"}},
             "mainEntityOfPage": url, "isPartOf": {"@id": BASE + "/#website"}},
        ]
    if p["slug"] != "index":
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": p.get("label", p["title"]), "item": url},
        ]})
    faqs = faq_items(p["body"])
    if faqs:
        graph.append({"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faqs]})
    if not graph:
        return ""
    data = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)
    return '<script type="application/ld+json">\n' + data.replace("</", "<\\/") + "\n</script>"


def article_wrap(p, pages, today):
    words = len(plain(p["body"]).split())
    minutes = max(2, round(words / 220))
    updated = datetime.date.fromisoformat(p.get("updated", today)).strftime("%-d %B %Y")
    section, section_href = ("Lessons", "/#lessons") if p["slug"] in LESSONS else ("Tools", "/#tools")
    crumbs = (f'<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> '
              f'<a href="{section_href}">{section}</a> <span aria-hidden="true">›</span> '
              f'<span aria-current="page">{esc(p["label"])}</span></nav>')
    head = (f'<header class="article-head">{crumbs}'
            f'<p class="eyebrow">{esc(kicker(p))}</p>'
            f'<h1 id="page-title">{p["h1"]}</h1>'
            f'<p class="lede">{p["lede"]}</p>'
            f'<p class="meta">{minutes} min read · Updated {updated}</p></header>')
    i = SERIES.index(p["slug"])
    prev_p = pages[SERIES[i - 1]] if i > 0 else None
    next_p = pages[SERIES[i + 1]] if i + 1 < len(SERIES) else None
    pager = '<nav class="pager" aria-label="Previous and next">'
    pager += (f'<a class="prev" href="{url_for(prev_p["slug"])}"><span>← Previous</span>{esc(prev_p["label"])}</a>'
              if prev_p else '<span></span>')
    pager += (f'<a class="next" href="{url_for(next_p["slug"])}"><span>Next →</span>{esc(next_p["label"])}</a>'
              if next_p else '<a class="next" href="/"><span>Finished →</span>Back to all lessons</a>')
    pager += "</nav>"
    related = p.get("related") or [s for s in (SERIES[i + 1:] + SERIES[:i]) if s != p["slug"]][:3]
    cards = "".join(card(pages[s], cta_for(pages[s])) for s in related)
    return (f'<article class="article" aria-labelledby="page-title"><div class="wrap article-wrap">{head}'
            f'<div class="prose">\n{p["body"]}\n</div>{pager}</div></article>'
            f'<section class="more" aria-labelledby="more-title"><div class="wrap">'
            f'<h2 id="more-title">Keep learning</h2><div class="card-grid">{cards}</div></div></section>')


def build():
    if OUT.exists():
        if not (OUT / MARKER).exists() and "--force" not in sys.argv:
            sys.exit(f"{OUT} has no {MARKER} marker, so it may contain hand-made files. "
                     f"Move anything you need, then run: python3 build.py --force")
        shutil.rmtree(OUT)
    shutil.copytree(SRC / "static", OUT, ignore=shutil.ignore_patterns(".DS_Store"))
    (OUT / MARKER).write_text("Generated by build.py from src/. Do not edit; changes are overwritten.\n")

    today = datetime.date.today().isoformat()
    def ver(name):
        return hashlib.sha256((OUT / name).read_bytes()).hexdigest()[:8]
    css_v, js_v = ver("styles.css"), ver("main.js")
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    pages = load_pages()

    for slug, p in pages.items():
        body = p["body"]
        body = body.replace("{{lesson_cards}}", "".join(card(pages[s], cta_for(pages[s])) for s in LESSONS))
        body = body.replace("{{tool_cards}}", "".join(card(pages[s], cta_for(pages[s])) for s in TOOLS))
        p["body"] = body
        content = article_wrap(p, pages, today) if slug in SERIES else body
        title = p["title"]
        title_tag = title if (BRAND in title or len(title) + len(BRAND) + 3 > 60) else f"{title} | {BRAND}"
        page_html = layout
        for key, val in {
            "title_tag": esc(title_tag),
            "description": esc(p["description"]),
            "canonical": "" if p.get("noindex") else f'<link rel="canonical" href="{BASE + url_for(slug)}">\n',
            "url": BASE + url_for(slug),
            "robots": "noindex" if p.get("noindex") else "index, follow, max-image-preview:large",
            "og_type": "article" if p.get("type") == "article" else "website",
            "og_title": esc(p.get("og_title", title)),
            "css_v": css_v,
            "js_v": js_v,
            "jsonld": jsonld(p, today),
            "og_image": og_image(p),
            "og_image_alt": esc(p.get("og_image_alt", OG_ALT)),
            "analytics": "on" if ANALYTICS_ENABLED else "off",
            "page_scripts": "".join(f'<script src="/{n}?v={ver(n)}" defer></script>\n' for n in p.get("scripts", [])),
            "nav_links": nav_links(slug),
            "content": content,
        }.items():
            page_html = page_html.replace("{{" + key + "}}", val)
        leftover = re.findall(r"\{\{\w+\}\}", page_html)
        if leftover:
            sys.exit(f"{slug}: unreplaced placeholders {leftover}")
        dest = out_path(slug)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page_html, encoding="utf-8")

    # sitemap.xml
    urls = [s for s, p in pages.items() if not p.get("noindex")]
    urls.sort(key=lambda s: (s != "index", SERIES.index(s) if s in SERIES else 99, s))
    rows = "".join(f"  <url>\n    <loc>{BASE}{url_for(s)}</loc>\n    <lastmod>{pages[s].get('updated', today)}</lastmod>\n  </url>\n"
                   for s in urls)
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                     f"{rows}</urlset>\n", encoding="utf-8")

    check_links(pages)
    print(f"Built {len(pages)} pages into {OUT.relative_to(ROOT)}/ (css v={css_v}, js v={js_v})")


def check_links(pages):
    """Every internal href/src must resolve to a built file, and #fragments to an id on that page."""
    ids = {}
    for f in OUT.rglob("*.html"):
        ids[f] = set(re.findall(r'\sid="([^"]+)"', f.read_text(encoding="utf-8")))
    errors = []
    for f in OUT.rglob("*.html"):
        for ref in re.findall(r'(?:href|src)="(/[^"]*)"', f.read_text(encoding="utf-8")):
            path, _, frag = ref.partition("#")
            path = path.split("?")[0]
            target = OUT / path.lstrip("/")
            if path.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                errors.append(f"{f.relative_to(OUT)} -> {ref} (missing file)")
            elif frag and target.suffix == ".html" and frag not in ids.get(target, set()):
                errors.append(f"{f.relative_to(OUT)} -> {ref} (no id '{frag}')")
    if errors:
        sys.exit("Broken internal links:\n  " + "\n  ".join(errors))


if __name__ == "__main__":
    build()
