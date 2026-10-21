// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later
/*
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512


Persist the theme toggle across pages (progressive enhancement).
Stores the intended theme ("light"/"dark") in localStorage and mirrors
it onto the CSS-only #theme-toggle checkbox, mapping through the current
prefers-color-scheme so the choice survives OS theme changes too.
Without this script the site simply follows the system preference.

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
-----BEGIN PGP SIGNATURE-----

iQIzBAEBCgAdFiEE/aHB1Mmfl4E6u2IvBU5mQdG/KXUFAmrY3iUACgkQBU5mQdG/
KXVMJg//dw8gbD9RdNvPf6SgCaGveXEjTf3+h9HIKVPG7GlwaycoBTlRD0V6HUIh
Daa+wfABXbI0FVUHjpka7kHH+h6afyqGIqeXopPZxuqvI81VK1l/B5RDrpxHZLzB
GVxCGZwIvp54Lx1Da50WWengKuR70596SHjTgcQTgtxJj6zu3bzWnCxVHj6kc6hV
yJCEKjGQpGZtSJdbb+1yWgV5IQoXaDVEQzHo/zbzVY4zxm/94dX5WHG3QFnfHAGI
qi3T3weAwHMBoxAQKkL8SpItX7nSG+JTXdgPDMLYnmukli8u0wGM5zWSUcCbh1A0
c4kJoV5vfv5VLhBKtJx7NuRXj1FXiZbo4dSLbOIxS6AyNaqEpC8Jmcr8vNmkCJlA
fSiK5QCylLRz7uRrZbaSyzTWQbBHYoY97Yo0rNXUVyXw4bYyXtx04gaTLuRrERz5
+Rzw2FiWolv+3XlB+F1Uy+le/dvn3p+isuV4BThJN7VJ8uIrPC7fOA7pf0wHJEkW
r1+/AXxkao/AD2a9+nJjsZgOepXeT/lAa5QHR9vwb1HLInpb07kx1NoeSxybC4uH
2/RN2bucR62QFTesOYv/6aXC6qZUGDpk8YOzzjGzYAiiLr6hjUou+w80kL8PX6FX
AEh4dWlsgG1TsrNCEd+8vL0wIAgLrhvWY0RRQR6sbl4ThfCN9yY=
=o2PM
-----END PGP SIGNATURE-----
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
