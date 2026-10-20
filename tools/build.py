#!/usr/bin/env python3
"""Static site partials builder for mateowoetam.codeberg.page.

Edit the shared chrome in ONE place (`_templates/partials/`) and run this to
regenerate the banner/header/footer on every page. The output is plain static
HTML with no runtime templating, so the deployed site keeps its zero-JS,
no-dependency philosophy.

How it works
------------
Each page contains three marker regions delimited by HTML comments:

    <!--@banner-->  ...  <!--/@banner-->
    <!--@header-->  ...  <!--/@header-->
    <!--@footer-->  ...  <!--/@footer-->

`build.py` renders the matching partial for the page (from `_templates/pages.json`)
and replaces everything between each pair of markers, preserving the markers so
the operation is idempotent.

Usage
-----
    python3 tools/build.py            # rewrite all pages in place
    python3 tools/build.py --check    # exit non-zero if anything is out of date
    python3 tools/build.py --wrap     # add markers to pages that lack them (first run)

License: CC0-1.0
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "_templates"
PARTIALS = TEMPLATES / "partials"

SECTIONS = ("banner", "header", "footer")

# Codeberg Pages serves static files only and ignores `_headers`, so the
# production site gets no HTTP CSP. A <meta http-equiv> CSP is the only way to
# enforce one on this host. Fetch directives only (frame-ancestors cannot be set
# via meta). Kept in sync with the `_headers` file for other hosts.
CSP = (
    "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; "
    "font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; "
    "form-action 'none'; upgrade-insecure-requests"
)
CSP_META = f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'

# LibreJS JavaScript Web Labels link shown in every footer. The href is relative
# to each page's `root`; the label is per language.
JSLICENSE = {
    "en": {"href": "javascript.html", "label": "JavaScript license information"},
    "es": {"href": "es/javascript.html", "label": "Información de licencia de JavaScript"},
}



def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def fill(template: str, variables: dict) -> str:
    """Replace {{key}} placeholders; unknown placeholders are left intact."""
    out = template
    for key, value in variables.items():
        out = out.replace("{{" + key + "}}", value)
    return out


def render_nav(nav: dict, lang: str, active: str) -> str:
    """Build the <nav> link list. Active link uses the text color, others red."""
    labels = nav[lang]["labels"]
    hrefs = nav[lang]["hrefs"]
    order = nav[lang]["order"]
    lines = []
    for key in order:
        color = "var(--ctp-text)" if key == active else "var(--ctp-red)"
        if key == "home":
            style = f"margin-right: 15px; color: {color}; text-transform: uppercase;"
        else:
            style = f"color: {color}; text-transform: uppercase; font-weight: 800;"
        lines.append(
            f'                <a href="{hrefs[key]}" style="{style}">[ {labels[key]} ]</a>'
        )
    return "\n".join(lines)


def build_page(page: dict, site: dict, nav: dict, banners: dict, footers: dict) -> dict:
    lang = page["lang"]
    root = page.get("root", "")
    lang_label = lang.upper()

    # Language switcher targets: this page and its translation.
    # Hrefs are relative to the current page's own directory.
    import posixpath

    def rel(target: str) -> str:
        from_dir = posixpath.dirname(page["file"])
        return posixpath.relpath(target, from_dir) if from_dir else target

    en_href = en_current = es_href = es_current = ""
    if lang == "en":
        en_href = "./" + posixpath.basename(page["file"])
        en_current = ' aria-current="page"'
        es_href = rel(page["translation"])
    else:
        es_href = "./" + posixpath.basename(page["file"])
        es_current = ' aria-current="page"'
        en_href = rel(page["translation"])
    if not es_href.startswith((".", "/")):
        es_href = "./" + es_href
    if not en_href.startswith((".", "/")):
        en_href = "./" + en_href

    # Banner
    banner_text = page.get("banner")
    if banner_text is None:
        banner_text = banners.get(lang, {}).get(page["type"], "")
    banner_vars = {
        "banner": banner_text,
        "langLabel": lang_label,
        "enHref": en_href,
        "esHref": es_href,
        "enCurrent": en_current,
        "esCurrent": es_current,
    }
    banner_html = fill((PARTIALS / "banner.html").read_text(encoding="utf-8"), banner_vars)

    # Header
    if page["type"] == "chrome":
        header_vars = {
            "logoHref": page.get("logoHref") or nav[lang]["hrefs"]["home"],
            "logoHtml": page["logoHtml"],
            "nav": render_nav(nav, lang, page["active"]),
        }
        header_html = fill(
            (PARTIALS / "header-chrome.html").read_text(encoding="utf-8"), header_vars
        )
    else:
        back = nav[lang]["articleBack"]
        header_vars = {
            "backHref": back["href"],
            "backLabel": back["label"],
            "titleHtml": page["titleHtml"],
        }
        header_html = fill(
            (PARTIALS / "header-article.html").read_text(encoding="utf-8"), header_vars
        )

    # Footer
    extra = ""
    if "contact" in page["file"] and page["type"] == "chrome":
        extra = f'    <script src="{root}site.js" defer></script>'
    jslicense = JSLICENSE[lang]
    footer_vars = {
        "root": root,
        "footText": footers[lang],
        "jslicenseHref": jslicense["href"],
        "jslicenseLabel": jslicense["label"],
        "extraScripts": extra,
    }
    footer_html = fill((PARTIALS / "footer.html").read_text(encoding="utf-8"), footer_vars)

    return {"banner": banner_html, "header": header_html, "footer": footer_html}


def replace_region(text: str, section: str, body: str) -> str:
    open_m = f"<!--@{section}-->"
    close_m = f"<!--/@{section}-->"
    if open_m not in text or close_m not in text:
        raise ValueError(f"missing markers for '{section}'")
    pre, rest = text.split(open_m, 1)
    _, post = rest.split(close_m, 1)
    body = body.strip("\n")
    return f"{pre}{open_m}\n{body}\n{close_m}{post}"


def ensure_csp_meta(text: str) -> str:
    """Insert the CSP <meta> once, right after <meta charset>, idempotently."""
    if CSP_META in text:
        return text
    # Match the charset meta tag on its own line and append the CSP after it.
    needle = '<meta charset="UTF-8">'
    if needle in text:
        return text.replace(needle, needle + "\n    " + CSP_META, 1)
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="fail if pages are out of date")
    args = ap.parse_args()

    pages_cfg = load_json(TEMPLATES / "pages.json")
    nav = load_json(TEMPLATES / "nav.json")
    site = pages_cfg["site"]
    banners = pages_cfg["banners"]
    footers = pages_cfg["footers"]

    changed = []
    for page in pages_cfg["pages"]:
        path = ROOT / page["file"]
        if not path.exists():
            print(f"!! missing page: {page['file']}", file=sys.stderr)
            continue
        original = path.read_text(encoding="utf-8")
        rendered = ensure_csp_meta(original)
        blocks = build_page(page, site, nav, banners, footers)
        for section in SECTIONS:
            rendered = replace_region(rendered, section, blocks[section])
        if rendered != original:
            changed.append(page["file"])
            if not args.check:
                path.write_text(rendered, encoding="utf-8")

    if args.check:
        if changed:
            print("out of date:")
            for f in changed:
                print("  " + f)
            return 1
        print("all pages up to date")
        return 0

    if changed:
        print(f"updated {len(changed)} page(s):")
        for f in changed:
            print("  " + f)
    else:
        print("nothing to do")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
