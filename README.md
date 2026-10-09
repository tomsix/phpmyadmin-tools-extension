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

## Build

```bash
npm run build
```

This writes `dist/chrome/` and `dist/firefox/`, plus a zip of each. The only difference between them is the Firefox `browser_specific_settings` block. No dependencies are needed beyond Node and `zip`.

## Install

**Chrome / Edge / Brave:** open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked* and select `dist/chrome`.

**Firefox:** open `about:debugging#/runtime/this-firefox`, choose *Load Temporary Add-on…* and select `dist/firefox/manifest.json`. A temporary add-on is removed when Firefox restarts. A permanent install needs the zip signed as an unlisted add-on on addons.mozilla.org, or a Developer Edition / Nightly build with `xpinstall.signatures.required` set to `false`.

## How it detects phpMyAdmin

The content script runs on every page, because phpMyAdmin lives on arbitrary hosts. It stops immediately unless the page has both `#pma_navigation` and the inline `CommonParams.setAll({…})` script, so nothing is added to other sites.
