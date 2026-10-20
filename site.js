// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/* Progressive enhancement: GPG fingerprint copy button (contact.html).
 * The button stays hidden unless this script runs and the clipboard API exists.
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

  var btn = document.getElementById('copy-gpg');
  if (!btn || !navigator.clipboard || !navigator.clipboard.writeText) return;

  btn.hidden = false;
  btn.addEventListener('click', function () {
    navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
      var original = btn.textContent;
      btn.textContent = '[ COPIED ]';
      setTimeout(function () { btn.textContent = original; }, 2000);
    }, function () { /* clipboard denied; fingerprint remains selectable */ });
  });
})();
// @license-end
