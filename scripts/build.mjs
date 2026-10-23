import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src');
const dist = join(root, 'dist');
// The release workflow passes the version in, so main never has to carry a version commit.
const version = process.env.RELEASE_VERSION || JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const manifest = { ...JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')), version };
// A local build tells the options page which branch and commit it came from; a release build has no such file.
const buildInfo = process.env.RELEASE_VERSION ? null : readBuildInfo();

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
    if (buildInfo !== null) {
        writeFileSync(join(output, 'build-info.json'), `${JSON.stringify(buildInfo, null, 4)}\n`);
    }
    execFileSync('zip', ['-qr', join(dist, `phpmyadmin-tools-${browser}-${version}.zip`), '.'], { cwd: output });
    console.log(`Built dist/${browser} and dist/phpmyadmin-tools-${browser}-${version}.zip`);
}

function readBuildInfo() {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    try {
        return {
            branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
            commit: git('rev-parse', '--short', 'HEAD'),
            dirty: git('status', '--porcelain') !== '',
            builtAt: new Date().toISOString(),
        };
    } catch {
        // Not a git checkout: the options page shows the version alone.
        return { branch: '', commit: '', dirty: false, builtAt: new Date().toISOString() };
    }
}
