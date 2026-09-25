# Publish NPM Package

We publish each `@the-polyfills/*` library independently, two ways, from a
per-package `<slug>-v<version>` tag (e.g. `get-random-values-v0.1.0`):

1. **npm registry** (`registry.npmjs.org`) — install by name + semver, e.g.
   `npm i @the-polyfills/get-random-values@^0.1.0`. Preferred.
2. **Tarball** attached to the GitHub Release — install by URL, e.g.
   `npm i https://github.com/doanhtu07/react-native-the-polyfills/releases/download/get-random-values-v0.1.0/the-polyfills-get-random-values-0.1.0.tgz`.
   Kept as a fallback for consumers who want a pinned artifact without any
   registry interaction.

Nothing compiled (`lib/`) is ever committed to a branch — both artifacts are
built in CI from the tagged source.

## Independent versioning (no lockstep)

Unlike the-sheet (one `fixed` group, one `v<version>` tag for everything),
each polyfill versions, tags, and ships on its own (see
`.changeset/config.json` — empty `fixed`/`linked`, so `changeset version`
bumps only the packages with pending changesets):

- `@the-polyfills/get-random-values` → tags like `get-random-values-v0.1.0`
- `@the-polyfills/<next-polyfill>` → tags like `<next-polyfill>-v<version>`

A tag therefore covers exactly one package. Pushing two tags (e.g. for two
polyfills) runs two independent workflow runs and creates two GitHub Releases.

When adding a new polyfill, register it in two places:

1. `scripts/release-channel.mjs` → `PACKAGES` (slug → dir + npm name), and
2. a trusted publisher on npmjs.com (below).

## Release channels

The tag name alone decides the channel — CI derives everything else from it:

| Channel | For  | Tag                                | npm dist-tag | GitHub Release |
| ------- | ---- | ---------------------------------- | ------------ | -------------- |
| `alpha` | QA   | `get-random-values-v1.2.0-alpha.0` | `alpha`      | Pre-release    |
| `beta`  | UAT  | `get-random-values-v1.2.0-beta.0`  | `beta`       | Pre-release    |
| stable  | Prod | `get-random-values-v1.2.0`         | `latest`     | Latest release |

Both artifacts are produced on every channel: the package goes to npm under the
channel's dist-tag, and the tarball is attached to the Release. Only a stable tag
ever moves `latest`, so a consumer on `^0.1.0` never picks up a QA or UAT build.

The workflow checks out the tag ref, so it is **branch-agnostic** — branch off
wherever you like, cut prereleases there, and tag from that branch. It also
verifies the tag's version matches that package's `package.json`, so the version
bump must be committed before tagging.

Pushing a tag is the normal trigger and CI does the rest. A bare `v*` tag
matches nothing on purpose — it can never accidentally publish everything.

## One-time setup: npm trusted publishing

CI publishes via [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers) —
no long-lived npm token is stored in the repo. Each package needs its own
trusted publisher (npm only trusts the exact package + workflow pair), so repeat
this once per package (`get-random-values`, then each new polyfill):

1. Go to `npmjs.com/package/@the-polyfills/<slug>` > Settings > **Trusted Publishers**.
2. Add a GitHub Actions publisher:
   - Organization/user: `doanhtu07`
   - Repository: `react-native-the-polyfills`
   - Workflow filename: `release.yaml`
   - Allow **`npm publish`** (direct publishing) for this workflow. Newer
     configurations default to staged publishing only, which this workflow does
     not use.
3. The workflow already requests `id-token: write`, so nothing else is needed —
   the next tag push publishes without any secret.

Only repeat the steps above for a newly added package.

If trusted publishing is not an option, fall back to a token: create a granular
access token with publish rights on the `@the-polyfills` scope, add it as an
`NPM_TOKEN` repo secret, and set `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` on
the workflow's publish step.

Also note `publishConfig` in each package.json pins the registry to
`https://registry.npmjs.org/`, and `pnpm-workspace.yaml` sets
`publishBranch: main` as a guard.

## Release flow (stable)

Releases one package; repeat per package you want to ship:

1. **Add a changeset** describing the change and the bump level:

   ```sh
   pnpm changeset
   ```

   Select only the polyfill(s) you changed. Untouched packages get no bump.

2. **Stamp the new version** (also updates changelogs):

   ```sh
   pnpm release:version   # = changeset version
   ```

3. **Commit** the version bump:

   ```sh
   git add -A && git commit -m "release: get-random-values v<version>"
   ```

4. **Tag and push** — this is the trigger:

   ```sh
   pnpm release:tag get-random-values
   ```

   `release:tag` reads that package's version, creates an annotated
   `<slug>-v<version>` tag, and pushes it. It refuses to run on a dirty tree,
   for an unknown slug, or if the tag already exists.

5. **CI takes over.** Pushing the `<slug>-v*` tag runs `.github/workflows/release.yaml`,
   which installs, builds only that package (`bob build` via `prepare`), then:
   - **publishes** it to npm, and
   - **packs** it into a stable-named tarball and creates the GitHub Release
     with a peer-dependency summary in the notes.

   Publishing uses OIDC — no personal token is needed to _release_ once the
   trusted publishers above are configured.

## Release flow (alpha → QA, beta → UAT)

Changesets' **pre mode** produces the `-alpha.N` / `-beta.N` versions. The state
lives in `.changeset/pre.json`, which must be committed — that file is what keeps
the channel active on the branch you're working from.

Note: pre mode is global to the branch, so while `.changeset/pre.json` exists,
_every_ `changeset version` on that branch produces a prerelease. Prefer cutting
QA/UAT drops for one package at a time, or accept that sibling packages with
pending changesets also get prerelease bumps.

