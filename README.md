# mateowoetam's static site

Hand-written static HTML site hosted on Codeberg Pages, in English and Spanish.
Zero third-party requests; the only scripts are self-hosted free-software ones
(theme persistence + a WebMCP tool layer).

## Structure

- `/` — English site (x-default). `/es/` — Spanish mirror.
- `/writing/*.html` — English articles; `/es/textos/*.html` — Spanish articles.
- `style.css`, `fonts/` — self-hosted styles and OFL fonts.
- `data/site.json`, `llms.txt`, `sitemap.xml`, `robots.txt`, `_headers` — agent
  and crawler metadata.
- `theme.js`, `site.js`, `webmcp.js` — progressive-enhancement scripts.
- `_templates/` — shared chrome partials + page registry (see its README).
- `tools/` — `build.py` (partials builder), `add-language.sh` (language scaffold).

## Editing the header / footer / banner

The top banner, header and footer are defined once in `_templates/partials/`.
Edit the partial you want, then regenerate every page:

```sh
python3 tools/build.py
```

See `_templates/README.md` for details.

## Adding a language

```sh
tools/add-language.sh <code> [Label]
# translate the new files, register them, then:
python3 tools/build.py
```

Also register the language in `data/site.json`, `llms.txt`, `sitemap.xml` and
`webmcp.js`.
