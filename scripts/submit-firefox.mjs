import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const source = join(dist, 'firefox');
const envFile = join(root, '.env');

// Variables already set in the shell win over the .env file.
if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
}
if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
    console.error('Put WEB_EXT_API_KEY and WEB_EXT_API_SECRET in .env (see .env.example), or set them in the shell.');
    process.exit(1);
}
if (!existsSync(join(source, 'manifest.json'))) {
    console.error('No Firefox build in dist/firefox: run npm run build first.');
    process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));

// The listing's default locale is nl, which every language without its own notes falls back to.
const RELEASE_NOTE_LOCALES = ['nl', 'en-US'];
const notesFile = process.env.AMO_RELEASE_NOTES_FILE;
const releaseNotes = notesFile && existsSync(notesFile) ? readFileSync(notesFile, 'utf8').trim() : '';
const metadataArguments = [];
if (releaseNotes !== '') {
    // Written next to dist/firefox, not inside it, so it isn't packed into the add-on.
    const metadataFile = join(dist, 'amo-metadata.json');
    const notes = Object.fromEntries(RELEASE_NOTE_LOCALES.map((locale) => [locale, releaseNotes]));
    writeFileSync(metadataFile, `${JSON.stringify({ version: { release_notes: notes } }, null, 4)}\n`);
    metadataArguments.push(`--amo-metadata=${metadataFile}`);
}

// Submits the build for the public listing and returns without waiting for Mozilla's review.
// web-ext reads the credentials from WEB_EXT_API_KEY and WEB_EXT_API_SECRET itself.
execFileSync(join(root, 'node_modules', '.bin', 'web-ext'), [
    'sign',
    '--channel=listed',
    '--approval-timeout=0',
    ...metadataArguments,
    `--source-dir=${source}`,
    `--artifacts-dir=${dist}`,
], { stdio: 'inherit' });

console.log(`Submitted ${version} to addons.mozilla.org${releaseNotes === '' ? ' without release notes' : ' with release notes'}; it is published once Mozilla approves it.`);
