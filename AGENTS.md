# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

`tmux-integrated` is a VS Code extension that provides seamless tmux integration
for VS Code terminals via tmux's control mode (`-CC`). See [`README.md`](README.md)
for user-facing docs and [`doc/ARCHITECTURE.md`](doc/ARCHITECTURE.md) for design.

## Repository layout

| Path | Purpose |
|------|---------|
| `src/extension.ts` | Activation entry point, command registration |
| `src/tmuxGateway.ts` | High-level session/window orchestration |
| `src/tmuxControlClient.ts` | tmux `-CC` control-mode protocol client |
| `src/tmuxTerminalProvider.ts` | VS Code `Pseudoterminal` implementation |
| `src/windowTitle.ts` | Window/title helpers |
| `out/` | Compiled JS output (do not edit, gitignored) |
| `scripts/release.js` | Computes the next version per channel and cuts the release |
| `scripts/update-changelog.js` | Auto-generates `CHANGELOG.md` from `git log` |
| `eslint.config.mjs` | Flat ESLint config (TypeScript, scoped to `src/`) |
| `doc/` | Architecture and release docs |
| `.github/workflows/` | CI: tag-triggered release pipeline |

## Build, lint, package

```bash
npm ci              # install (first time / clean)
npm run compile     # tsc -p ./  → out/
npm run watch       # tsc --watch
npm run lint        # eslint src (flat config)
npx vsce package    # build .vsix locally (for manual testing)
```

The `vscode:prepublish` hook runs `npm run compile`, so packaging always builds
fresh JS.

## Coding conventions

- TypeScript, target as configured in `tsconfig.json`. Do not relax `strict`
  options without good reason.
- Only `src/` is shipped as source; everything else in the package is the
  compiled `out/` plus assets per `.vscodeignore`.
- Public-facing setting names (`tmux-integrated.*`) and command IDs
  (`tmux-integrated.*`) are part of the user contract — renaming them is a
  breaking change and must be called out in commits.
- Don't hand-edit `CHANGELOG.md` or the `version` field in `package.json`;
  both are managed by the release flow (see below).

## Commit messages

`CHANGELOG.md` bullets are generated from `git log` since the previous `v*` tag
by [`scripts/update-changelog.js`](scripts/update-changelog.js):

- Conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `style:`, `test:`, `ci:`, `build:`, `perf:`) are stripped — the rest of the
  subject becomes a bullet under **Changed**.
- Version-bump commits (subject matching `0.x.y`, `release:`, `chore: bump
  version`) and merge commits are skipped.
- Write subject lines on `main` as if they were release notes: clear,
  imperative, no trailing period needed.

## Releasing

Releases are fully automated from `main` — never hand-edit `package.json`'s
`version` or `CHANGELOG.md`. Full details and recovery steps are in
[`doc/RELEASE.md`](doc/RELEASE.md).

The extension ships on two channels, distinguished by minor-version parity
(VS Code's recommended pre-release convention):

- **Stable** — even minor (`0.2.x`, `0.4.x`, …), published as a normal release.
- **Beta** — odd minor (`0.3.x`, `0.5.x`, …), published with `--pre-release`.

The channel is derived from parity everywhere — `scripts/release.js`,
`scripts/update-changelog.js`, and the CI workflow — so there is a single source
of truth and one `v*` tag pattern.

### Cut a release

From a clean `main` checkout with everything merged:

```bash
git checkout main
git pull
npm run release:beta      # ship a beta (pre-release)
npm run release:stable    # ship / promote to stable  (`npm run release` aliases this)
```

`scripts/release.js` computes the next version for the channel, runs
`npm version <target>` (bumps version, regenerates `CHANGELOG.md` via the
`version` lifecycle, creates commit + `v*` tag), then `git push --follow-tags`.

Pushing the `v*` tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which derives
the channel from the version's minor parity, packages the extension (with
`--pre-release` for beta), publishes the same `.vsix` to the VS Code Marketplace
and Open VSX (when `VSCE_PAT` / `OVSX_PAT` are configured), and creates a GitHub
Release (a pre-release for beta) with the `.vsix` attached.

### Preview the next version or changelog without releasing

```bash
node scripts/release.js beta --dry-run    # print the next version, no side effects
node scripts/release.js stable --dry-run
npm run changelog && git checkout -- CHANGELOG.md   # preview changelog only
```

### Pre-release checklist

Before running a release command:

1. Working tree is clean and on `main`, up to date with `origin/main`.
2. `npm run compile` and `npm run lint` both pass.
3. Recent commit subjects on `main` read well as changelog bullets (see
   *Commit messages* above).

### If CI fails after the tag is pushed

Fix the workflow or tokens and re-run the release job from GitHub Actions, or
publish locally per [`doc/RELEASE.md`](doc/RELEASE.md) §Manual recovery.
Do **not** delete and recreate the tag once it has been pushed.
