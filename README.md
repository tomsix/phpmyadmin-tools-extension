<img src="assets/logo.png" alt="" width="96" align="right">

# phpMyAdmin Tools

A browser extension for Chrome and Firefox that lets you move around phpMyAdmin with the keyboard:

- Jump to any database or table by typing part of its name.
- Jump straight to a tab such as Structure or SQL, or to a column's search field.
- Switch to the next or previous tab with a shortcut.
- Search text columns with "contains" (`LIKE %...%`) by default.

It works with phpMyAdmin 5.1 and later, including 6.0. It is not affiliated with the phpMyAdmin project.

## Install

### Firefox (140 or later)

Install phpMyAdmin Tools from its page on addons.mozilla.org:

**[addons.mozilla.org/firefox/addon/phpmyadmin-tools](https://addons.mozilla.org/firefox/addon/phpmyadmin-tools/)**

Click **Add to Firefox** and confirm. Firefox keeps the add-on up to date by itself.

Installed an earlier version from a `.xpi` file on GitHub? Remove it in `about:addons` and install it again from addons.mozilla.org, so you keep getting updates.

### Chrome, Edge and Brave

The extension isn't in the Chrome Web Store, and Chrome only accepts extensions from elsewhere as a folder:

1. Download `phpmyadmin-tools-chrome-<version>.zip` from the newest release on the [releases page](https://github.com/tomsix/phpmyadmin-tools-extension/releases) and unzip it into a folder you keep, such as `~/Extensions/phpmyadmin-tools`. The browser loads the extension from that folder every time it starts, so don't leave it in Downloads.
2. Open `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and choose the folder from step 1.

**Updating:** replace the folder's contents with the new version, then click the reload icon on the extension's card in `chrome://extensions`.

### Check that it works

Open phpMyAdmin (reload the page if it was already open). A small phpMyAdmin Tools button appears at the top right of phpMyAdmin's top bar. Press **⌘K** on a Mac or **Alt+K** on Windows and Linux, or tap **Shift** twice: a search box opens in the middle of the page.

## Jump to a database or table

Press **⌘K** / **Alt+K** or tap **Shift** twice, like Search Everywhere in PhpStorm, and type part of a name. The letters don't have to be next to each other: `wacc` finds `WebshopAccounts`. Without typing anything, you see the tables of the database you're in.

To narrow the search to one database, put a dot between the two names: `shop.ord` finds tables matching `ord` in databases matching `shop`.

| Key | What it does |
| --- | --- |
| `↑` `↓` | Choose a result |
| `↵` Enter | Open the table's data (or the database's structure) |
| `⌥↵` / `Alt+↵` | Open the table's structure |
| `⌘↵` / `Ctrl+↵` | Open it in a new browser tab |
| `⇥` Tab key | Fill in the chosen name, so you can keep typing after it |
| `Esc` | Close |

The list of databases and tables is loaded when you first open the search and kept for 5 minutes. Click the number next to the search box to reload it, for example after creating a table. MySQL's own system databases are listed, but their tables are not.

## Jump to a tab

Type a `/` after a database or table name to see its phpMyAdmin tabs, and keep typing to pick one:

| You type | You get |
| --- | --- |
| `shop/` | the tabs of the `shop` database |
| `shop.orders/` | the tabs of the `orders` table |
| `shop.orders/str` | the `orders` table's Structure tab |
| `/` | the tabs of the page you're on |
| `/sql` | the SQL tab of the page you're on |

Tab names are shown in your phpMyAdmin language (`Structuur`, `Structure`, `Struktur`); typing part of the name is enough.

Shortcut: press the Tab key twice on a result. The first press fills in the name, the second adds the `/`.

## Jump to a column

On a table's Search tab, a second `/` lists the table's columns. Choose one, and the Search tab opens with the cursor in that column's search field, ready to type:

| You type | You get |
| --- | --- |
| `shop.orders/Search/` | every column of the `orders` table |
| `shop.orders/Search/mail` | the `email` column |
| `//mail` | the `email` column of the table you're on |

## Switch tabs

Press **⌥←** / **⌥→** on a Mac, or **Alt+Shift+←** / **Alt+Shift+→** on Windows and Linux, to go to the previous or next tab (Browse, Structure, SQL, …). After the last tab you're back at the first.

The shortcuts don't work while you're typing in a field or in the SQL editor, so they never get in the way of your text. Click outside the field first.

## Search with "contains"

phpMyAdmin's Search tab starts every text column on `LIKE`, which only finds exact matches unless you type `%` yourself. With this extension, text columns start on `LIKE %...%` instead, so typing `mail` finds every value that contains "mail". By default only text columns change (`char`, `varchar` and the `text` types); number, date and other columns, and columns you changed yourself, are left alone.

Which column types change is a list under **Search** in the settings: add a type such as `enum` or `json`, or remove one. Prefer phpMyAdmin's own behaviour everywhere? Choose `LIKE` there instead.

## Settings

Open the settings with the phpMyAdmin Tools button in phpMyAdmin's top bar, or:

- **Chrome, Edge, Brave:** right-click the extension's icon in the toolbar and choose **Options**.
- **Firefox:** open `about:addons`, choose phpMyAdmin Tools and go to **Options**.

You can change:

- **Keyboard shortcuts** for opening the search and switching tabs. Click **Add** and press the keys you want, or tap Shift, Ctrl, Alt or ⌘ twice for a double tap; **×** removes a shortcut and **Reset shortcuts to defaults** brings back the original ones. You can give an action more than one shortcut. A shortcut without Ctrl, Alt or ⌘ only works when you're not typing in a field; a double tap works everywhere, because it types nothing. The keys inside the search box (Enter, the Tab key, the arrows and Esc) can't be changed. Ctrl+K is left to phpMyAdmin, which opens its SQL console with it.
- **Appearance:** light or dark, or follow your computer's setting. This applies to the search box and the settings page; phpMyAdmin itself keeps its own look.
- **Search:** the starting operator for text columns, `LIKE %...%` (contains) or `LIKE`, and the list of column types it applies to. **Reset types to defaults** brings back the six text types.

Changes apply straight away in phpMyAdmin pages that are already open, and they follow you to other computers where you're signed in to the same browser account.

## Privacy

The extension collects nothing and sends nothing to anyone. It only talks to the phpMyAdmin you are logged into. It runs on every website because phpMyAdmin can be installed at any address, but it does nothing on pages that aren't phpMyAdmin.

## Development

Building, releasing, submitting to addons.mozilla.org and the code's design are described in [`CLAUDE.md`](CLAUDE.md) and the files it links in [`.claude/`](.claude/).

## License

MIT — see [LICENSE](LICENSE).
