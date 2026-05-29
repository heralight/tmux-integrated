#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const changelogPath = path.join(root, 'CHANGELOG.md');
const { version } = require(path.join(root, 'package.json'));

const date = new Date().toISOString().slice(0, 10);

// Channel is encoded in the minor's parity (odd = beta/pre-release, even = stable).
// Beta builds are transient, so we keep CHANGELOG.md stable-only and skip them.
const minor = Number(version.split('.')[1]);
if (minor % 2 === 1) {
  console.log(`Skipping changelog for pre-release version ${version} (odd minor).`);
  process.exit(0);
}

// Find the previous tag to scope git log.
const tags = execSync('git tag -l "v*" --sort=-v:refname', { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

// For a stable release, scope to the previous *stable* (even-minor) tag so the
// entry aggregates everything shipped since the last stable release, including
// changes that already went out on the beta channel. The current version tag
// (e.g. v0.4.0) doesn't exist yet inside `npm version`, so the first matching
// tag is the previous stable. Fall back to the most recent tag of any kind
// (covers the initial migration when no even-minor tag exists yet).
const isStableTag = (tag) => {
  const m = /^v\d+\.(\d+)\.\d+$/.exec(tag);
  return m && Number(m[1]) % 2 === 0;
};
const prevTag = tags.find(isStableTag) || tags[0];

// Get commit messages since the previous tag, excluding merges and version bumps
const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
const log = execSync(
  `git log --oneline --no-merges ${range}`,
  { cwd: root, encoding: 'utf8' },
);

const skipPattern = /^[0-9a-f]+ (chore: bump version|release:|0\.\d+\.\d+$)/i;
const bullets = log
  .split('\n')
  .filter(Boolean)
  .filter(line => !skipPattern.test(line))
  .map(line => {
    // Strip the short hash prefix
    const msg = line.replace(/^[0-9a-f]+ /, '');
    // Strip conventional-commit prefixes (feat:, fix:, chore:, etc.)
    const cleaned = msg.replace(/^(feat|fix|chore|docs|refactor|style|test|ci|build|perf)(\(.+?\))?:\s*/i, '');
    return `- ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}`;
  });

const section = bullets.length > 0 ? bullets.join('\n') : `- Release ${version}.`;
const entry = `\n## [${version}] - ${date}\n\n### Changed\n\n${section}\n`;

const content = fs.readFileSync(changelogPath, 'utf8');

// Find the first version section header (e.g. "## [1.2.3] - ..." or
// "## [Unreleased]") and insert the new entry immediately before it.
const versionHeaderPattern = /\n## \[/;
const match = versionHeaderPattern.exec(content);
const updated =
  match
    ? content.slice(0, match.index) + entry + content.slice(match.index)
    : content + entry;

fs.writeFileSync(changelogPath, updated);
