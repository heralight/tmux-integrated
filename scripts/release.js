#!/usr/bin/env node
'use strict';

/**
 * Cut a release on one of two channels using the odd/even minor convention:
 *
 *   - stable  -> even minor versions (0.2.x, 0.4.x, ...), published normally
 *   - beta    -> odd  minor versions (0.3.x, 0.5.x, ...), published --pre-release
 *
 * The marketplace cannot store semver pre-release suffixes (1.2.3-beta.1), so the
 * channel is encoded in the minor's parity. CI (.github/workflows/release.yml)
 * derives the same parity to decide whether to pass --pre-release.
 *
 * Usage:
 *   node scripts/release.js <beta|stable> [--dry-run]
 *
 * Computes the next version, then runs `npm version <target>` (which fires the
 * `version` lifecycle to regenerate CHANGELOG.md and create the commit + tag),
 * then `git push --follow-tags`.
 */

const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function nextVersion(version, chan) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) {
    throw new Error(`Unsupported version format: ${version} (expected major.minor.patch)`);
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  const minorIsOdd = minor % 2 === 1;

  // beta wants an odd minor, stable wants an even minor.
  const onTargetTrain = chan === 'beta' ? minorIsOdd : !minorIsOdd;

  return onTargetTrain
    ? `${major}.${minor}.${patch + 1}` // already on the right train: bump patch
    : `${major}.${minor + 1}.0`;       // switch trains: next minor, reset patch
}

function sh(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

function shOut(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
}

function main() {
  const channel = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (channel !== 'beta' && channel !== 'stable') {
    console.error('Usage: node scripts/release.js <beta|stable> [--dry-run]');
    process.exit(1);
  }

  const { version: current } = require(path.join(root, 'package.json'));
  const target = nextVersion(current, channel);

  console.log(`Channel : ${channel}`);
  console.log(`Current : ${current}`);
  console.log(`Next    : ${target}`);

  if (dryRun) {
    return;
  }

  // Safety guards: release only from a clean main checkout.
  const branch = shOut('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    console.error(`Refusing to release: on branch '${branch}', expected 'main'.`);
    process.exit(1);
  }

  const dirty = shOut('git status --porcelain');
  if (dirty) {
    console.error('Refusing to release: working tree is not clean.');
    process.exit(1);
  }

  // `npm version <target>` runs the `version` lifecycle (changelog) and tags v<target>.
  sh(`npm version ${target}`);
  sh('git push --follow-tags');
}

if (require.main === module) {
  main();
}

module.exports = { nextVersion };
