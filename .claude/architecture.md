# Architecture

## Files

- `src/manifest.json` — the shared manifest. Per-browser differences live only in the `targets` of `scripts/build.mjs`: Chrome gets `background.service_worker`, Firefox `background.scripts` plus `browser_specific_settings.gecko` (id `phpmyadmin-tools@netwerk64.be`, `strict_min_version` 140, `data_collection_permissions: none`).
- Content scripts, loaded in this order and sharing one scope through their `var` globals: `shortcuts.js` (`PMA_TOOLS_SHORTCUTS`), `preferences.js` (`PMA_TOOLS_PREFERENCES`), `palette-styles.js` (`PMA_TOOLS_PALETTE_CSS`), `snippets.js` (`PMA_TOOLS_SNIPPETS`), `content.js`. A new shared module gets the same `var PMA_TOOLS_…` pattern and a place in the manifest list before `content.js`.
- `background.js` — only opens the options page on an `open-options` message; content scripts can't call `openOptionsPage()`.
- `options.html` / `options.js` — the options page, two ARIA tabs: *Snippets* first, then *Settings* with one `<section>` and `h2` per group (Keyboard shortcuts, Appearance, Search). The selected tab is in the address (`#settings`), so a reload keeps it. Extension pages allow no inline script.
- `icons/` — cut from `assets/logo.png` (transparent background). `assets/logo-on-white.png` is for store listings.

Never add Firefox for Android support (`gecko_android`), and never publish a `.crx`: Chrome blocks off-store `.crx` files, so Chrome users load the zip unpacked.

## Detecting phpMyAdmin

`content.js` runs on `<all_urls>` and returns at once unless the page has `#pma_navigation` and an inline `CommonParams.setAll({…})` script.

`readCommonParams()` must keep reading both formats: phpMyAdmin 5 writes a JavaScript object literal with unquoted keys (`{server:"1",db:""}`), 6 writes JSON with a numeric `server`. The object is cut out with `extractObjectLiteral()` (brace matching that skips strings), never by searching for `});`, which 6 doesn't write.

## Talking to phpMyAdmin

Only through phpMyAdmin's own routes, on the page's origin, with its session:

- `POST index.php?route=/databases` → `databases` (an object in 5.2, so read it with `asList()`).
- `POST index.php?route=/tables` with `db` → `tables`. With `db` and `table`, its `menu` is that table's tab bar; with `db` alone, the database's.
- `GET` the table's Search tab url with `ajax_request=true` → `message` holds the search form. Column names are `input[name="criteriaColumnNames[i]"]`, the value fields `[name="criteriaValues[i]"]`, the operators `select[name="criteriaColumnOperators[i]"]`, the column types (lowercase MySQL types such as `varchar(255)`) `input[name="criteriaColumnTypes[i]"]`. The default `LIKE %...%` is applied only where the column's base type (`baseColumnType()`: `varchar(255)` → `varchar`) is in the `likeColumnTypes` preference: phpMyAdmin offers `LIKE` on number and date columns too, so the option list alone doesn't identify a text column.
- `GET` `index.php?route=/table/structure` with `db`, `table` and `ajax_request=true` → `message` holds the Structure tab. The primary key columns are the `input[name="selected_fld[]"]` whose `label[for]` holds the `.ic_b_primary` icon, the same in every language and theme.
- A query goes into an SQL tab (`/table/sql`, `/database/sql`, `/server/sql`) and is run (`/sql`) only by a POST form with `sql_query` and the token: phpMyAdmin ignores a `sql_query` in the url unless phpMyAdmin signed it. `submitForm()` builds the form and submits it, with `target="_blank"` for a new browser tab.

Every POST sends `ajax_request`, `server` and the token from `input[name="token"]` (falling back to `CommonParams`). Requests go through `pageFetch`, which is `content.fetch` in Firefox so the request carries the page's origin.

Identify a tab by its url's `route` parameter (`/table/search`), never by its label: labels follow the user's phpMyAdmin language. Read tab bars with `TAB_LINK_SELECTOR`, which includes tabs folded into the *More* dropdown and skips its toggle.

## Palette search

`search()` splits the query on `/`: no slash → databases and tables (`db.table` narrows both), one → tabs of a target, two → columns of a table's Search tab. An empty target means the current page: its tabs are read from the page itself, not fetched. Tabs and columns are fetched once per target and cached in `tabCache` / `columnCache`.

## Keyboard

- Shortcuts are matched on `event.code` (key position), so a binding works on QWERTY and AZERTY. Defaults live in `PMA_TOOLS_SHORTCUTS.DEFAULTS`; users change them on the options page.
- Don't use the browser `commands` API: those shortcuts are global and would take ⌘K and ⌥← from every website. Leave Ctrl+K alone: phpMyAdmin toggles its SQL console with it.
- `isTyping()` ignores shortcuts while the user types in a field, but not in a field the page focused on its own (the SQL tab's editor): `isFocusUserDriven` only turns true after a click or a key press.
- The palette's host stops key events from reaching phpMyAdmin's single-key shortcuts on `document`.
- A binding with `double: true` is a double tap of the modifier in its `code` (`Shift`, `Control`, `Alt`, `Meta`): pressed and released alone twice within 400 ms, nothing in between. `createDoubleTapDetector()` in `shortcuts.js` recognises it for both the content script and the options page; in `content.js` its listeners are registered before the other key listeners, which stop the events they handle. A double tap types nothing, so it also works while typing; switching tabs still waits until the user isn't typing.
- The keys inside the palette (Enter, Tab, arrows, Esc) are fixed.

## Snippets

A snippet is `{ id, name, sql }`, stored as one list under `snippets` in `storage.sync` by `PMA_TOOLS_SNIPPETS` (`snippets.js`), not as a preference: it isn't a choice or a list of names. `storage.sync` keeps about 8 KB per key, so the options page reports a quota error instead of losing the change.

`{db}`, `{table}` and `{pk}` are replaced by `fill()` with the names as they are; the snippet's author adds backticks. `needs()` says what a snippet requires: a snippet is only listed for a target that names its database and, for `{table}` or `{pk}`, its table. The primary key is fetched when the snippet is listed and cached per table in `primaryKeyCache`; a table without one gets a notice in the palette instead of a half-filled query.

In the palette, snippets join the database and table results for the current page once something is typed, and follow the tabs after a `/` for that target. Enter fills the target's SQL tab, Alt+Enter (the alternate action that opens a table's structure elsewhere) runs the query, Cmd/Ctrl+Enter opens a new tab.

## Settings

Every preference is declared once in `PMA_TOOLS_PREFERENCES.DEFINITIONS` and stored in `storage.sync`: either a choice (`values` plus `fallback`), or a list of names (`list: true` plus a `fallback` list, cleaned by `normalizeName()`; an empty list is kept, a missing or corrupt one falls back). Open tabs follow changes through `onChange`. A new choice is one definition, one radio group in its `options.html` section and one entry in the loop in `options.js`; a list has its own editor block in `options.js`, like `likeColumnTypes`.

The theme is applied as `data-theme` (`light` / `dark`, absent for system) on the palette's shadow host and on the options page's root. Each stylesheet defines its dark colours twice: under `prefers-color-scheme: dark` with `:not([data-theme="light"])`, and under `[data-theme="dark"]`.

## Security

- Never assign dynamic values to `innerHTML`. Parse phpMyAdmin's HTML with `DOMParser` (inert), build the palette with `createElement` and `textContent`.
- The palette lives in a closed shadow root, so phpMyAdmin's styles and scripts can't reach it.
- Only `icons/icon-32.png` is in `web_accessible_resources`.
