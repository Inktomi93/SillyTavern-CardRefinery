#!/usr/bin/env node
/**
 * Version Sync Script
 *
 * Syncs version from package.json to:
 * - manifest.json (for SillyTavern extension registry)
 * - src/shared/constants.ts (for runtime version display)
 *
 * Usage:
 *   node scripts/sync-version.js           # Sync current version
 *   node scripts/sync-version.js 1.2.3     # Set specific version
 *   node scripts/sync-version.js --check   # Check if versions are in sync
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PACKAGE_JSON = join(ROOT, 'package.json');
const MANIFEST_JSON = join(ROOT, 'manifest.json');
const CONSTANTS_TS = join(ROOT, 'src/shared/constants.ts');

function readJSON(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSON(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 4) + '\n');
}

function getConstantsVersion() {
    const content = readFileSync(CONSTANTS_TS, 'utf-8');
    const match = content.match(/export const VERSION = ['"](.+?)['"] as const/);
    return match ? match[1] : null;
}

function setConstantsVersion(version) {
    let content = readFileSync(CONSTANTS_TS, 'utf-8');
    content = content.replace(
        /export const VERSION = ['"].+?['"] as const/,
        `export const VERSION = '${version}' as const`
    );
    writeFileSync(CONSTANTS_TS, content);
}

function checkVersions() {
    const pkg = readJSON(PACKAGE_JSON);
    const manifest = readJSON(MANIFEST_JSON);
    const constants = getConstantsVersion();

    const versions = {
        'package.json': pkg.version,
        'manifest.json': manifest.version,
        'constants.ts': constants,
    };

    const allMatch = pkg.version === manifest.version && pkg.version === constants;

    console.log('Version Status:');
    for (const [file, version] of Object.entries(versions)) {
        const status = version === pkg.version ? '✓' : '✗';
        console.log(`  ${status} ${file}: ${version}`);
    }

    if (!allMatch) {
        console.log('\n⚠ Versions are out of sync!');
        console.log('Run: npm run version:sync');
        process.exit(1);
    }

    console.log('\n✓ All versions in sync');
    return true;
}

function syncVersions(newVersion = null) {
    const pkg = readJSON(PACKAGE_JSON);
    const manifest = readJSON(MANIFEST_JSON);

    // Use provided version or package.json version
    const version = newVersion || pkg.version;

    // Update package.json if new version provided
    if (newVersion && pkg.version !== newVersion) {
        pkg.version = newVersion;
        writeJSON(PACKAGE_JSON, pkg);
        console.log(`✓ package.json → ${newVersion}`);
    }

    // Update manifest.json
    if (manifest.version !== version) {
        manifest.version = version;
        writeJSON(MANIFEST_JSON, manifest);
        console.log(`✓ manifest.json → ${version}`);
    }

    // Update constants.ts
    const constantsVersion = getConstantsVersion();
    if (constantsVersion !== version) {
        setConstantsVersion(version);
        console.log(`✓ constants.ts → ${version}`);
    }

    console.log(`\nAll versions synced to: ${version}`);
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--check')) {
    checkVersions();
} else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Version Sync Script

Usage:
  node scripts/sync-version.js           Sync versions from package.json
  node scripts/sync-version.js 1.2.3     Set all versions to 1.2.3
  node scripts/sync-version.js --check   Check if versions match
  node scripts/sync-version.js --help    Show this help
`);
} else {
    const newVersion = args[0] && !args[0].startsWith('-') ? args[0] : null;
    syncVersions(newVersion);
}
