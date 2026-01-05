#!/usr/bin/env node
/**
 * Branch Management Utilities
 *
 * Usage:
 *   node scripts/branch-utils.js status      # Show branch status
 *   node scripts/branch-utils.js sync        # Sync dev with main (rebase)
 *   node scripts/branch-utils.js promote     # Merge dev into main locally
 *   node scripts/branch-utils.js switch      # Toggle between main/dev
 */

import { execSync } from 'node:child_process';

function run(cmd, options = {}) {
    try {
        return execSync(cmd, {
            encoding: 'utf-8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options,
        });
    } catch (error) {
        if (options.allowFail) return null;
        throw error;
    }
}

function getCurrentBranch() {
    return run('git branch --show-current', { silent: true }).trim();
}

function hasUncommittedChanges() {
    const status = run('git status --porcelain', { silent: true });
    return status.trim().length > 0;
}

function status() {
    console.log('\n📊 Branch Status\n');

    const current = getCurrentBranch();
    console.log(`Current branch: ${current}`);

    if (hasUncommittedChanges()) {
        console.log('⚠️  You have uncommitted changes\n');
    }

    // Fetch latest
    run('git fetch origin', { silent: true, allowFail: true });

    // Show commits ahead/behind for both branches
    for (const branch of ['main', 'dev']) {
        const ahead =
            run(`git rev-list --count origin/${branch}..${branch}`, {
                silent: true,
                allowFail: true,
            })?.trim() || '?';
        const behind =
            run(`git rev-list --count ${branch}..origin/${branch}`, {
                silent: true,
                allowFail: true,
            })?.trim() || '?';
        const marker = branch === current ? '→ ' : '  ';
        console.log(
            `${marker}${branch}: ${ahead} ahead, ${behind} behind origin`,
        );
    }

    // Show dev vs main
    const devAhead =
        run('git rev-list --count main..dev', {
            silent: true,
            allowFail: true,
        })?.trim() || '?';
    const devBehind =
        run('git rev-list --count dev..main', {
            silent: true,
            allowFail: true,
        })?.trim() || '?';
    console.log(`\ndev vs main: ${devAhead} ahead, ${devBehind} behind`);

    if (devAhead !== '0' && devAhead !== '?') {
        console.log('\n📝 Commits in dev not in main:');
        run('git log --oneline main..dev');
    }

    console.log('');
}

function sync() {
    console.log('\n🔄 Syncing dev with main...\n');

    if (hasUncommittedChanges()) {
        console.error(
            '❌ You have uncommitted changes. Commit or stash them first.',
        );
        process.exit(1);
    }

    const current = getCurrentBranch();

    run('git fetch origin');
    run('git checkout dev');
    run('git pull origin dev');
    run('git rebase main');
    run('git push origin dev --force-with-lease');

    if (current !== 'dev') {
        run(`git checkout ${current}`);
    }

    console.log('\n✅ dev branch synced with main');
}

function promote() {
    console.log('\n🚀 Promoting dev to main...\n');

    if (hasUncommittedChanges()) {
        console.error(
            '❌ You have uncommitted changes. Commit or stash them first.',
        );
        process.exit(1);
    }

    const current = getCurrentBranch();

    // Check if there's anything to merge
    const commits = run('git rev-list --count main..dev', {
        silent: true,
    }).trim();
    if (commits === '0') {
        console.log('✅ main is already up to date with dev');
        return;
    }

    console.log(`Found ${commits} commits to merge\n`);

    run('git checkout main');
    run('git pull origin main');
    run('git merge dev --no-ff -m "chore: merge dev into main"');
    run('git push origin main');

    // Switch back to dev for continued development
    run('git checkout dev');
    run('git pull origin main'); // Keep dev in sync

    if (current !== 'dev' && current !== 'main') {
        run(`git checkout ${current}`);
    }

    console.log('\n✅ dev merged into main and pushed');
}

function switchBranch() {
    const current = getCurrentBranch();
    const target = current === 'main' ? 'dev' : 'main';

    if (hasUncommittedChanges()) {
        console.log(`⚠️  Stashing changes before switching to ${target}...`);
        run('git stash');
    }

    run(`git checkout ${target}`);
    console.log(`\n✅ Switched to ${target}`);
}

// CLI
const command = process.argv[2];

switch (command) {
    case 'status':
        status();
        break;
    case 'sync':
        sync();
        break;
    case 'promote':
        promote();
        break;
    case 'switch':
        switchBranch();
        break;
    default:
        console.log(`
Branch Management Utilities

Usage:
  npm run git:status    Show branch status and pending commits
  npm run git:sync      Rebase dev on main (keeps dev up to date)
  npm run git:promote   Merge dev into main (local + push)
  npm run git:switch    Toggle between main and dev branches

Workflow:
  1. Work on dev branch
  2. Run 'npm run git:status' to see what's pending
  3. Run 'npm run git:promote' when ready to release
  4. Run GitHub Action 'Release' to bump version and create release
`);
}
