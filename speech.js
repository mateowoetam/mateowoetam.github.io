// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/*
Read-aloud for article pages (Web Speech API, speech synthesis only).

Progressive enhancement: nothing is shown unless the browser supports
speechSynthesis AND has an on-device voice for the page language.
Remote/cloud voices (voice.localService === false) are never used: they
send the text to the voice vendor's servers, which would break this site's
no-third-party-requests promise. Speech recognition is deliberately not
used (it needs the microphone and, in most browsers, a cloud service).

Reads one block (heading, paragraph, list item) at a time and highlights
it, which also avoids Chromium's habit of cutting off long utterances.

HardenedJS rules (https://hardenedjs.org/), same as webmcp.js: strict mode,
captured intrinsics, no writes to globals or to shared prototypes, own
records frozen, host objects left alone.

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

  var synth = globalThis.speechSynthesis;
  var UtteranceCtor = globalThis.SpeechSynthesisUtterance;
  var article = document.querySelector('main article');
  if (!synth || typeof UtteranceCtor !== 'function' || !article) return;

  /* ---- captured intrinsics ------------------------------------------ */
  var FnProto = Function.prototype;
  var uncurryThis = FnProto.bind.bind(FnProto.call);
  var freeze = Object.freeze;
  var filter = uncurryThis(Array.prototype.filter);
  var arrayFrom = Array.from;
  var toLowerCase = uncurryThis(String.prototype.toLowerCase);
  var split = uncurryThis(String.prototype.split);
  var trim = uncurryThis(String.prototype.trim);
  var replace = uncurryThis(String.prototype.replace);
  var getVoices = uncurryThis(synth.getVoices);
  var speak = uncurryThis(synth.speak);
  var cancel = uncurryThis(synth.cancel);
  var addEvt = uncurryThis(EventTarget.prototype.addEventListener);
  var classAdd = uncurryThis(DOMTokenList.prototype.add);
  var classRemove = uncurryThis(DOMTokenList.prototype.remove);
  var setAttribute = uncurryThis(Element.prototype.setAttribute);
  var textContentGet = uncurryThis(Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get);
  var matchMedia = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia.bind(globalThis) : null;

  var LABELS = freeze({
    en: freeze({ play: '[ ▶ LISTEN ]', stop: '[ ■ STOP ]', group: 'Read this article aloud' }),
    es: freeze({ play: '[ ▶ ESCUCHAR ]', stop: '[ ■ DETENER ]', group: 'Leer este artículo en voz alta' }),
    eo: freeze({ play: '[ ▶ AŬSKULTI ]', stop: '[ ■ HALTI ]', group: 'Laŭtlegi ĉi tiun artikolon' })
  });

  var pageLang = toLowerCase(split(document.documentElement.lang || 'en', '-')[0]);
  var labels = LABELS[pageLang] || LABELS.en;

  /* State lives only in this closure. */
  var state = { voice: null, blocks: null, index: 0, playing: false, button: null };

  function pickVoice() {
    var voices = filter(getVoices(synth) || [], function (v) {
      return v.localService === true &&
        toLowerCase(split(replace(v.lang || '', '_', '-'), '-')[0]) === pageLang;
    });
    if (!voices.length) return null;
    var preferred = filter(voices, function (v) { return v.default; });
    return preferred.length ? preferred[0] : voices[0];
  }

  function readableBlocks() {
    var nodes = arrayFrom(article.querySelectorAll('h2, h3, h4, p, li, blockquote, td, th'));
    return freeze(filter(nodes, function (el) {
      /* skip containers whose text is read via a nested block, and empty ones */
      if (el.querySelector('p, li')) return false;
      return trim(textContentGet(el)) !== '';
    }));
  }

  function clearHighlight() {
    if (state.blocks && state.blocks[state.index]) classRemove(state.blocks[state.index].classList, 'tts-current');
  }

  function stop() {
    state.playing = false;
    clearHighlight();
    cancel(synth);
    render();
  }

  function speakNext() {
    if (!state.playing) return;
    if (state.index >= state.blocks.length) { stop(); state.index = 0; return; }
    var el = state.blocks[state.index];
    classAdd(el.classList, 'tts-current');
    var reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });

    var u = new UtteranceCtor(replace(textContentGet(el), /\s+/g, ' '));
    u.voice = state.voice;
    u.lang = state.voice.lang;
    var advance = function () {
      if (!state.playing) return;
      classRemove(el.classList, 'tts-current');
      state.index += 1;
      speakNext();
    };
    addEvt(u, 'end', advance);
    addEvt(u, 'error', function (e) {
      /* 'interrupted'/'canceled' come from our own stop(); anything else: skip the block */
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      advance();
    });
    speak(synth, u);
  }

  function render() {
    var b = state.button;
    if (!b) return;
    b.textContent = state.playing ? labels.stop : labels.play;
    setAttribute(b, 'aria-pressed', state.playing ? 'true' : 'false');
  }

  function toggle() {
    if (state.playing) { stop(); return; }
    cancel(synth); /* clear anything queued by another tab or page */
    state.blocks = readableBlocks();
    if (state.index >= state.blocks.length) state.index = 0;
    state.playing = true;
    render();
    speakNext();
  }

  function mount() {
    if (state.button) return;
    state.voice = pickVoice();
    if (!state.voice) return; /* no on-device voice for this language: show nothing */

    var wrap = document.createElement('div');
    wrap.className = 'tts-controls';
    setAttribute(wrap, 'role', 'group');
    setAttribute(wrap, 'aria-label', labels.group);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn tts-btn';
    setAttribute(btn, 'lang', pageLang);
    state.button = btn;
    render();
    addEvt(btn, 'click', toggle);
    wrap.appendChild(btn);
    article.parentNode.insertBefore(wrap, article);

    addEvt(globalThis, 'pagehide', function () { if (state.playing) stop(); });
    addEvt(document, 'keydown', function (e) {
      if (e.key === 'Escape' && state.playing) stop();
    });
  }

  /* Voices often load asynchronously (always in Chromium). */
  mount();
  if (!state.button) addEvt(synth, 'voiceschanged', mount);
})();
// @license-end
