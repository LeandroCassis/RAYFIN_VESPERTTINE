/**
 * Fabric account helpers — enumerate the signed-in user's workspaces and their
 * capacity SKUs so the UI can offer a real workspace picker and flag which
 * workspaces are backed by a Fabric **F-SKU** capacity (the only kind that can
 * host a Rayfin app).
 *
 * There is no `rayfin workspace list` command, so we call the Fabric REST API
 * (`/workspaces` + `/capacities`) ourselves. The bearer token is acquired
 * *silently* by reusing the Rayfin CLI's own MSAL token cache: we spawn a tiny
 * Node helper that imports the globally-installed `@microsoft/rayfin-cli` auth
 * module, runs its silent-only token path, performs the two fetches, joins
 * them, and emits only the resulting workspace list. The access token never
 * leaves that short-lived child process.
 *
 * Why a separate `node` process (not Electron's main)? The CLI's auth stack
 * pulls in native modules (msal-node-extensions / DPAPI / keytar) built against
 * the *system* Node ABI. Loading them inside Electron (a different
 * NODE_MODULE_VERSION) is unreliable, so we run the helper under the same
 * `node` the CLI itself uses.
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { run } from './exec'
import type { FabricWorkspacesResult } from '../../shared/ipc'

const FABRIC_API_BASE = 'https://api.fabric.microsoft.com/v1'

/**
 * Helper executed by the system `node`. argv: <authModulePath> <apiBase>.
 * Writes exactly one JSON line to stdout; all incidental library logging is
 * redirected to stderr so stdout stays parseable.
 */
const HELPER_SOURCE = `
// Keep stdout clean for the JSON result; route any library logging to stderr.
console.log = (...a) => process.stderr.write(a.map(String).join(' ') + '\\n')
console.debug = console.log
console.info = console.log

import { pathToFileURL } from 'node:url'

async function main() {
  const [authPath, base] = process.argv.slice(2)
  const auth = await import(pathToFileURL(authPath).href)
  const rf = await auth.getRayfinAuth()
  // silentOnly: never pop a browser — fail fast if there's no cached session.
  const { token } = await rf.acquireToken(undefined, { silentOnly: true })
  const headers = { Authorization: 'Bearer ' + token }

  const wsRes = await fetch(base + '/workspaces', { headers })
  if (!wsRes.ok) throw new Error('Fabric /workspaces request failed (' + wsRes.status + ')')
  const wsJson = await wsRes.json()

  // Capacities give us the SKU (F-SKU detection); tolerate failure (some
  // tenants restrict the endpoint) by degrading to workspaces without SKUs.
  let caps = []
  try {
    const capRes = await fetch(base + '/capacities', { headers })
    if (capRes.ok) caps = (await capRes.json()).value || []
  } catch {}
  const capById = new Map(caps.map((c) => [c.id, c]))

  const kindOf = (sku) => {
    if (!sku) return 'none'
    const s = String(sku).toUpperCase()
    if (s.startsWith('F')) return 'fabric'
    if (s.startsWith('P')) return 'premium'
    return 'other'
  }

  const workspaces = (wsJson.value || []).map((w) => {
    const cap = w.capacityId ? capById.get(w.capacityId) : undefined
    const sku = cap && cap.sku ? String(cap.sku) : undefined
    const capacityKind = kindOf(sku)
    return {
      id: w.id,
      displayName: w.displayName,
      type: w.type,
      capacityId: w.capacityId,
      region: w.capacityRegion || (cap && cap.region) || undefined,
      sku,
      capacityName: cap && cap.displayName ? cap.displayName : undefined,
      capacityKind,
      // Only Fabric (F-SKU) or Power BI Premium (P-SKU) capacities can host a Rayfin app.
      eligible: capacityKind === 'fabric' || capacityKind === 'premium'
    }
  })
  process.stdout.write(JSON.stringify({ ok: true, workspaces }))
}

main().catch((err) => {
  const msg = err && err.message ? String(err.message) : String(err)
  const needsLogin = /silent|cached|account|login|token|interactive|sign/i.test(msg)
  process.stdout.write(JSON.stringify({ ok: false, needsLogin, error: msg }))
})
`

let cliAuthModulePath: string | null = null
let cliAuthResolved = false

/** Resolve the global rayfin-cli's auth entry module path (cached per run). */
async function resolveCliAuthModule(): Promise<string | null> {
  if (cliAuthResolved) return cliAuthModulePath
  cliAuthResolved = true
  const res = await run('npm', ['root', '-g'], { timeout: 30_000 })
  const root = res.stdout.trim()
  if (res.ok && root) {
    const candidate = join(root, '@microsoft', 'rayfin-cli', 'dist', 'auth', 'index.js')
    if (existsSync(candidate)) cliAuthModulePath = candidate
  }
  return cliAuthModulePath
}

/** Write the helper to a stable per-user path and return it. */
function ensureHelperScript(): string {
  const scriptPath = join(app.getPath('userData'), 'fabric-workspaces.mjs')
  writeFileSync(scriptPath, HELPER_SOURCE, 'utf8')
  return scriptPath
}

/**
 * List the signed-in user's Fabric workspaces, each annotated with its
 * capacity SKU and whether that capacity is a Fabric F-SKU. Returns a
 * structured result (never throws): `ok:false` with `needsLogin` when there is
 * no cached Fabric session, or with `error` for any other failure so the UI
 * can fall back to manual entry.
 */
export async function listFabricWorkspaces(): Promise<FabricWorkspacesResult> {
  const authPath = await resolveCliAuthModule()
  if (!authPath) {
    return {
      ok: false,
      error:
        'Could not locate the Rayfin CLI to list Fabric workspaces. Make sure the rayfin CLI is installed.'
    }
  }

  let scriptPath: string
  try {
    scriptPath = ensureHelperScript()
  } catch (err) {
    return { ok: false, error: `Could not prepare the workspace lookup helper: ${String(err)}` }
  }

  const res = await run('node', [scriptPath, authPath, FABRIC_API_BASE], { timeout: 60_000 })
  if (res.notFound) return { ok: false, error: 'Node.js was not found on PATH.' }

  const out = res.stdout.trim()
  try {
    const parsed = JSON.parse(out) as FabricWorkspacesResult
    if (parsed.ok && parsed.workspaces) {
      // Eligible (Fabric / Premium) workspaces first, then alphabetically.
      parsed.workspaces.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
        return a.displayName.localeCompare(b.displayName)
      })
    }
    return parsed
  } catch {
    const err =
      res.stderr.trim() || out || `Workspace lookup failed (exit ${res.exitCode ?? 'unknown'}).`
    const needsLogin = /silent|cached|account|login|token|sign/i.test(err)
    return { ok: false, needsLogin, error: err }
  }
}
