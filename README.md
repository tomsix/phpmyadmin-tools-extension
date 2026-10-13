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

Download the zip for your browser from the newest release on the [releases page](https://github.com/tomsix/phpmyadmin-tools-extension/releases): `phpmyadmin-tools-chrome-<version>.zip` or `phpmyadmin-tools-firefox-<version>.zip`.

### Chrome, Edge and Brave

1. Unzip `phpmyadmin-tools-chrome-<version>.zip` into a folder you keep, such as `~/Extensions/phpmyadmin-tools`. The browser loads the extension from that folder every time it starts, so don't unzip it into Downloads and delete it afterwards.
2. Open `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave).
3. Turn on **Developer mode** in the top-right corner.
4. Choose **Load unpacked** and select the folder from step 1, the one that holds `manifest.json`.
5. Open a phpMyAdmin page and press ⌘K / Alt+K. A phpMyAdmin tab that was already open needs a reload first.

**Updating:** replace the folder's contents with the new release, then click the reload icon on the extension's card in `chrome://extensions`.

### Firefox

Release builds of Firefox only keep signed add-ons, so a manual install lasts until Firefox restarts:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `phpmyadmin-tools-firefox-<version>.zip`. There is no need to unzip it.
3. Open a phpMyAdmin page and press ⌘K / Alt+K.

For a permanent install, use the add-on from addons.mozilla.org. On Firefox Developer Edition or Nightly you can instead set `xpinstall.signatures.required` to `false` in `about:config`, rename the zip to `.xpi` and install it through **Install Add-on From File…** in `about:addons`.

### From source

```bash
npm run build
```

This writes `dist/chrome/` and `dist/firefox/`, plus a zip of each, named after the version in `package.json`. Load `dist/chrome` or `dist/firefox/manifest.json` as above. The two builds differ only in the Firefox `browser_specific_settings` block, and nothing is needed beyond Node and `zip`.

## How it detects phpMyAdmin

The content script runs on every page, because phpMyAdmin lives on arbitrary hosts. It stops immediately unless the page has both `#pma_navigation` and the inline `CommonParams.setAll({…})` script, so nothing is added to other sites.

## License

MIT — see [LICENSE](LICENSE).
