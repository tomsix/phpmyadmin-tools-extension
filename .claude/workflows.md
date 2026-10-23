# Build, release and workflows

## Versions

Tags and versions are bare semver (`0.3.0`). The released version comes from the release, not from a commit: `scripts/build.mjs` reads `RELEASE_VERSION`, falls back to `package.json` for local builds, and `scripts/submit-firefox.mjs` submits whatever version the build wrote. Never bump `package.json` or `src/manifest.json` in a pull request just to release.

A Firefox version number can be used only once per add-on, listed and unlisted together. Never submit a number that addons.mozilla.org has already seen. Keep a GitHub release for every version on addons.mozilla.org, so the workflow's "higher than the last tag" check also protects Mozilla's numbers: 0.2.2 and 0.2.3 were used there without a GitHub release, and 0.2.4 is both the first public version and the latest tag.

## Distribution

- **Firefox:** only through the public listing at https://addons.mozilla.org/firefox/addon/phpmyadmin-tools/. Never sign self-distributed (unlisted) versions again, and never attach a Firefox file to a GitHub release.
- **Chrome, Edge, Brave:** the Chrome zip on the GitHub release, loaded unpacked.

`npm run submit:firefox` submits `dist/firefox` for the listing (`web-ext sign --channel=listed --approval-timeout=0`) and returns without waiting for Mozilla's review; the version goes live once a reviewer approves it. With `AMO_RELEASE_NOTES_FILE` set it also sends that file's text as the version's release notes (`--amo-metadata`), under `nl` (the listing's default locale, which every other language falls back to) and `en-US`. The release workflow writes that file from the merged pull requests' titles as plain text, leaving out pull requests by bots such as Dependabot; the GitHub notes keep them. The listing's summary, description and screenshots are never sent: they are changed by hand on addons.mozilla.org. It reads `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` from the shell or from `.env` (template: `.env.example`; `.env` is git-ignored).

## GitHub workflows

One file per workflow in `.github/workflows/`, each with `workflow_dispatch` so it can also be started by hand:

- `test.yml` — every pull request and push to `main`: syntax check, build, lint. Its job name `Syntax, build and lint` is the required status check on `main`.
- `build.yml` — every push to `main`: uploads the zips as a 30-day artifact. It never submits anything: every submitted version needs its own number.
- `release.yml` — by hand only, from `main` (the job refuses other refs, so a branch's copy of the workflow can't reach the secrets). Input: `version`, `prerelease`. Order: require a passing `Syntax, build and lint` check run on the `main` commit being released (missing, running or failed → stop) → check the version is new and higher → collect the pull requests merged since the last tag as `## Updates` notes (none → stop) → build and lint with `RELEASE_VERSION` → draft release with the Chrome zip on the built commit → submit the Firefox build to addons.mozilla.org (skipped for a pre-release, because every listed version reaches all users) → publish the GitHub release.

Keep the submission after everything that can fail on GitHub's side, with only the publish step after it: a submitted number is used up at Mozilla, so a re-run after the submission fails there. A re-run before it replaces a leftover draft of the same version.

Workflows never push to `main`. The repository is personal, so the `main` ruleset (pull request required, `Syntax, build and lint` must pass, no force-push or deletion) can't exempt GitHub Actions.

Repository secrets: `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`. Setting them is the user's job (`gh secret set --env-file .env`).

Pin actions to their current major version (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`) and run on Node 24.
