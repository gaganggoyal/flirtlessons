# Flirt Lessons

Source for [flirtlessons.com](https://flirtlessons.com): free, practical lessons on flirting with confidence and respect.

## Structure

```
src/
  layout.html      shared page chrome (head, nav, footer)
  pages/*.html     one file per page, each starting with a <!--meta {...} --> JSON header
  static/          CSS, JS, fonts, icons, robots.txt (copied as-is)
build.py           builds src/ -> site/ (standard library only)
deploy.sh          builds, then uploads site/ to the server
```

`site/` is generated and wiped on every build. Edit `src/`, never `site/`.

## Build and preview

```sh
python3 build.py
python3 -m http.server 8000 --directory site   # then open http://localhost:8000
```

The build adds per-page titles, descriptions, canonical URLs, Open Graph tags,
JSON-LD (Article, BreadcrumbList, FAQPage), breadcrumbs, previous/next links,
`sitemap.xml` and cache-busting, and it fails on any broken internal link.

### Adding a page

1. Create `src/pages/<slug>.html` with a meta header (copy an existing lesson).
2. To put it in the lesson or tool series, add the slug to `LESSONS` or `TOOLS` in `build.py`.
3. Run `python3 build.py`. It is published at `/<slug>/` and added to the sitemap.

FAQ entries written as `<details><summary>Q</summary><p>A</p></details>` are
picked up automatically for FAQPage structured data.

## Deploy

Create `.deploy.env` (git-ignored) with `DEPLOY_HOST=user@server`, then run `./deploy.sh`.
Files are served from `/var/www/flirtlessons` by a small Caddy container behind the
server's shared edge proxy, so a deploy needs no restart.

## Content rules

- All writing is original. Do not copy from other books or sites.
- Advice stays consent-focused and free of manipulation tactics.
- Gender-neutral language for readers and the people they date.

## Licences

Site content © Flirt Lessons, all rights reserved. Fonts: Fraunces and Inter,
SIL Open Font License 1.1 (see `src/static/fonts/`).
