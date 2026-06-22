import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { run } from './exec'
import { trackSignin, type TelemetryIdentity } from './telemetry'
import type {
  AuthStatus,
  CopilotAuthStatus,
  ProcResult,
  RayfinAuthStatus
} from '../../shared/ipc'

type StreamCb = (stream: 'stdout' | 'stderr', chunk: string) => void

/**
 * Last-known signed-in Fabric/Rayfin identity, cached so telemetry (e.g. the
 * deploy event) can attach a stable hashed user without re-spawning the CLI.
 * Updated every time we resolve Rayfin auth.
 */
let cachedIdentity: TelemetryIdentity | null = null
/** Guard so the "active at startup" signin event fires at most once per process. */
let startupSigninSent = false

/** The most recently resolved signed-in identity (or null when signed out). */
export function getCachedIdentity(): TelemetryIdentity | null {
  return cachedIdentity
}

interface CopilotUser {
  host?: string
  login?: string
}

/**
 * Strip line and block comments from JSONC while preserving string contents
 * (Copilot's config.json is JSONC and contains URLs like "https://github.com"
 * that a naive strip would mangle).
 */
function stripJsonComments(input: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    const next = input[i + 1]
    if (inString) {
      out += c
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === '/' && next === '/') {
      i += 2
      while (i < input.length && input[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++
      i++
      continue
    }
    out += c
  }
  return out
}

/**
 * Copilot stores logged-in user info in ~/.copilot/config.json
 * (loggedInUsers / lastLoggedInUser); the OAuth token itself lives in the OS
 * credential store. Reading this file is a cheap, non-interactive auth probe
 * that does not consume an AI request. The file is JSONC (contains comments).
 */
export async function getCopilotAuth(): Promise<CopilotAuthStatus> {
  try {
    const cfgPath = join(homedir(), '.copilot', 'config.json')
    const raw = await readFile(cfgPath, 'utf8')
    const cfg = JSON.parse(stripJsonComments(raw)) as {
      loggedInUsers?: CopilotUser[] | Record<string, unknown>
      lastLoggedInUser?: string | CopilotUser
    }

    const users = cfg.loggedInUsers
    let signedIn = false
    let firstLogin: string | undefined
    if (Array.isArray(users)) {
      signedIn = users.length > 0
      firstLogin = users[0]?.login
    } else if (users && typeof users === 'object') {
      signedIn = Object.keys(users).length > 0
    }

    const llu = cfg.lastLoggedInUser
    const lastLogin =
      typeof llu === 'string' ? llu : llu && typeof llu === 'object' ? llu.login : undefined

    return { signedIn, user: lastLogin ?? firstLogin }
  } catch {
    return { signedIn: false }
  }
}

/** Detect Fabric/Rayfin auth via `rayfin login status` (exit 0 + parsed text). */
export async function getRayfinAuth(): Promise<RayfinAuthStatus> {
  const res = await run('rayfin', ['login', 'status'], { timeout: 30_000 })
  const text = `${res.stdout}\n${res.stderr}`
  // `rayfin login status` prints "✅ Signed in" when authenticated and
  // "❌ Not signed in" otherwise. The negative message still contains the
  // substring "signed in", so a bare /signed in/ test reports a signed-out
  // user as signed in — which made "Sign out" appear to do nothing (the app
  // never routed back to the setup screen). Guard against the negative form.
  const signedIn = res.ok && !/not\s+signed\s+in/i.test(text) && /signed\s+in/i.test(text)
  if (!signedIn) {
    cachedIdentity = null
    return { signedIn: false }
  }
  const status: RayfinAuthStatus = {
    signedIn: true,
    user: text.match(/User:\s*(.+)/i)?.[1]?.trim(),
    tenant: text.match(/Tenant:\s*(.+)/i)?.[1]?.trim()
  }
  cachedIdentity = { email: status.user, tenant: status.tenant }
  return status
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const [copilot, rayfin] = await Promise.all([getCopilotAuth(), getRayfinAuth()])
  // Fire one "active at startup" signin per process for users who are already
  // signed in (powers MAU/DAU/WAU without forcing a fresh login). The explicit
  // login event below covers brand-new sign-ins.
  if (rayfin.signedIn && !startupSigninSent) {
    startupSigninSent = true
    trackSignin(cachedIdentity, 'startup')
  }
  return { copilot, rayfin }
}

export async function loginCopilot(onData?: StreamCb): Promise<ProcResult> {
  onData?.('stdout', 'Starting GitHub Copilot sign-in…\n')
  const res = await run('copilot', ['login'], { onData, timeout: 5 * 60_000 })
  return { ok: res.ok, exitCode: res.exitCode }
}

export async function loginRayfin(tenant?: string, onData?: StreamCb): Promise<ProcResult> {
  onData?.('stdout', 'Starting Fabric / Rayfin sign-in…\n')
  const args = ['login', '--select']
  if (tenant && tenant.trim()) args.push('--tenant', tenant.trim())
  const res = await run('rayfin', args, { onData, timeout: 5 * 60_000 })
  // On a successful sign-in, refresh the cached identity and record the event.
  if (res.ok) {
    await getRayfinAuth()
    trackSignin(cachedIdentity, 'login')
  }
  return { ok: res.ok, exitCode: res.exitCode }
}

export async function logoutRayfin(onData?: StreamCb): Promise<ProcResult> {
  const res = await run('rayfin', ['logout'], { onData, timeout: 60_000 })
  if (res.ok) cachedIdentity = null
  return { ok: res.ok, exitCode: res.exitCode }
}
