// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/* WebMCP tools for mateowoetam.codeberg.page
 *
 * Self-hosted, dependency-free progressive enhancement. No-op in browsers
 * without the WebMCP API (feature-detected). All tools are read-only except
 * site navigation and the local theme toggle; nothing submits data anywhere.
 *
 * Written in a defensive (Hardened JavaScript-inspired) style without the
 * SES shim: strict mode, closed-over state, records frozen before being
 * shared, builtins captured at load time, and runtime whitelist validation
 * of every input crossing the trust boundary (a tool schema's `enum` is a
 * hint to the host, never enforcement).
 * https://hardenedjs.org/
 *
 * The site is available in English (/) and Spanish (/es/). Tools take a
 * `lang` argument; adding a language means extending LANGS and the page/slug
 * tables below.
 *
 * Copyright (C) 2026 Mateo (@mateowoetam)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
(function () {
  'use strict';

  if (!('modelContext' in document)) return;

  var freeze = Object.freeze;
  var map = Array.prototype.map;
  var fetchFn = globalThis.fetch;
  var DOMParserCtor = globalThis.DOMParser;
  var AbortControllerCtor = globalThis.AbortController;

  var BASE = new URL('/', location.href).href;

  /* Language registry: code -> { prefix, texts.html, contact.html, article page fn } */
  var LANGS = freeze({
    en: freeze({
      pagePrefix: '/',
      articlePrefix: '/writing/',
      writingIndex: '/writing.html',
      contact: '/contact.html',
      services: '/services.html',
      home: '/'
    }),
    es: freeze({
      pagePrefix: '/es/',
      articlePrefix: '/es/textos/',
      writingIndex: '/es/textos.html',
      contact: '/es/contacto.html',
      services: '/es/servicios.html',
      home: '/es/index.html'
    })
  });

  var LANG_CODES = freeze(['en', 'es']);

  /* Article slugs are stable across languages (only the directory differs). */
  var ARTICLE_SLUGS = freeze(['mensajeria', 'contrasenas', 'linux', 'vpn', 'musica']);

  var ARTICLE_TITLES = freeze({
    en: freeze({
      mensajeria: 'Private Messaging and Secure Alternatives',
      contrasenas: 'Password Managers and 2FA Authentication',
      linux: 'Digital Sovereignty and Linux on the Desktop',
      vpn: 'VPN: What is a VPN and how does it work?',
      musica: 'Owning Digital Music'
    }),
    es: freeze({
      mensajeria: 'Mensajería Privada y Alternativas Seguras',
      contrasenas: 'Gestores de Contraseñas y Autenticación 2FA',
      linux: 'Soberanía Digital y Linux en el Escritorio',
      vpn: 'VPN: ¿Qué es una VPN y cómo funciona?',
      musica: 'Propiedad de la Música Digital'
    })
  });

  var PAGE_SUMMARIES = freeze({
    en: freeze([
      freeze({ path: '/', summary: 'About Mateo; featured Codeberg repositories (NixOS config, keyboard layouts, CLI tools).' }),
      freeze({ path: '/services.html', summary: 'Privacy/FOSS consulting services with prices in MXN.' }),
      freeze({ path: '/writing.html', summary: 'Index of privacy and digital-sovereignty guides.' }),
      freeze({ path: '/contact.html', summary: 'Email, GPG fingerprint, and social profiles.' })
    ]),
    es: freeze([
      freeze({ path: '/es/index.html', summary: 'Sobre Mateo; repositorios destacados en Codeberg.' }),
      freeze({ path: '/es/servicios.html', summary: 'Servicios de consultoría en privacidad y software libre con precios en MXN.' }),
      freeze({ path: '/es/textos.html', summary: 'Índice de guías de privacidad y soberanía digital.' }),
      freeze({ path: '/es/contacto.html', summary: 'Correo, huella GPG y perfiles sociales.' })
    ])
  });

  var ctl = new AbortControllerCtor();
  var opts = freeze({ signal: ctl.signal });

  function has(arr, value) {
    return map.call(arr, function (x) { return x; }).indexOf(value) !== -1;
  }

  /* Only ever fetch same-origin site files from a fixed allowlist path. */
  function fetchDoc(relPath) {
    if (typeof relPath !== 'string' || relPath.indexOf('..') !== -1 || relPath.charAt(0) === '/') {
      return Promise.reject(new Error('Refusing to fetch disallowed path'));
    }
    var url = new URL(relPath, BASE).href;
    if (url.indexOf(BASE) !== 0) {
      return Promise.reject(new Error('Refusing to fetch cross-origin URL'));
    }
    return fetchFn(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (html) {
      return new DOMParserCtor().parseFromString(html, 'text/html');
    });
  }

  function requireLang(input) {
    var lang = input && input.lang;
    if (lang === undefined) return 'en';
    if (!has(LANG_CODES, lang)) throw new TypeError('Invalid lang: must be one of ' + LANG_CODES.join(', '));
    return lang;
  }

  document.modelContext.registerTool(freeze({
    name: 'list_site_pages',
    title: 'List site pages',
    description: 'Pages available on mateowoetam.codeberg.page, a privacy/FOSS consulting and writing site, in a given language (default en).',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        lang: { type: 'string', enum: LANG_CODES, description: 'Language code; defaults to en' }
      })
    }),
    annotations: freeze({ readOnlyHint: true }),
    execute: async function (input) { return PAGE_SUMMARIES[requireLang(input)]; }
  }), opts);

  document.modelContext.registerTool(freeze({
    name: 'get_service_catalog',
    title: 'Get services and prices',
    description: 'Return each consulting service: name, price, summary, and tools used.',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        lang: { type: 'string', enum: LANG_CODES, description: 'Language code; defaults to en' }
      })
    }),
    annotations: freeze({ readOnlyHint: true }),
    execute: async function (input) {
      var lang = requireLang(input);
      var doc = await fetchDoc(LANGS[lang].services);
      return map.call(doc.querySelectorAll('.service-card'), function (card) {
        var h3 = card.querySelector('h3');
        var badge = card.querySelector('.price-badge');
        var sub = card.querySelector('.service-header p');
        var det = card.querySelector(':scope > p');
        return freeze({
          name: h3 ? h3.textContent.trim() : null,
          price: badge ? badge.textContent.trim() : null,
          summary: sub ? sub.textContent.trim() : null,
          details: det ? det.textContent.trim() : null,
          tools: freeze(map.call(card.querySelectorAll('.tag'), function (t) { return t.textContent.trim(); }))
        });
      });
    }
  }), opts);

  document.modelContext.registerTool(freeze({
    name: 'get_article',
    title: 'Read an article',
    description: 'Fetch one of the guides (available in English and Spanish) and return its full text.',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        slug: { type: 'string', enum: ARTICLE_SLUGS, description: 'Article file name without .html' },
        lang: { type: 'string', enum: LANG_CODES, description: 'Language code; defaults to en' }
      }),
      required: freeze(['slug'])
    }),
    annotations: freeze({ readOnlyHint: true }),
    execute: async function (input) {
      var slug = input && input.slug;
      if (!has(ARTICLE_SLUGS, slug)) throw new TypeError('Invalid slug: must be one of ' + ARTICLE_SLUGS.join(', '));
      var lang = requireLang(input);
      var doc = await fetchDoc(LANGS[lang].articlePrefix.replace(/^\//, '') + slug + '.html');
      var article = doc.querySelector('article');
      return freeze({
        lang: lang,
        title: ARTICLE_TITLES[lang][slug],
        text: article ? article.innerText.trim() : null
      });
    }
  }), opts);

  document.modelContext.registerTool(freeze({
    name: 'get_contact',
    title: 'Get contact details',
    description: 'Return email address and GPG fingerprint.',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        lang: { type: 'string', enum: LANG_CODES, description: 'Language code; defaults to en' }
      })
    }),
    annotations: freeze({ readOnlyHint: true }),
    execute: async function (input) {
      var lang = requireLang(input);
      var doc = await fetchDoc(LANGS[lang].contact);
      var mail = doc.querySelector('a[href^="mailto:"]');
      var small = doc.querySelector('.project-card small');
      var fp = small ? small.textContent.replace(/^(Fingerprint|Huella):\s*/, '').replace(/\[.*$/, '').trim() : null;
      return freeze({
        email: mail ? mail.getAttribute('href').replace('mailto:', '') : null,
        gpgFingerprint: fp,
        gpgKeyUrl: 'https://keys.openpgp.org/vks/v1/by-fingerprint/AC91A0AD921E4DE592180965441E486FD756EB4C'
      });
    }
  }), opts);

  document.modelContext.registerTool(freeze({
    name: 'open_page',
    title: 'Navigate the site',
    description: 'Navigate the visible browser to known site pages (keyed by language).',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        page: { type: 'string', enum: freeze(['home', 'services', 'writing', 'contact']), description: 'Which page to open' },
        lang: { type: 'string', enum: LANG_CODES, description: 'Language code; defaults to en' }
      }),
      required: freeze(['page'])
    }),
    annotations: freeze({ readOnlyHint: false, consequentialHint: false }),
    execute: async function (input) {
      var page = input && input.page;
      if (!has(freeze(['home', 'services', 'writing', 'contact']), page)) {
        throw new TypeError('Invalid page: must be one of home, services, writing, contact');
      }
      var lang = requireLang(input);
      location.assign(BASE.replace(/\/$/, '') + LANGS[lang][page]);
      return 'Navigating to ' + page + ' (' + lang + ')';
    }
  }), opts);

  document.modelContext.registerTool(freeze({
    name: 'set_theme',
    title: 'Toggle the site theme',
    description: 'Switch the visible site theme between light and dark by toggling the CSS theme checkbox.',
    inputSchema: freeze({
      type: 'object',
      properties: freeze({
        mode: { type: 'string', enum: freeze(['light', 'dark']) }
      }),
      required: freeze(['mode'])
    }),
    annotations: freeze({ readOnlyHint: false, consequentialHint: false }),
    execute: async function (input) {
      var mode = input && input.mode;
      if (mode !== 'light' && mode !== 'dark') throw new TypeError('Invalid mode: must be "light" or "dark"');
      var cb = document.getElementById('theme-toggle');
      if (!cb) return 'Theme toggle not present on this page.';
      cb.checked = mode === 'dark';
      return 'Theme set to ' + mode + '.';
    }
  }), opts);
})();
// @license-end
