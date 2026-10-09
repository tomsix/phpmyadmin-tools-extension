import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = { ...JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')), version };

const targets = {
    chrome: manifest,
    firefox: {
        ...manifest,
        browser_specific_settings: {
            gecko: {
                id: 'phpmyadmin-plus@webatvantage.be',
                strict_min_version: '115.0',
            },
        },
    },
};

rmSync(dist, { recursive: true, force: true });

for (const [browser, targetManifest] of Object.entries(targets)) {
    const output = join(dist, browser);
    mkdirSync(output, { recursive: true });
    cpSync(source, output, { recursive: true, filter: (path) => !path.endsWith('manifest.json') });
    writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(targetManifest, null, 4)}\n`);
    execFileSync('zip', ['-qr', join(dist, `phpmyadmin-plus-${browser}-${version}.zip`), '.'], { cwd: output });
    console.log(`Built dist/${browser} and dist/phpmyadmin-plus-${browser}-${version}.zip`);
}
