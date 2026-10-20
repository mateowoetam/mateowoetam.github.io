// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/* Persist the theme toggle across pages (progressive enhancement).
 * Stores the intended theme ("light"/"dark") in localStorage and mirrors
 * it onto the CSS-only #theme-toggle checkbox, mapping through the current
 * prefers-color-scheme so the choice survives OS theme changes too.
 * Without this script the site simply follows the system preference.
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

  var cb = document.getElementById('theme-toggle');
  if (!cb) return;

  var storage = null;
  try { storage = window.localStorage; } catch (e) { /* storage blocked; system default only */ }

  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  /* checkbox checked means: system-light ? dark : light (see style.css) */
  function checkedToTheme(checked) {
    return systemPrefersLight() ? (checked ? 'dark' : 'light') : (checked ? 'light' : 'dark');
  }

  if (storage) {
    var saved = null;
    try { saved = storage.getItem('theme'); } catch (e) { /* ignore */ }
    if (saved === 'light' || saved === 'dark') {
      cb.checked = systemPrefersLight() ? (saved === 'dark') : (saved === 'light');
    }

    cb.addEventListener('change', function () {
      try { storage.setItem('theme', checkedToTheme(cb.checked)); } catch (e) { /* ignore */ }
    });
  }
})();
// @license-end
