// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/*
WebMCP tools for mateowoetam.codeberg.page

Self-hosted, dependency-free progressive enhancement. No-op in browsers
without the WebMCP API (feature-detected). All tools are read-only except
open_page (navigates) and set_theme (flips the theme checkbox).

Written to HardenedJS rules (https://hardenedjs.org/) without requiring
the SES shim:
  - strict mode; all state closed over, nothing written to globals;
  - intrinsics captured at load time and called through uncurried
    references, so later prototype tampering cannot redirect them;
  - every record shared with the host is deep-frozen with harden(). If the
    page runs under SES lockdown(), the real globalThis.harden is used;
    otherwise a local deep-freeze stand-in is;
  - host objects (DOM, fetch results) are never frozen or mutated;
  - every input crossing the trust boundary is validated at runtime: the
    browser does not enforce inputSchema, so `enum` is only a hint.

Languages: English (/), Spanish (/es/), Esperanto (/eo/). The URL tables
below mirror data/site.json; tools/sitemap.py --check validates the pages.

Copyright (C) 2026 Mateo (@mateowoetam)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
(function () {
  'use strict';

  var mc = document.modelContext || navigator.modelContext; /* navigator.* = Chrome <=146 */
  if (!mc || typeof mc.registerTool !== 'function') return;

  /* ---- captured intrinsics ------------------------------------------ */
  var FnProto = Function.prototype;
  var uncurryThis = FnProto.bind.bind(FnProto.call);
  var freeze = Object.freeze;
  var isFrozen = Object.isFrozen;
  var getOwnPropertyNames = Object.getOwnPropertyNames;
  var hasOwn = uncurryThis(Object.prototype.hasOwnProperty);
  var indexOf = uncurryThis(Array.prototype.indexOf);
  var arrayMap = uncurryThis(Array.prototype.map);
  var join = uncurryThis(Array.prototype.join);
  var trim = uncurryThis(String.prototype.trim);
  var replace = uncurryThis(String.prototype.replace);
  var match = uncurryThis(String.prototype.match);
  var toUpperCase = uncurryThis(String.prototype.toUpperCase);
  var querySelector = uncurryThis(Element.prototype.querySelector);
  var querySelectorAll = uncurryThis(Element.prototype.querySelectorAll);
  var docQuerySelector = uncurryThis(Document.prototype.querySelector);
  var docQuerySelectorAll = uncurryThis(Document.prototype.querySelectorAll);
  var getAttribute = uncurryThis(Element.prototype.getAttribute);
  var textContentGet = uncurryThis(getOwnPropertyDescriptorGetter(Node.prototype, 'textContent'));
  var registerTool = uncurryThis(mc.registerTool);
  var fetchFn = globalThis.fetch;
  var DOMParserCtor = globalThis.DOMParser;
  var parseFromString = uncurryThis(DOMParserCtor.prototype.parseFromString);
  var URLCtor = globalThis.URL;
  var EventCtor = globalThis.Event;
  var assign = uncurryThis(location.assign); /* [LegacyUnforgeable]: lives on the instance */
  var matchMedia = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia.bind(globalThis) : null;
  var ORIGIN = location.origin;
  var loc = location;

  function getOwnPropertyDescriptorGetter(obj, key) {
    return Object.getOwnPropertyDescriptor(obj, key).get;
  }

  /* harden(): real one under SES lockdown, else a local deep freeze for plain data. */
  var harden = typeof globalThis.harden === 'function' ? globalThis.harden : function localHarden(root) {
    /* Plain data and our own functions only; never pass host objects here. */
    var stack = [root];
    while (stack.length) {
      var v = stack.pop();
      if ((typeof v !== 'object' && typeof v !== 'function') || v === null || isFrozen(v)) continue;
      freeze(v);
      /* Own properties only: walking prototypes would freeze shared intrinsics
         (e.g. AsyncFunction.prototype), which only lockdown() may do. */
      var names = getOwnPropertyNames(v);
      for (var i = 0; i < names.length; i++) stack.push(v[names[i]]);
    }
    return root;
  };

  /* ---- site tables (mirror data/site.json) --------------------------- */
  var LANG_CODES = harden(['en', 'es', 'eo']);
  var PAGE_KEYS = harden(['home', 'services', 'writing', 'contact', 'javascript']);
  var ARTICLE_SLUGS = harden(['messaging', 'passwords', 'linux', 'vpn', 'music']);

  var PAGES = harden({
    en: { home: '/', services: '/services.html', writing: '/writing.html', contact: '/contact.html', javascript: '/javascript.html' },
    es: { home: '/es/index.html', services: '/es/servicios.html', writing: '/es/textos.html', contact: '/es/contacto.html', javascript: '/es/javascript.html' },
    eo: { home: '/eo/index.html', services: '/eo/servoj.html', writing: '/eo/skribado.html', contact: '/eo/kontakto.html', javascript: '/eo/javascript.html' }
  });

  /* Slugs are the stable English names; file names are localized. */
  var ARTICLES = harden({
    en: { messaging: '/writing/messaging.html', passwords: '/writing/passwords.html', linux: '/writing/linux.html', vpn: '/writing/vpn.html', music: '/writing/music.html' },
    es: { messaging: '/es/textos/mensajeria.html', passwords: '/es/textos/contrasenas.html', linux: '/es/textos/linux.html', vpn: '/es/textos/vpn.html', music: '/es/textos/musica.html' },
    eo: { messaging: '/eo/skribado/mesagado.html', passwords: '/eo/skribado/pasvortoj.html', linux: '/eo/skribado/linux.html', vpn: '/eo/skribado/vpn.html', music: '/eo/skribado/muziko.html' }
  });

  var ARTICLE_TITLES = harden({
    en: {
      messaging: 'Private Messaging and Secure Alternatives',
      passwords: 'Password Managers and 2FA Authentication',
      linux: 'Digital Sovereignty and Linux on the Desktop',
      vpn: 'VPN: What is a VPN and how does it work?',
      music: 'Owning Digital Music'
    },
    es: {
      messaging: 'Mensajería Privada y Alternativas Seguras',
      passwords: 'Gestores de Contraseñas y Autenticación 2FA',
      linux: 'Soberanía Digital y Linux en el Escritorio',
      vpn: 'VPN: ¿Qué es una VPN y cómo funciona?',
      music: 'Propiedad de la Música Digital'
    },
    eo: {
      messaging: 'Privata Mesaĝado kaj Sekuraj Alternativoj',
      passwords: 'Pasvortaj Administrantoj kaj 2FA-Aŭtentikigo',
      linux: 'Cifereca Suvereneco kaj Linukso sur la Labortablo',
      vpn: 'VPN: Kio estas VPN kaj kiel ĝi funkcias?',
      music: 'Cifereca Muzika Posedo'
    }
  });

  var PAGE_SUMMARIES = harden({
    en: {
      home: 'About Mateo; featured Codeberg repositories (NixOS config, keyboard layouts, CLI tools).',
      services: 'Privacy/FOSS consulting services with prices in MXN.',
      writing: 'Index of privacy and digital-sovereignty guides.',
      contact: 'Email, GPG fingerprint, and social profiles.',
      javascript: 'LibreJS license labels for every script on the site.'
    },
    es: {
      home: 'Sobre Mateo; repositorios destacados en Codeberg.',
      services: 'Servicios de consultoría en privacidad y software libre con precios en MXN.',
      writing: 'Índice de guías de privacidad y soberanía digital.',
      contact: 'Correo, huella GPG y perfiles sociales.',
      javascript: 'Etiquetas de licencia LibreJS de cada script del sitio.'
    },
    eo: {
      home: 'Pri Mateo; elstaraj deponejoj sur Codeberg.',
      services: 'Konsultservoj pri privateco kaj libera programaro, kun prezoj en MXN.',
      writing: 'Indekso de gvidiloj pri privateco kaj cifereca suvereneco.',
      contact: 'Retpoŝto, GPG-fingrosigno kaj sociaj profiloj.',
      javascript: 'LibreJS-permesilaj etikedoj por ĉiu skripto de la retejo.'
    }
  });

  var GPG_KEY_URL = 'https://keys.openpgp.org/vks/v1/by-fingerprint/AC91A0AD921E4DE592180965441E486FD756EB4C';

  /* ---- helpers -------------------------------------------------------- */
  function oneOf(list, value, name) {
    if (typeof value !== 'string' || indexOf(list, value) === -1) {
      throw new TypeError('Invalid ' + name + ': must be one of ' + join(list, ', '));
    }
    return value;
  }

  function requireLang(input) {
    var lang = input === undefined || input === null ? undefined : input.lang;
    if (lang === undefined) return 'en';
    return oneOf(LANG_CODES, lang, 'lang');
  }

  function text(node) {
    return node ? trim(replace(textContentGet(node), /\s+/g, ' ')) : null;
  }

  function fullUrl(path) { return new URLCtor(path, ORIGIN).href; }

  /* Only fetch same-origin paths taken from the tables above. */
  function isAllowedPath(path) {
    var langs = LANG_CODES;
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i], k;
      for (k = 0; k < PAGE_KEYS.length; k++) if (PAGES[l][PAGE_KEYS[k]] === path) return true;
      for (k = 0; k < ARTICLE_SLUGS.length; k++) if (ARTICLES[l][ARTICLE_SLUGS[k]] === path) return true;
    }
    return false;
  }

  function fetchDoc(path, signal) {
    if (!isAllowedPath(path)) return Promise.reject(new Error('Refusing to fetch path outside the site table'));
    var url = new URLCtor(path, ORIGIN);
    if (url.origin !== ORIGIN) return Promise.reject(new Error('Refusing to fetch cross-origin URL'));
    return fetchFn(url.href, { signal: signal, credentials: 'omit', redirect: 'error' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + path);
      return r.text();
    }).then(function (html) {
      return parseFromString(new DOMParserCtor(), html, 'text/html');
    });
  }

  function langSchema() {
    return { type: 'string', enum: LANG_CODES, description: 'Language code: en (English, default), es (Spanish), eo (Esperanto).' };
  }

  function register(tool) {
    var p = registerTool(mc, harden(tool));
    if (p && typeof p.then === 'function') p.then(undefined, function () { /* name clash or unsupported: stay silent */ });
  }

  /* ---- tools ---------------------------------------------------------- */
  register({
    name: 'list_site_pages',
    title: 'List site pages',
    description: 'Pages and articles on mateowoetam.codeberg.page (privacy/FOSS consulting and writing), with absolute URLs, in one language (default en).',
    inputSchema: { type: 'object', properties: { lang: langSchema() } },
    annotations: { readOnlyHint: true },
    execute: async function (input) {
      var lang = requireLang(input);
      return harden({
        lang: lang,
        pages: arrayMap(PAGE_KEYS, function (key) {
          return { id: key, url: fullUrl(PAGES[lang][key]), summary: PAGE_SUMMARIES[lang][key] };
        }),
        articles: arrayMap(ARTICLE_SLUGS, function (slug) {
          return { slug: slug, url: fullUrl(ARTICLES[lang][slug]), title: ARTICLE_TITLES[lang][slug] };
        })
      });
    }
  });

  register({
    name: 'get_service_catalog',
    title: 'Get services and prices',
    description: 'Return each consulting service: name, price, summary, details and tools used.',
    inputSchema: { type: 'object', properties: { lang: langSchema() } },
    annotations: { readOnlyHint: true },
    execute: async function (input, ctx) {
      var lang = requireLang(input);
      var doc = await fetchDoc(PAGES[lang].services, ctx && ctx.signal);
      return harden(arrayMap(docQuerySelectorAll(doc, '.service-card'), function (card) {
        return {
          name: text(querySelector(card, 'h3')),
          price: text(querySelector(card, '.price-badge')),
          summary: text(querySelector(card, '.service-header p')),
          details: text(querySelector(card, ':scope > p')),
          tools: arrayMap(querySelectorAll(card, '.tag'), text)
        };
      }));
    }
  });

  register({
    name: 'get_article',
    title: 'Read an article',
    description: 'Fetch one of the guides in English, Spanish or Esperanto and return its full text. Slugs are the same in every language.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', enum: ARTICLE_SLUGS, description: 'Article id' },
        lang: langSchema()
      },
      required: ['slug']
    },
    annotations: { readOnlyHint: true },
    execute: async function (input, ctx) {
      var slug = oneOf(ARTICLE_SLUGS, input && input.slug, 'slug');
      var lang = requireLang(input);
      var path = ARTICLES[lang][slug];
      var doc = await fetchDoc(path, ctx && ctx.signal);
      return harden({
        lang: lang,
        slug: slug,
        url: fullUrl(path),
        title: ARTICLE_TITLES[lang][slug],
        text: text(docQuerySelector(doc, 'article'))
      });
    }
  });

  register({
    name: 'get_contact',
    title: 'Get contact details',
    description: 'Return the contact email address and GPG fingerprint, as published on the contact page.',
    inputSchema: { type: 'object', properties: { lang: langSchema() } },
    annotations: { readOnlyHint: true },
    execute: async function (input, ctx) {
      var lang = requireLang(input);
      var doc = await fetchDoc(PAGES[lang].contact, ctx && ctx.signal);
      var mail = docQuerySelector(doc, 'a[href^="mailto:"]');
      var copy = docQuerySelector(doc, '#copy-gpg');
      var fpSource = copy ? getAttribute(copy, 'data-copy') : text(docQuerySelector(doc, '.project-card small'));
      var fp = fpSource ? match(replace(fpSource, /\s+/g, ''), /[0-9A-Fa-f]{40}/) : null;
      return harden({
        email: mail ? replace(getAttribute(mail, 'href'), /^mailto:/, '') : null,
        gpgFingerprint: fp ? toUpperCase(fp[0]) : null,
        gpgKeyUrl: GPG_KEY_URL
      });
    }
  });

  register({
    name: 'open_page',
    title: 'Navigate the site',
    description: 'Navigate the visible browser to a site page, or to an article when `slug` is given.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: PAGE_KEYS, description: 'Which page to open (ignored when slug is set)' },
        slug: { type: 'string', enum: ARTICLE_SLUGS, description: 'Open this article instead of a page' },
        lang: langSchema()
      }
    },
    annotations: { readOnlyHint: false },
    execute: async function (input) {
      var lang = requireLang(input);
      var path;
      if (input && input.slug !== undefined) {
        path = ARTICLES[lang][oneOf(ARTICLE_SLUGS, input.slug, 'slug')];
      } else {
        path = PAGES[lang][oneOf(PAGE_KEYS, input && input.page, 'page')];
      }
      assign(loc, fullUrl(path));
      return 'Navigating to ' + path;
    }
  });

  register({
    name: 'set_theme',
    title: 'Set the site theme',
    description: 'Switch the visible site theme to light or dark. The choice is remembered across pages.',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['light', 'dark'] } },
      required: ['mode']
    },
    annotations: { readOnlyHint: false },
    execute: async function (input) {
      var mode = oneOf(['light', 'dark'], input && input.mode, 'mode');
      var cb = document.getElementById('theme-toggle');
      if (!cb) return 'Theme toggle not present on this page.';
      /* Same mapping as theme.js / style.css: checked = the opposite of the system scheme. */
      var systemLight = !!(matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
      cb.checked = systemLight ? mode === 'dark' : mode === 'light';
      cb.dispatchEvent(new EventCtor('change', { bubbles: true })); /* lets theme.js persist it */
      return 'Theme set to ' + mode + '.';
    }
  });
})();
// @license-end
