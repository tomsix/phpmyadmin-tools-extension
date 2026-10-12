# phpMyAdmin Tools

A Chrome and Firefox extension that adds quality-of-life features to phpMyAdmin 5.1 and later.

## Quick jump

Press **⌘K** (macOS) or **Alt+K** (Windows/Linux) on any phpMyAdmin page to open a palette that fuzzy-searches every database and table on the server.

| Key | Action |
| --- | --- |
| `↵` | Browse the table (or open the database's structure) |
| `⌥↵` / `Alt↵` | Open the table's structure |
| `⌘↵` / `Ctrl↵` | Open in a new tab |
| `↑` `↓` | Move the selection |
| `⇥` | Complete the search to the selected item (`db.table`, or `db.` for a database) |
| `esc` | Close |

Type `shop.ord` to narrow to tables matching `ord` in databases matching `shop`. With an empty query the palette lists the current database's tables, then every database.

The index is built through phpMyAdmin's own `/databases` and `/tables` AJAX routes, using the session and token of the open page. It is cached per tab for 5 minutes. Click the counter next to the search field to rebuild it. System schemas are listed as databases, but their tables are not indexed.

## Tab cycling

Press **^** / **$** (AZERTY), **[** / **]** (QWERTY), **⌥←** / **⌥→** (macOS) or **Alt+Shift+←** / **Alt+Shift+→** (Windows/Linux) to move to the previous or next tab of the current table, database or server (Browse, Structure, SQL, …), wrapping around at either end. Tabs collapsed into phpMyAdmin's *More* menu are included. The bare keys match the key's position, not its character, so they need no modifier on either layout. The shortcuts are ignored while typing in a field or the SQL editor — but not in a field the page focused on its own, like the SQL tab's editor, until you click or type in it.

Ctrl+K is left alone because phpMyAdmin uses it to toggle the SQL console.

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
