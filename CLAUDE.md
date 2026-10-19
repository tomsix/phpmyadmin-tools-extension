# CLAUDE.md

phpMyAdmin Tools is a Manifest V3 browser extension for Chrome and Firefox that adds keyboard navigation to phpMyAdmin 5.1 and later, including 6.0: a ⌘K / Alt+K palette for databases, tables, tabs and columns, shortcuts to cycle through tabs, and a `LIKE %...%` default on the Search tab. There is no framework and no bundler: the files in `src/` ship as they are.

@.claude/architecture.md
@.claude/workflows.md

## Commands

```bash
npm install            # web-ext, pinned as a dev dependency
npm run build          # dist/chrome, dist/firefox and a zip of each
npm run lint           # Mozilla's linter on dist/firefox
npm run submit:firefox # submit dist/firefox to addons.mozilla.org (needs .env)
```

Check the syntax after every edit: `for file in src/*.js scripts/*.mjs; do node --check "$file"; done`.

## Ground rules

- `main` only changes through pull requests; work on a branch.
- Every change must work on phpMyAdmin 5.x **and** 6.x. Check both before calling it done: the 6.0 development demo is at `https://demo.phpmyadmin.net/master-config/public/`, and 5.2's source is a good reference for its markup and routes.
- The user interface (palette, options page, messages) is in English.
- Never read, print or write `.env` or any other secret. The user fills in `.env` and the repository secrets.
