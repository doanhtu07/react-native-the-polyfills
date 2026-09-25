// Shared release-channel resolution for independent per-package releases.
//
// Single source of truth for "which channel does this version ship on", used by
// `release:tag`. Mirrors the "Resolve release channel" step in
// .github/workflows/release.yaml — keep the two in sync.
//
// Unlike the-sheet (lockstep `fixed` group, one `v<version>` tag for every
// package), each @the-polyfills/* package versions and tags independently:
//
//   <slug>-vX.Y.Z-alpha.N → QA   (npm dist-tag `alpha`, GitHub pre-release)
//   <slug>-vX.Y.Z-beta.N  → UAT  (npm dist-tag `beta`,  GitHub pre-release)
//   <slug>-vX.Y.Z         → prod (npm dist-tag `latest`, full GitHub release)
//
// where <slug> is the directory name under packages/ (e.g.
// `get-random-values` → tag `get-random-values-v0.1.0`).

import { readFileSync } from 'node:fs'

// Every package that can ship, keyed by its directory slug. Add a new entry
// here (and a trusted publisher on npmjs.com) when adding a new polyfill.
export const PACKAGES = {
  'get-random-values': {
    dir: 'packages/get-random-values',
    npm: '@the-polyfills/get-random-values',
  },
}

const CHANNEL = /^\d+\.\d+\.\d+(?:-(alpha|beta)\.\d+)?$/

// Tags look like `<slug>-v<version>`. The `-v` separator is unambiguous because
// slugs never contain `-v` followed by a semver start... validated below.
const TAG = /^(?<slug>.+)-v(?<version>\d+\.\d+\.\d+(?:-(?:alpha|beta)\.\d+)?)$/

export const readVersion = (slug) => {
  const entry = PACKAGES[slug]
  if (!entry) {
    console.error(
      `Unknown package '${slug}'.\n` +
        `Expected one of: ${Object.keys(PACKAGES).join(', ')}.\n` +
        'Pass the directory slug, e.g. `pnpm release:tag get-random-values`.',
    )
    process.exit(1)
  }
  return JSON.parse(
    readFileSync(
      new URL(`../${entry.dir}/package.json`, import.meta.url),
      'utf8',
    ),
  ).version
}

export const readNpmName = (slug) => PACKAGES[slug]?.npm

/**
 * Validate a version and derive its per-package release channel + tag.
 * Exits the process with a helpful message on an unsupported shape.
 */
export function resolveChannel(version, slug) {
  if (!PACKAGES[slug]) {
    console.error(
      `Unknown package '${slug}'. Expected one of: ${Object.keys(PACKAGES).join(', ')}.`,
    )
    process.exit(1)
  }
  const match = CHANNEL.exec(version)
  if (!match) {
    console.error(
      `Version ${version} is not a releasable version.\n` +
        'Expected X.Y.Z, X.Y.Z-alpha.N (QA), or X.Y.Z-beta.N (UAT).\n' +
        'Use `changeset pre enter alpha|beta` + `pnpm release:version` to derive it.',
    )
    process.exit(1)
  }
  const channel = match[1] ?? 'latest'
  return {
    version,
    slug,
    tag: `${slug}-v${version}`,
    channel,
    prerelease: channel !== 'latest',
    environment: { alpha: 'QA', beta: 'UAT', latest: 'production' }[channel],
  }
}

/**
 * Parse a `<slug>-v<version>` tag back into its parts. Used to keep tag
 * construction and tag parsing in one place; the workflow reimplements the
 * same split in bash.
 */
export function parseTag(tag) {
  const match = TAG.exec(tag)
  if (!match) return null
  const { slug, version } = match.groups
  if (!PACKAGES[slug]) return null
  if (!CHANNEL.test(version)) return null
  return { slug, version }
}
