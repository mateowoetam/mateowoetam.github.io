# Site templates and builder

This directory drives the shared chrome (top banner, header, footer) for every
page. Edit a partial **once** and run the builder to update all pages.

## Files

- `partials/banner.html` — top banner: language switch + theme toggle.
- `partials/header-chrome.html` — main header for content pages (home,
  services, texts, contact). Logo + nav are filled from `pages.json` / `nav.json`.
- `partials/header-article.html` — article header (title + back link).
- `partials/footer.html` — footer line + `<script>` tags.
- `nav.json` — nav labels, hrefs, order and the article "back to texts" link,
  per language.
- `pages.json` — one entry per generated page: language, type (`chrome` or
  `article`), relative `root`, banner text, logo/title HTML, active nav item,
  and the `translation` (the same page in the other language).

## How pages are generated

Each page contains three marker regions:

```html
<!--@banner--><!--/@banner-->
<!--@header--><!--/@header-->
<!--@footer--><!--/@footer-->
```

`tools/build.py` renders the matching partial for that page and replaces
everything between the markers. The markers are preserved, so the build is
idempotent.

## Commands

```sh
python3 tools/build.py          # rewrite all pages from the partials
python3 tools/build.py --check  # exit non-zero if any page is out of date
```

## Placeholders

Partials use `{{name}}` placeholders filled from `pages.json` / `nav.json`:

| Placeholder | Meaning |
|-------------|---------|
| `{{banner}}` | banner text for this page |
| `{{langLabel}}` | uppercase code shown in the switch (`EN`, `ES`) |
| `{{enHref}}` / `{{esHref}}` | this page and its translation, relative |
| `{{enCurrent}}` / `{{esCurrent}}` | `aria-current="page"` or empty |
| `{{logoHref}}` / `{{logoHtml}}` | chrome header logo |
| `{{nav}}` | rendered `<nav>` link list |
| `{{backHref}}` / `{{backLabel}}` | article header back link |
| `{{titleHtml}}` | article title/logo |
| `{{root}}` | relative path to site root (`./`, `../`, `../../`) |
| `{{footText}}` | localized license line |
| `{{extraScripts}}` | extra `<script>` tags (e.g. `site.js` on contact) |

Deployment note: Codeberg Pages publishes the repo as-is, so `_templates/` is
publicly fetchable. It contains no secrets — only templates and site data.
