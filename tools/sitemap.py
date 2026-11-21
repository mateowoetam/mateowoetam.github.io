#!/usr/bin/env python3
"""Generate sitemap.xml and check every page's i18n wiring.

Source of truth: `data/site.json` -> `pages` and `articles`. Each entry maps a
language code to the page's path, so one entry = one group of translations.

Usage
-----
    python3 tools/sitemap.py           # (re)write sitemap.xml
    python3 tools/sitemap.py --check   # exit non-zero if sitemap.xml is stale or
                                       # any page's <head> / language switcher is
                                       # inconsistent with data/site.json

What --check verifies for every page in every language:
  * the file exists and <html lang> matches its language
  * exactly one <link rel="canonical"> pointing at itself
  * one <link rel="alternate" hreflang> per language + x-default (= default
    language), each pointing at the right translation
  * the banner language switcher links resolve to the right translations,
    with aria-current="page" on the current language only
  * the JavaScript license footer link resolves to an existing page

License: CC0-1.0
"""
from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text(encoding="utf-8"))
BASE = SITE["url"].rstrip("/")
LANGS = SITE["languages"]
DEFAULT = SITE["defaultLanguage"]


def groups() -> list[dict]:
    out = []
    for p in SITE["pages"]:
        out.append({"lastmod": p["lastmod"], "path": p["path"]})
    for a in SITE["articles"]:
        out.append({"lastmod": a["lastmod"], "path": a["url"]})
    return out


def file_of(path: str) -> str:
    """Site path -> repo-relative file ('/' -> 'index.html')."""
    p = path.lstrip("/")
    return p + "index.html" if p == "" or p.endswith("/") else p


def render_sitemap() -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for g in groups():
        for lang in LANGS:
            lines.append("  <url>")
            lines.append(f"    <loc>{escape(BASE + g['path'][lang])}</loc>")
            lines.append(f"    <lastmod>{g['lastmod']}</lastmod>")
            for alt in LANGS:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{alt}" '
                    f'href="{escape(BASE + g["path"][alt])}"/>'
                )
            lines.append(
                f'    <xhtml:link rel="alternate" hreflang="x-default" '
                f'href="{escape(BASE + g["path"][DEFAULT])}"/>'
            )
            lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


class Head(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.html_lang = None
        self.canonical: list[str] = []
        self.alternates: list[tuple[str, str]] = []
        self.switcher: list[dict] = []
        self.jslicense: list[str] = []
        self._in_menu = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag == "html":
            self.html_lang = a.get("lang")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical.append(a.get("href", ""))
        elif tag == "link" and a.get("rel") == "alternate" and "hreflang" in a:
            self.alternates.append((a["hreflang"], a.get("href", "")))
        elif tag == "div" and "lang-menu" in cls:
            self._in_menu = 1
        elif tag == "div" and self._in_menu:
            self._in_menu += 1
        elif tag == "a" and self._in_menu:
            self.switcher.append(a)
        if tag == "a" and "data-jslicense" in a:
            self.jslicense.append(a.get("href", ""))

    def handle_endtag(self, tag):
        if tag == "div" and self._in_menu:
            self._in_menu -= 1


def resolve(from_file: str, href: str) -> str:
    if href.startswith(BASE):
        return file_of(href[len(BASE):] or "/")
    if href.startswith("/"):
        return file_of(href)
    return posixpath.normpath(posixpath.join(posixpath.dirname(from_file), href))


def check_pages() -> list[str]:
    errors: list[str] = []
    for g in groups():
        for lang in LANGS:
            f = file_of(g["path"][lang])
            path = ROOT / f
            if not path.exists():
                errors.append(f"{f}: missing file")
                continue
            h = Head()
            h.feed(path.read_text(encoding="utf-8"))
            if h.html_lang != lang:
                errors.append(f"{f}: <html lang={h.html_lang!r}>, expected {lang!r}")
            want_canon = BASE + g["path"][lang]
            if h.canonical != [want_canon]:
                errors.append(f"{f}: canonical {h.canonical}, expected {want_canon}")
            want_alt = sorted(
                [(l, BASE + g["path"][l]) for l in LANGS]
                + [("x-default", BASE + g["path"][DEFAULT])]
            )
            if sorted(h.alternates) != want_alt:
                errors.append(f"{f}: hreflang alternates wrong:\n      got  {sorted(h.alternates)}\n      want {want_alt}")
            seen = {}
            for a in h.switcher:
                l = a.get("hreflang")
                target = resolve(f, a.get("href", ""))
                seen[l] = True
                if l not in LANGS:
                    errors.append(f"{f}: switcher link with unknown hreflang {l!r}")
                    continue
                if target != file_of(g["path"][l]):
                    errors.append(f"{f}: switcher {l} -> {a.get('href')} resolves to {target}, expected {file_of(g['path'][l])}")
                current = a.get("aria-current") == "page"
                if current != (l == lang):
                    errors.append(f"{f}: switcher {l} aria-current={'page' if current else 'absent'}")
            for l in LANGS:
                if l not in seen:
                    errors.append(f"{f}: switcher missing {l}")
            for href in h.jslicense:
                t = resolve(f, href)
                if not (ROOT / t).exists():
                    errors.append(f"{f}: JS license link {href} -> {t} does not exist")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    xml = render_sitemap()
    target = ROOT / "sitemap.xml"
    if not args.check:
        target.write_text(xml, encoding="utf-8")
        print(f"wrote sitemap.xml ({xml.count('<url>')} URLs)")
        return 0
    errors = check_pages()
    if target.read_text(encoding="utf-8") != xml:
        errors.insert(0, "sitemap.xml is out of date (run tools/sitemap.py)")
    for e in errors:
        print("  " + e)
    print(f"{len(errors)} problem(s)" if errors else "sitemap and i18n links OK")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
