import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = { ...JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')), version };
// The key fixes the Chrome extension id, so it must stay the same for every release and never enter the repository.
const crxKey = process.env.PMA_TOOLS_CRX_KEY ?? join(homedir(), '.config', 'phpmyadmin-tools', 'chrome-extension.pem');
const chromeBinary = process.env.CHROME_BINARY ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const targets = {
    chrome: {
        ...manifest,
        background: { service_worker: 'background.js' },
    },
    firefox: {
        ...manifest,
        background: { scripts: ['background.js'] },
        browser_specific_settings: {
            gecko: {
                id: 'phpmyadmin-tools@netwerk64.be',
                strict_min_version: '140.0',
                data_collection_permissions: {
                    required: ['none'],
                },
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
    execFileSync('zip', ['-qr', join(dist, `phpmyadmin-tools-${browser}-${version}.zip`), '.'], { cwd: output });
    console.log(`Built dist/${browser} and dist/phpmyadmin-tools-${browser}-${version}.zip`);
}

if (!existsSync(crxKey)) {
    console.log(`Skipped the .crx: no signing key at ${crxKey} (set PMA_TOOLS_CRX_KEY to use another).`);
} else if (!existsSync(chromeBinary)) {
    console.log(`Skipped the .crx: Chrome not found at ${chromeBinary} (set CHROME_BINARY).`);
} else {
    // A throwaway profile keeps the packer away from the user's running Chrome.
    const profile = mkdtempSync(join(tmpdir(), 'phpmyadmin-tools-pack-'));
    try {
        execFileSync(chromeBinary, [
            `--pack-extension=${join(dist, 'chrome')}`,
            `--pack-extension-key=${crxKey}`,
            `--user-data-dir=${profile}`,
            '--no-message-box',
        ], { stdio: 'ignore' });
    } finally {
        rmSync(profile, { recursive: true, force: true });
    }
    renameSync(join(dist, 'chrome.crx'), join(dist, `phpmyadmin-tools-chrome-${version}.crx`));
    console.log(`Built dist/phpmyadmin-tools-chrome-${version}.crx`);
}
