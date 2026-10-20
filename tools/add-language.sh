#!/usr/bin/env bash
# Scaffold a new language mirror of the site.
#
# Usage: tools/add-language.sh <lang-code> [label]
#   lang-code  ISO 639-1 code used for the directory and hreflang (e.g. "fr", "de")
#   label      Optional label shown in the switcher menu (default: uppercase code)
#
# The site is generated from _templates/pages.json + _templates/partials/ by
# tools/build.py. Adding a language means: create the page files, register them
# in pages.json, then run the builder. This script automates steps 1 and 3 and
# tells you what to translate.
#
# After running it you must:
#   - Translate the visible text in each new file (search for "TODO translate").
#   - Add the language to the site config in: data/site.json, llms.txt, sitemap.xml.
#   - Add the language to LANGS / LANG_CODES in webmcp.js.
#   - Run tools/build.py.

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <lang-code> [label]" >&2
    exit 1
fi

CODE="$1"
LABEL="${2:-$(printf '%s' "$CODE" | tr '[:lower:]' '[:upper:]')}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -d "$ROOT/$CODE" ]; then
    echo "Directory /$CODE already exists; refusing to overwrite." >&2
    exit 1
fi

mkdir -p "$ROOT/$CODE/textos"

# 1. Copy the English pages as a starting point (content to translate).
for page in index services writing contact; do
    cp "$ROOT/$page.html" "$ROOT/$CODE/$page.html"
done
for art in "$ROOT"/writing/*.html; do
    cp "$art" "$ROOT/$CODE/textos/$(basename "$art")"
done

echo "Copied English pages into /$CODE/."
echo
echo "Next:"
echo "  1. Wrap the chrome in each new page with markers (or copy the marker"
echo "     blocks from an existing Spanish page):"
echo "        <!--@banner--> ... <!--/@banner-->"
echo "        <!--@header--> ... <!--/@header-->"
echo "        <!--@footer--> ... <!--/@footer-->"
echo "  2. Add each new page to _templates/pages.json (lang=\"$CODE\")."
echo "  3. Add \"$CODE\" labels to _templates/nav.json."
echo "  4. Run: python3 tools/build.py"
echo
echo "Label to use in the switcher: $LABEL"