### Cutting an alpha (QA)

```sh
git switch -c release/get-random-values-1.2.0   # any branch works; CI follows the tag
pnpm changeset                                    # add changeset(s) as usual
pnpm changeset pre enter alpha                    # writes .changeset/pre.json
pnpm release:version                              # → 1.2.0-alpha.0 (for changed packages)
git add -A && git commit -m "release: get-random-values v1.2.0-alpha.0"
pnpm release:tag get-random-values                # tags get-random-values-v1.2.0-alpha.0 and pushes
```

Every subsequent `pnpm release:version` on that branch bumps the counter
(`alpha.0` → `alpha.1` → …). Repeat commit + `release:tag` for each QA drop; no
need to add a new changeset unless the code actually changed.

### Promoting to beta (UAT)

```sh
pnpm changeset pre exit                 # leave the alpha channel
pnpm changeset pre enter beta           # enter the beta channel
pnpm release:version                    # → 1.2.0-beta.0
git add -A && git commit -m "release: get-random-values v1.2.0-beta.0"
pnpm release:tag get-random-values
```

### Promoting to stable (production)

```sh
pnpm changeset pre exit                 # deletes .changeset/pre.json
pnpm release:version                    # → 1.2.0
git add -A && git commit -m "release: get-random-values v1.2.0"
pnpm release:tag get-random-values      # tags get-random-values-v1.2.0 → dist-tag `latest`
```

Then merge the release branch back so `main` carries the consumed changesets and
the updated changelogs.

**Gotchas**

- While `.changeset/pre.json` exists, _every_ `changeset version` on that branch
  produces a prerelease. Cutting a hotfix means doing it from a branch without
  that file.
- `pnpm release:tag` refuses a dirty tree, an unknown slug, and clobbering an
  existing tag — commit the bump first, and re-run `release:version` if you need
  a new counter.
- `pnpm release:tag` also rejects any version that isn't `X.Y.Z`, `X.Y.Z-alpha.N`
  or `X.Y.Z-beta.N`, so a bad prerelease shape fails locally rather than after
  the tag is pushed.
- CI additionally rejects a tag whose version doesn't match the package.json at
  the tag ref — don't hand-edit the version to skip a channel; let
  `changeset version` derive it.
- Don't push a bare `v<version>` tag — the workflow ignores it. Always tag per
  package via `pnpm release:tag <slug>`.

## Consuming a released package

### Option 1 — npm registry (recommended)

```sh
# Production — a semver range only ever resolves to a stable version
npm i @the-polyfills/get-random-values@^0.1.0

# QA — newest alpha
npm i @the-polyfills/get-random-values@alpha

# UAT — newest beta
npm i @the-polyfills/get-random-values@beta

# Pin an exact prerelease instead of tracking the channel
npm i @the-polyfills/get-random-values@0.2.0-beta.0
```

`@alpha` / `@beta` resolve to whatever that channel points at _right now_ and
are written into `package.json` as an exact version, so a reinstall is
reproducible but won't pick up the next drop — re-run the install to move up.

### Option 2 — Release tarball (pinned artifact)

Install the package straight from the Release asset (never the monorepo):

```sh
npm i https://github.com/doanhtu07/react-native-the-polyfills/releases/download/get-random-values-v0.1.0/the-polyfills-get-random-values-0.1.0.tgz
```

Prerelease tags work the same way — the version appears in both the tag and the
filename:

```sh
npm i https://github.com/doanhtu07/react-native-the-polyfills/releases/download/get-random-values-v0.2.0-alpha.0/the-polyfills-get-random-values-0.2.0-alpha.0.tgz
```

Assets keep the name `pnpm pack` generates, so a downloaded tarball identifies
its own package and version — no renaming needed:

```
the-polyfills-get-random-values-<version>.tgz
```

Note there is no `v` prefix on the version in the **filename** (npm's
convention); the `v` appears only in the **tag** (`<slug>-v<version>`).

#### Installing a tarball from disk (`file:`)

If you've downloaded the asset (or built one locally with `pnpm pack`), install
it by path instead of URL — useful for testing a QA build against the exact
artifact CI will attach:

```sh
# Download once, then install from disk
curl -L -O \
  https://github.com/doanhtu07/react-native-the-polyfills/releases/download/get-random-values-v0.2.0-alpha.0/the-polyfills-get-random-values-0.2.0-alpha.0.tgz

npm i file:./the-polyfills-get-random-values-0.2.0-alpha.0.tgz
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@the-polyfills/get-random-values": "file:./vendor/the-polyfills-get-random-values-0.2.0-alpha.0.tgz"
  }
}
```

The path is relative to the consuming `package.json`. A `file:` tarball is
resolved by its contents, not a version range, so **replacing the file does not
reinstall it** — delete the package from `node_modules` and reinstall to pick up
a new build. Because the version is in the filename, each drop lands as a
distinct file, so pointing at the new one is enough.

Either way, remember to install the package's peer dependencies (listed in the
release notes).

## Manage tags

- `git tag --list`: List all tags
- `git tag --list 'get-random-values-v*'`: List tags for one package
- `pnpm release:tag <slug>`: Create + push the tag for the package's current version (preferred)
- `git push origin <tag-name>`: Push the tag to the remote repository (triggers the release action for `<slug>-v*` tags)
- `git push origin :refs/tags/<tag-name>`: Delete a remote tag

Prune local branches and tags with:

- `git fetch --prune --prune-tags origin`
