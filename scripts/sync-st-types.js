#!/usr/bin/env node
/**
 * SillyTavern Types Reference Script
 *
 * Fetches SillyTavern's type definitions from GitHub for reference.
 * Use this to verify our standalone globals.d.ts stays in sync with ST's types.
 *
 * NOTE: ST's global.d.ts uses imports that don't exist outside their codebase,
 * so we can't use it directly. Instead, we maintain standalone declarations in
 * globals.d.ts and use this script to check for updates.
 *
 * Usage:
 *   npm run sync-types           # Fetch latest types for reference
 *   npm run sync-types:check     # Check what types ST currently exports
 *   npm run sync-types:clean     # Remove fetched reference files
 *
 * The fetched types are stored in .st-types/ (gitignored) for reference only.
 * They are NOT compiled - our globals.d.ts provides the working declarations.
 */

import {
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ST_TYPES_DIR = join(ROOT, '.st-types');
const METADATA_FILE = join(ST_TYPES_DIR, 'metadata.json');
const OUR_GLOBALS = join(ROOT, 'globals.d.ts');

// SillyTavern GitHub raw URLs
const ST_GITHUB_BASE =
    'https://raw.githubusercontent.com/SillyTavern/SillyTavern';
const ST_BRANCH = 'release'; // Use release branch for stability

// Files to fetch from SillyTavern for reference
const ST_TYPE_FILES = [
    {
        remote: 'public/global.d.ts',
        local: 'global.d.ts',
        description: 'Global type declarations',
    },
    {
        remote: 'public/lib.js',
        local: 'lib.js',
        description: 'Bundled libraries exports',
    },
    {
        remote: 'public/scripts/st-context.js',
        local: 'st-context.js',
        description: 'Context API',
    },
];

/**
 * Fetch a file from a URL with timeout
 */
async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Compute hash of content for change detection
 */
function hashContent(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Ensure .st-types directory exists
 */
function ensureTypesDir() {
    if (!existsSync(ST_TYPES_DIR)) {
        mkdirSync(ST_TYPES_DIR, { recursive: true });
    }
}

/**
 * Write metadata about fetched types
 */
function writeMetadata(metadata) {
    ensureTypesDir();
    writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2) + '\n');
}

/**
 * Extract key type information from ST's global.d.ts
 */
function extractTypeInfo(content) {
    const info = {
        interfaces: [],
        types: [],
        globals: [],
    };

    // Find interface declarations
    const interfaceMatches = content.matchAll(/interface\s+(\w+)/g);
    for (const match of interfaceMatches) {
        info.interfaces.push(match[1]);
    }

    // Find type declarations
    const typeMatches = content.matchAll(/type\s+(\w+)\s*=/g);
    for (const match of typeMatches) {
        info.types.push(match[1]);
    }

    // Find var declarations (globals)
    const varMatches = content.matchAll(/var\s+(\w+)/g);
    for (const match of varMatches) {
        info.globals.push(match[1]);
    }

    return info;
}

/**
 * Fetch all ST type files for reference
 */
async function syncTypes() {
    console.log('Fetching SillyTavern types for reference...\n');
    console.log(
        'NOTE: These are for reference only - see globals.d.ts for working types.\n',
    );

    ensureTypesDir();

    const metadata = { files: {}, fetchedAt: new Date().toISOString() };
    let successCount = 0;

    for (const { remote, local, description } of ST_TYPE_FILES) {
        const url = `${ST_GITHUB_BASE}/${ST_BRANCH}/${remote}`;
        const localPath = join(ST_TYPES_DIR, local);

        try {
            process.stdout.write(`  Fetching ${description}... `);
            const content = await fetchWithTimeout(url);

            // Add header comment
            const header = `/**
 * REFERENCE ONLY - DO NOT COMPILE
 * Fetched from: ${url}
 * Fetched at: ${new Date().toISOString()}
 *
 * This file is for reference when updating globals.d.ts.
 * It cannot be compiled directly due to import dependencies.
 */

`;
            writeFileSync(localPath, header + content);

            metadata.files[local] = {
                source: url,
                hash: hashContent(content),
                fetchedAt: new Date().toISOString(),
            };

            console.log('✓');
            successCount++;
        } catch (error) {
            console.log(`✗ (${error.message})`);
        }
    }

    writeMetadata(metadata);

    // Show summary of what ST exports
    const globalDts = join(ST_TYPES_DIR, 'global.d.ts');
    if (existsSync(globalDts)) {
        const content = readFileSync(globalDts, 'utf-8');
        const info = extractTypeInfo(content);

        console.log('\n─────────────────────────────────────────────');
        console.log('ST exports the following types:\n');
        console.log(
            `  Interfaces: ${info.interfaces.slice(0, 10).join(', ')}${info.interfaces.length > 10 ? '...' : ''}`,
        );
        console.log(`  Types:      ${info.types.join(', ')}`);
        console.log(`  Globals:    ${info.globals.join(', ')}`);
        console.log('\n─────────────────────────────────────────────');
    }

    console.log(`\n✓ Fetched ${successCount} reference file(s) to .st-types/`);
    console.log('\nTo update globals.d.ts:');
    console.log('  1. Review .st-types/global.d.ts for changes');
    console.log('  2. Update globals.d.ts with any new/changed types');
    console.log('  3. Run "npm run check" to verify');
}

/**
 * Check our types vs ST's types
 */
async function checkTypes() {
    console.log('Comparing our types with SillyTavern...\n');

    // Fetch fresh ST types
    const url = `${ST_GITHUB_BASE}/${ST_BRANCH}/public/global.d.ts`;

    try {
        const stContent = await fetchWithTimeout(url);
        const stInfo = extractTypeInfo(stContent);

        const ourContent = readFileSync(OUR_GLOBALS, 'utf-8');

        console.log('ST declares these types:\n');
        console.log(`  Interfaces: ${stInfo.interfaces.join(', ')}`);
        console.log(`  Types:      ${stInfo.types.join(', ')}`);
        console.log(`  Globals:    ${stInfo.globals.join(', ')}`);

        // Check if we have the key ones
        console.log('\nChecking our globals.d.ts:\n');

        const keyTypes = ['SillyTavern', 'Character', 'ChatMessage', 'Group'];
        for (const type of keyTypes) {
            const hasIt = ourContent.includes(type);
            console.log(`  ${hasIt ? '✓' : '✗'} ${type}`);
        }

        console.log('\n─────────────────────────────────────────────');
        console.log('Review .st-types/global.d.ts for full details');
        console.log('─────────────────────────────────────────────');
    } catch (error) {
        console.log(`✗ Could not fetch ST types: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Remove fetched reference types
 */
function cleanTypes() {
    if (existsSync(ST_TYPES_DIR)) {
        rmSync(ST_TYPES_DIR, { recursive: true });
        console.log('✓ Removed .st-types/');
    } else {
        console.log('Nothing to clean');
    }
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
SillyTavern Types Reference Script

Fetches ST's type definitions for reference when updating globals.d.ts.
The fetched files cannot be compiled directly (they have import dependencies).

Usage:
  npm run sync-types           Fetch latest types for reference
  npm run sync-types:check     Compare our types with ST's
  npm run sync-types:clean     Remove fetched reference files

Workflow:
  1. Run 'npm run sync-types' to fetch ST's current types
  2. Review .st-types/global.d.ts for any changes
  3. Update globals.d.ts to match ST's exports
  4. Run 'npm run check' to verify types compile
`);
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    showHelp();
} else if (args.includes('--check')) {
    checkTypes();
} else if (args.includes('--clean')) {
    cleanTypes();
} else {
    syncTypes();
}
