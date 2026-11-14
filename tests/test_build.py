"""Build + SEO guarantees. Run: python3 -m unittest discover -s tests"""
import html
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
BASE = "https://flirtlessons.com"


def text(f):
    return f.read_text(encoding="utf-8")


class BuildTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = subprocess.run([sys.executable, "-I", "build.py"], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            raise AssertionError("build failed:\n" + r.stdout + r.stderr)
        cls.pages = {f: text(f) for f in SITE.rglob("*.html")}
        cls.sitemap = re.findall(r"<loc>([^<]+)</loc>", text(SITE / "sitemap.xml"))

    def url_of(self, f):
        rel = f.relative_to(SITE).as_posix()
        return BASE + "/" + rel.removesuffix("index.html")

    def public(self):
        return {f: s for f, s in self.pages.items() if 'content="noindex"' not in s}

    def test_sitemap_lists_exactly_the_public_pages(self):
        self.assertEqual(sorted(self.sitemap), sorted(self.url_of(f) for f in self.public()))

    def test_public_pages_are_indexable_with_self_canonical(self):
        for f, s in self.public().items():
            self.assertIn('content="index, follow', s, f)
            self.assertIn(f'rel="canonical" href="{self.url_of(f)}"', s, f)

    def test_404_is_noindex_without_canonical_and_not_in_sitemap(self):
        s = self.pages[SITE / "404.html"]
        self.assertIn('content="noindex"', s)
        self.assertNotIn('rel="canonical"', s)

    def test_titles_and_descriptions_unique_and_sized(self):
        seen_t, seen_d = {}, {}
        for f, s in self.public().items():
            t = html.unescape(re.search(r"<title>(.*?)</title>", s).group(1))
            d = html.unescape(re.search(r'name="description" content="([^"]*)"', s).group(1))
            self.assertLessEqual(len(t), 60, f"{f}: title {len(t)}")
            self.assertTrue(70 <= len(d) <= 160, f"{f}: description {len(d)}")
            self.assertNotIn(t, seen_t, f"duplicate title {f}")
            self.assertNotIn(d, seen_d, f"duplicate description {f}")
            seen_t[t], seen_d[d] = f, f

    def test_exactly_one_h1(self):
        for f, s in self.pages.items():
            self.assertEqual(len(re.findall(r"<h1[ >]", s)), 1, f)

    def test_jsonld_parses_and_faq_matches_visible_text(self):
        for f, s in self.pages.items():
            for block in re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', s):
                graph = json.loads(block.replace("<\\/", "</"))["@graph"]
                for node in graph:
                    if node["@type"] == "FAQPage":
                        visible = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", q))).strip()
                                   for q in re.findall(r"<details><summary>(.*?)</summary>", s)]
                        self.assertEqual([q["name"] for q in node["mainEntity"]], visible, f)

    def test_social_images_exist(self):
        for f, s in self.pages.items():
            for img in re.findall(r'property="og:image" content="([^"]+)"', s):
                self.assertTrue((SITE / img.removeprefix(BASE + "/")).exists(), f"{f}: {img}")

    def test_no_third_party_resources(self):
        for f, s in self.pages.items():
            for tag in re.findall(r"<(?:script|link|img)\b[^>]*>", s):
                m = re.search(r'(?:src|href)="(https?://[^"]+)"', tag)
                if m and 'rel="canonical"' not in tag:
                    self.fail(f"{f}: third-party resource {m.group(1)}")

    def test_analytics_flag_matches_privacy_policy(self):
        legal = self.pages[SITE / "legal" / "index.html"]
        disclosed = "Anonymous usage counts" in legal
        expected = "on" if disclosed else "off"
        for f, s in self.pages.items():
            self.assertIn(f'<meta name="fl-analytics" content="{expected}">', s, f)

    def test_challenge_page_loads_its_script_and_has_custom_preview(self):
        s = self.pages[SITE / "rizz-test" / "index.html"]
        self.assertRegex(s, r'<script src="/challenge\.js\?v=[0-9a-f]{8}" defer>')
        self.assertIn(f'property="og:image" content="{BASE}/og/rizz-test.png"', s)
        self.assertNotIn("challenge.js", self.pages[SITE / "index.html"])

    def article_pages(self):
        sys.path.insert(0, str(ROOT))
        import build
        return build, {slug: self.pages[SITE / slug / "index.html"] for slug in build.SERIES}

    def test_every_article_has_a_40_to_60_word_short_answer(self):
        _, arts = self.article_pages()
        for slug, s in arts.items():
            m = re.search(r'<div class="answer"><p class="answer-label">Short answer</p><p>(.*?)</p></div>', s)
            self.assertIsNotNone(m, f"{slug}: no short answer")
            n = len(html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).split())
            self.assertTrue(40 <= n <= 60, f"{slug}: short answer is {n} words")

    def test_every_article_has_its_own_1200x630_social_card(self):
        import struct
        _, arts = self.article_pages()
        seen = set()
        for slug, s in arts.items():
            img = re.search(r'property="og:image" content="([^"]+)"', s).group(1)
            self.assertNotEqual(img, f"{BASE}/og-image.png", f"{slug} uses the generic card")
            self.assertNotIn(img, seen, f"{slug} shares a card")
            seen.add(img)
            data = (SITE / img.removeprefix(BASE + "/")).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n", slug)
            self.assertEqual(struct.unpack(">II", data[16:24]), (1200, 630), slug)
            self.assertIn('name="twitter:image:alt" content="', s)

    def test_sources_are_linked_and_match_article_citations(self):
        _, arts = self.article_pages()
        cited = 0
        for slug, s in arts.items():
            listed = re.findall(r'<ol class="sources">(.*?)</ol>', s, re.S)
            links = re.findall(r'<a href="([^"]+)"', listed[0]) if listed else []
            for u in links:
                self.assertTrue(u.startswith("https://"), f"{slug}: {u}")
            graph = json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', s)
                               .group(1).replace("<\\/", "</"))["@graph"]
            article = next(n for n in graph if n["@type"] == "Article")
            self.assertEqual([c["url"] for c in article.get("citation", [])], links, slug)
            cited += bool(links)
        self.assertGreaterEqual(cited, 4)

    def test_quiz_page_loads_quiz_script_and_main_js_no_longer_holds_it(self):
        s = self.pages[SITE / "friend-zone-quiz" / "index.html"]
        self.assertRegex(s, r'<script src="/quiz\.js\?v=[0-9a-f]{8}" defer>')
        self.assertIn('data-share-native', s)
        self.assertNotIn("quizResult", text(SITE / "main.js"))
        for f, page in self.pages.items():
            if f != SITE / "friend-zone-quiz" / "index.html":
                self.assertNotIn("quiz.js", page, f)

    def test_home_links_every_lesson_tool_and_guide(self):
        build, _ = self.article_pages()
        home = self.pages[SITE / "index.html"]
        for slug in build.SERIES:
            self.assertIn(f'href="/{slug}/"', home, slug)

    def test_attractive_pages_target_different_queries(self):
        a = re.search(r"<title>(.*?)</title>", self.pages[SITE / "how-to-be-more-attractive" / "index.html"]).group(1)
        b = re.search(r"<title>(.*?)</title>", self.pages[SITE / "attractive-habits" / "index.html"]).group(1)
        self.assertIn("How to Be More Attractive", a)
        self.assertNotIn("More Attractive", b)


if __name__ == "__main__":
    unittest.main()
