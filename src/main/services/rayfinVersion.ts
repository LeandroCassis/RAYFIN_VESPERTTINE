/**
 * Reports a project's local Rayfin toolchain version — the `@microsoft/rayfin-*`
 * CLI and SDK packages pinned in its package.json — and whether a newer stable
 * release is available on npm.
 *
 * The app never upgrades these itself: when an update exists, Rayfin Fabricator
 * hands a prepared prompt to the Copilot agent (which edits package.json and runs
 * `npm install`). This module just supplies the "from X → to Y" facts.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { run } from './exec'
import { findProject } from './store'
import type { RayfinPackageVersion, RayfinVersionInfo } from '../../shared/ipc'

/** The canonical CLI package; every other @microsoft/rayfin-* is treated as SDK. */
const CLI_PACKAGE = '@microsoft/rayfin-cli'

/** Cache npm `latest` lookups so refreshes (per turn/deploy) don't hammer the registry. */
const LATEST_TTL_MS = 30 * 60_000
const latestCache = new Map<string, { version: string | null; at: number }>()

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  version?: string
}

function readJson(path: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PackageJson
  } catch {
    return null
  }
}

/** All `@microsoft/rayfin-*` packages declared in the project's package.json. */
function rayfinDependencies(projectPath: string): string[] {
  const pkg = readJson(join(projectPath, 'package.json'))
  if (!pkg) return []
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.keys(all)
    .filter((name) => name.startsWith('@microsoft/rayfin-'))
    .sort()
}

/** Version actually resolved in node_modules (the real pinned version), or null. */
function installedVersion(projectPath: string, pkg: string): string | null {
  const pkgJson = readJson(join(projectPath, 'node_modules', ...pkg.split('/'), 'package.json'))
  return pkgJson?.version ?? null
}

/** The npm `latest` dist-tag version for a package, cached, null when unreachable. */
async function latestVersion(pkg: string): Promise<string | null> {
  const hit = latestCache.get(pkg)
  if (hit && Date.now() - hit.at < LATEST_TTL_MS) return hit.version
  const res = await run('npm', ['view', pkg, 'version'], { timeout: 20_000 })
  const version = res.ok ? res.stdout.trim().split(/\s+/).pop() || null : null
  latestCache.set(pkg, { version, at: Date.now() })
  return version
}

/** Parse the `x.y.z` core of a semver string (ignoring any prerelease/build). */
function parseCore(version: string | null): [number, number, number] | null {
  if (!version) return null
  const m = version.match(/(\d+)\.(\d+)\.(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** True when `latest` is a strictly newer stable release than `installed`. */
function isNewer(latest: string | null, installed: string | null): boolean {
  const a = parseCore(latest)
  const b = parseCore(installed)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

const EMPTY: RayfinVersionInfo = {
  version: null,
  latest: null,
  upgradeAvailable: false,
  packages: []
}

/**
 * Resolve the project's installed Rayfin versions and compare them against npm.
 * Never throws across IPC; returns an empty report when the project is unknown
 * or has no Rayfin dependencies.
 */
export async function getProjectRayfinVersion(id: string): Promise<RayfinVersionInfo> {
  const project = findProject(id)
  if (!project) return EMPTY

  const names = rayfinDependencies(project.path)
  if (names.length === 0) return EMPTY

  const packages: RayfinPackageVersion[] = await Promise.all(
    names.map(async (name) => {
      const installed = installedVersion(project.path, name)
      const latest = await latestVersion(name)
      return {
        name,
        kind: name === CLI_PACKAGE ? 'cli' : 'sdk',
        installed,
        latest,
        upgradable: isNewer(latest, installed)
      } satisfies RayfinPackageVersion
    })
  )

  // Headline = the CLI version, falling back to the first SDK package that resolved.
  const cli = packages.find((p) => p.kind === 'cli')
  const headline = cli ?? packages.find((p) => p.installed) ?? packages[0]

  return {
    version: headline?.installed ?? null,
    latest: headline?.latest ?? null,
    upgradeAvailable: packages.some((p) => p.upgradable),
    packages
  }
}
