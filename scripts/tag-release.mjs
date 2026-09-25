#!/usr/bin/env node

// Creates and pushes a single independent per-package release tag
// `<slug>-v<version>`.
//
// Each @the-polyfills/* package versions on its own (no changeset `fixed`
// group), so we read the version from the given package and tag just that one.
// Pushing the tag triggers .github/workflows/release.yaml, which builds and
// publishes only that package.
//
// Usage:
//   pnpm release:tag get-random-values
//
// Pushing a second package is a second invocation (a second tag).

import { execFileSync } from 'node:child_process'
import { readVersion, resolveChannel } from './release-channel.mjs'

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

const slug = process.argv[2]
if (!slug) {
  console.error(
    'Missing package slug.\nUsage: pnpm release:tag <slug>\nExample: pnpm release:tag get-random-values',
  )
  process.exit(1)
}

// Rejects an unknown package and an unsupported prerelease shape here, rather
// than after the tag is already pushed.
const { tag, channel } = resolveChannel(readVersion(slug), slug)

// Refuse to tag a dirty tree — the version bump must be committed first.
if (run('git', ['status', '--porcelain'])) {
  console.error(
    'Working tree is not clean. Commit the `changeset version` bump before tagging.',
  )
  process.exit(1)
}

// Refuse to clobber an existing tag.
const existing = run('git', ['tag', '--list', tag])
if (existing) {
  console.error(`Tag ${tag} already exists. Bump the version before releasing.`)
  process.exit(1)
}

console.log(`Creating and pushing ${tag} (npm dist-tag: ${channel}) …`)
execFileSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`], {
  stdio: 'inherit',
})
execFileSync('git', ['push', 'origin', tag], { stdio: 'inherit' })

// Link to the Actions tab from whatever `origin` actually points at.
const repoUrl = run('git', ['remote', 'get-url', 'origin'])
  .replace(/^git@github\.com:/, 'https://github.com/')
  .replace(/\.git$/, '')

console.log(
  `\nPushed ${tag} (npm dist-tag: ${channel}).\n\n` +
    '  The release workflow is already running:\n' +
    `    ${repoUrl}/actions\n`,
)
