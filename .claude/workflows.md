# Build, release and workflows

## Versions

Tags and versions are bare semver (`0.3.0`). The released version comes from the release, not from a commit: `scripts/build.mjs` and `scripts/sign-firefox.mjs` read `RELEASE_VERSION` and fall back to `package.json` for local builds. Never bump `package.json` or `src/manifest.json` in a pull request just to release.

A Firefox version number can be used only once per add-on, listed and unlisted together. Never sign or submit a number that addons.mozilla.org has already seen.

## Signing

`npm run sign:firefox` signs `dist/firefox` as an unlisted version on addons.mozilla.org and writes `dist/phpmyadmin-tools-firefox-<version>.xpi`. It reads `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` from the shell or from `.env` (template: `.env.example`; `.env` is git-ignored). The listed version on addons.mozilla.org is submitted by hand with the Firefox zip.

## GitHub workflows

One file per workflow in `.github/workflows/`, each with `workflow_dispatch` so it can also be started by hand:

- `test.yml` — every pull request and push to `main`: syntax check, build, lint. Its job name `Syntax, build and lint` is the required status check on `main`.
- `build.yml` — every push to `main`: uploads the unsigned zips as a 30-day artifact. It never signs: every signed version needs its own number.
- `release.yml` — by hand only, from `main` (the job refuses other refs, so a branch's copy of the workflow can't reach the secrets). Input: `version`, `prerelease`. Order: require a passing `Syntax, build and lint` check run on the `main` commit being released (missing, running or failed → stop) → check the version is new and higher → collect the pull requests merged since the last tag as `## Updates` notes (none → stop) → build and lint with `RELEASE_VERSION` → draft release with the zips on the built commit → sign → upload the `.xpi` as an artifact → attach it and publish.

Keep signing after everything that can fail on GitHub's side and before nothing but the upload: a failure after signing burns the version number at Mozilla. A re-run replaces a leftover draft of the same version.

Workflows never push to `main`. The repository is personal, so the `main` ruleset (pull request required, `Syntax, build and lint` must pass, no force-push or deletion) can't exempt GitHub Actions.

Repository secrets: `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`. Setting them is the user's job (`gh secret set --env-file .env`).

Pin actions to their current major version (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`) and run on Node 24.
