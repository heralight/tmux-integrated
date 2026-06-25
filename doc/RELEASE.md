# Release process

Publishing is fully automated from `main`. You never edit `package.json`'s
`version` or `CHANGELOG.md` by hand.

The extension ships on two channels, both published to the VS Code Marketplace
and Open VSX:

| Channel | Minor parity | Versions | Published as |
|---------|--------------|----------|--------------|
| **Stable** | even | `0.2.x`, `0.4.x`, … | normal release |
| **Beta** | odd | `0.3.x`, `0.5.x`, … | `--pre-release` |

## Why the odd/even convention

The marketplaces cannot store semver pre-release suffixes (`1.2.3-beta.1`), so
[VS Code recommends](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prerelease-extensions)
encoding the channel in the minor version's parity. Users opt into beta with the
**Switch to Pre-Release Version** button in the Extensions view; the channel is a
single source of truth derived from parity everywhere (release script, changelog
generator, and CI).

Because each beta train sits one minor above the current stable
(`stable 0.2.x` -> `beta 0.3.x`), beta version numbers always stay ahead of
stable, so opted-in users get the newest build and a promotion cleanly moves
everyone forward.

## Prerequisites

- All changes merged to `main`; working tree clean and on `main`.
- `npm ci  --ignore-scripts` has been run at least once (provides `vsce` / `ovsx`).
- GitHub secrets `VSCE_PAT` and `OVSX_PAT` are configured (the publish steps use
  `continue-on-error`, so a missing token doesn't fail the whole run).

## Cut a release

From a clean `main` checkout:

```bash
git checkout main
git pull

npm run release:beta      # ship a beta (pre-release)
# or
npm run release:stable    # ship / promote to stable  (`npm run release` is an alias)
```

`scripts/release.js` computes the next version for the chosen channel, then runs
`npm version <target>` (which fires the `version` lifecycle to regenerate
`CHANGELOG.md` and create the commit + `v*` tag) and `git push --follow-tags`.

Pushing the `v*` tag triggers
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which reads
the version, derives the channel from its minor parity, packages once (with
`--pre-release` for beta), publishes that same `.vsix` to both marketplaces, and
creates a GitHub Release (marked as a pre-release for beta) with the `.vsix`
attached.

## Version math

Given the current version `M.m.p`:

| Command | If on target train | If switching train |
|---------|--------------------|--------------------|
| `release:beta` (wants odd minor) | `m` odd -> `M.m.(p+1)` | `m` even -> `M.(m+1).0` |
| `release:stable` (wants even minor) | `m` even -> `M.m.(p+1)` | `m` odd -> `M.(m+1).0` |

Example train:

```
stable 0.2.0
  -> release:beta   -> 0.3.0 -> 0.3.1 -> 0.3.2   (betas)
  -> release:stable -> 0.4.0                       (promote everything)
  -> release:beta   -> 0.5.0                        (next beta train)
```

Preview the next version without releasing:

```bash
node scripts/release.js beta --dry-run
node scripts/release.js stable --dry-run
```

## Changelog behavior

`scripts/update-changelog.js` is channel-aware:

- **Beta** (odd minor): skipped — `CHANGELOG.md` stays stable-only.
- **Stable** (even minor): the new section aggregates `git log` since the
  previous **stable** (even-minor) tag, so it covers everything shipped since the
  last stable release, including changes that already went out on beta.

Preview without bumping:

```bash
npm run changelog
git checkout -- CHANGELOG.md   # discard if only previewing
```

## Migration baseline

Historic `0.1.x` releases predate this convention (odd minor, but published as
regular releases). The first stable release under the convention is `0.2.0`,
after which the beta train opens at `0.3.0`.

## Manual recovery

If CI fails after the tag is pushed, fix the workflow or tokens and re-run the
release job from GitHub Actions, or publish locally. For a stable build:

```bash
npm ci
npx vsce package -o tmux-integrated.vsix
npx vsce publish --packagePath tmux-integrated.vsix   # requires VSCE_PAT
npx ovsx publish tmux-integrated.vsix                 # requires OVSX_PAT
```

For a beta build, add `--pre-release` to the `vsce package` step (the flag is
baked into the `.vsix`, so both publish commands honor it):

```bash
npx vsce package --pre-release -o tmux-integrated.vsix
npx vsce publish --packagePath tmux-integrated.vsix
npx ovsx publish tmux-integrated.vsix
```

Do **not** delete and recreate a tag once it has been pushed.

## Commit message conventions

Changelog bullets are derived from `git log`. Conventional prefixes (`fix:`,
`feat:`, `docs:`, etc.) are stripped; the rest becomes a bullet under
**Changed**. Write clear, imperative subject lines on `main` so the generated
changelog reads well.
