import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const source = join(dist, 'firefox');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
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

const before = new Set(readdirSync(dist));
// web-ext reads the credentials from WEB_EXT_API_KEY and WEB_EXT_API_SECRET itself.
execFileSync(join(root, 'node_modules', '.bin', 'web-ext'), [
    'sign',
    '--channel=unlisted',
    `--source-dir=${source}`,
    `--artifacts-dir=${dist}`,
], { stdio: 'inherit' });

const signed = readdirSync(dist).find((file) => file.endsWith('.xpi') && !before.has(file));
if (signed === undefined) {
    console.error('web-ext finished without writing a new .xpi to dist/.');
    process.exit(1);
}
const target = `phpmyadmin-tools-firefox-${version}.xpi`;
renameSync(join(dist, signed), join(dist, target));
console.log(`Signed dist/${target}`);
