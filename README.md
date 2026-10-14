<img src="assets/logo.png" alt="" width="96" align="right">

# phpMyAdmin Tools

A Chrome and Firefox extension that adds quality-of-life features to phpMyAdmin 5.1 and later, including 6.0.

## Quick jump

Press **⌘K** (macOS) or **Alt+K** (Windows/Linux) — or [your own shortcut](#changing-the-shortcuts) — on any phpMyAdmin page to open a palette that fuzzy-searches every database and table on the server.

| Key | Action |
| --- | --- |
| `↵` | Browse the table (or open the database's structure) |
| `⌥↵` / `Alt↵` | Open the table's structure |
| `⌘↵` / `Ctrl↵` | Open in a new tab |
| `↑` `↓` | Move the selection |
| `⇥` | Complete the search to the selected item (`db.table`, or `db.` for a database); press it again to list that item's tabs |
| `esc` | Close |

Type `shop.ord` to narrow to tables matching `ord` in databases matching `shop`. Add a `/` to list a database's or table's tabs: `shop/` shows the tabs of the `shop` database, `shop.orders/` those of its `orders` table, and `shop.orders/str` narrows them to Structure. A `/` on its own lists the tabs of the page you are on: the current table's, the current database's, or the server's on the home page. Pressing Tab twice on a result gets you there: once to complete the name, once to add the `/`. On a table's Search tab, a second `/` lists its columns: `shop.orders/Search/mail` opens the Search tab with the cursor in the `email` column's field, and `//mail` does the same for the table you are on. Tab names follow your phpMyAdmin language (`Zoeken`, `Rechercher`), but any part of the name works. With an empty query the palette lists the current database's tables, then every database.

The index is built through phpMyAdmin's own `/databases` and `/tables` AJAX routes, using the session and token of the open page. It is cached per tab for 5 minutes. Click the counter next to the search field to rebuild it. System schemas are listed as databases, but their tables are not indexed.

## Tab cycling

Press **⌥←** / **⌥→** (macOS) or **Alt+Shift+←** / **Alt+Shift+→** (Windows/Linux) by default, to move to the previous or next tab of the current table, database or server (Browse, Structure, SQL, …), wrapping around at either end. Tabs collapsed into phpMyAdmin's *More* menu are included. The shortcuts are ignored while typing in a field or the SQL editor — but not in a field the page focused on its own, like the SQL tab's editor, until you click or type in it. To jump to one specific tab, type `/` in the palette instead.

## Changing the shortcuts

The shortcuts to open the palette and to go to the previous or next tab can be changed on the extension's options page:

- **Chrome, Edge, Brave:** right-click the extension's icon and choose **Options**, or open **Details → Extension options** in `chrome://extensions`.
- **Firefox:** open `about:addons`, choose phpMyAdmin Tools and go to the **Options** tab.

Each action can have several key combinations. Click **Add** and press the combination; **×** removes one, and **Reset to defaults** restores the ones above. A combination that is already used by another action is refused. Shortcuts are matched by key position, like the defaults, and one without Ctrl, Alt or ⌘ is ignored while you type in a field. The settings are saved with your browser profile's sync storage, and open phpMyAdmin tabs pick up a change immediately. The keys inside the palette (Enter, Tab, the arrows and Esc) are fixed.

## Search operator

phpMyAdmin's Search tab always starts a text column on `LIKE`, which only finds exact matches unless you type the `%` yourself, and phpMyAdmin has no setting to change that. The extension switches text columns to `LIKE %...%` (contains) when the Search tab opens. Choose `LIKE` under **Search** on the options page to keep phpMyAdmin's default. A column you already set yourself, and number or date columns, are left alone.

## Appearance

The quick jump palette and the options page follow the system or browser's light or dark setting. To always use one of the two, choose **Light** or **Dark** under **Appearance** on the options page; open phpMyAdmin tabs switch immediately. phpMyAdmin's own pages keep their theme.

The default ⌘K / Alt+K leaves Ctrl+K alone, because phpMyAdmin uses it to toggle the SQL console.

## Install

Download the file for your browser from the newest release on the [releases page](https://github.com/tomsix/phpmyadmin-tools-extension/releases): `phpmyadmin-tools-firefox-<version>.xpi` for Firefox, `phpmyadmin-tools-chrome-<version>.zip` for Chrome, Edge and Brave.

### Firefox

The `.xpi` is signed by Mozilla, so Firefox installs it permanently:

1. Open the downloaded `phpmyadmin-tools-firefox-<version>.xpi` in Firefox: drag it onto a Firefox window, or choose **Install Add-on From File…** under the gear icon in `about:addons`.
2. Confirm **Add**.
3. Open a phpMyAdmin page and press ⌘K / Alt+K. A phpMyAdmin tab that was already open needs a reload first.

Firefox updates the add-on from addons.mozilla.org once a newer version is listed there.

### Chrome, Edge and Brave

Chrome only installs extensions from outside the Chrome Web Store as an unpacked folder:

1. Unzip `phpmyadmin-tools-chrome-<version>.zip` into a folder you keep, such as `~/Extensions/phpmyadmin-tools`. The browser loads the extension from that folder every time it starts, so don't unzip it into Downloads and delete it afterwards.
2. Open `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave).
3. Turn on **Developer mode** in the top-right corner.
4. Choose **Load unpacked** and select the folder from step 1, the one that holds `manifest.json`.
5. Open a phpMyAdmin page and press ⌘K / Alt+K. A phpMyAdmin tab that was already open needs a reload first.

**Updating:** replace the folder's contents with the new release, then click the reload icon on the extension's card in `chrome://extensions`.

### From source

```bash
npm install
npm run build
npm run lint
```

`npm run build` writes `dist/chrome/` and `dist/firefox/`, plus a zip of each, named after the version in `package.json`. Load `dist/chrome` as above, or `dist/firefox/manifest.json` through **Load Temporary Add-on…** in `about:debugging#/runtime/this-firefox` (removed again when Firefox restarts). The two builds differ only in their manifest: how the background script is declared, and Firefox's `browser_specific_settings` block. `npm run lint` checks the Firefox build with Mozilla's own linter.

### Signing the Firefox build

Put your addons.mozilla.org credentials in a `.env` file in the project root (copy `.env.example`). Git ignores `.env`, so the values never reach the repository:

```
WEB_EXT_API_KEY=user:12345:67
WEB_EXT_API_SECRET=…
```

Then run:

```bash
npm run sign:firefox
```

Variables already set in your shell take precedence over `.env`.

This signs `dist/firefox` as a self-distributed (unlisted) version of the add-on on addons.mozilla.org and writes `dist/phpmyadmin-tools-firefox-<version>.xpi`. The credentials are the JWT issuer and secret from **Manage API Keys** in the addons.mozilla.org Developer Hub. Keep them out of the repository. A version number can be used only once per add-on, listed and unlisted together, so a signed `.xpi` needs a version that was never submitted for the listing.

## Workflows

Each GitHub Actions workflow has its own file in `.github/workflows/`, and each can also be started by hand under **Actions → (workflow) → Run workflow**.

- **Test** (`test.yml`) runs on every pull request and every push to `main`: it checks the JavaScript syntax, builds both browsers and lints the Firefox build.
- **Build** (`build.yml`) runs after every merge into `main` and attaches the Chrome and Firefox zips to the run as an artifact, kept for 30 days. They are unsigned, because every signed Firefox version needs its own version number.
- **Release** (`release.yml`) only runs by hand. Give it a version (`0.3.0`) and choose whether it is a pre-release. It checks that the version is new and higher than the last release, collects the pull requests merged into `main` since then as the release notes (and stops when there are none), sets the version, builds, lints, signs the Firefox build, pushes the version commit to `main` and publishes the GitHub release with the signed `.xpi` and both zips.

The release needs the addons.mozilla.org credentials as repository secrets `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` (**Settings → Secrets and variables → Actions**). With them in your local `.env`, `gh secret set --env-file .env` copies both. When `main` is a protected branch, allow GitHub Actions to push to it, or the version commit fails.

## How it detects phpMyAdmin

The content script runs on every page, because phpMyAdmin lives on arbitrary hosts. It stops immediately unless the page has both `#pma_navigation` and the inline `CommonParams.setAll({…})` script, so nothing is added to other sites.

## License

MIT — see [LICENSE](LICENSE).
