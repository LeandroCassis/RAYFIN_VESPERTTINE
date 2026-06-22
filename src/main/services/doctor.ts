/**
 * Environment doctor: detects the external tools Rayfin Fabricator depends on and
 * can auto-install them — the npm-distributed CLIs (rayfin, copilot) via `npm -g`,
 * and the system prerequisites (Node.js, Git) via the OS package manager
 * (winget on Windows, Homebrew on macOS), falling back to the official installer.
 */

import { shell } from 'electron'
import { run, tryVersion } from './exec'
import type { DoctorReport, InstallResult, ToolId, ToolStatus } from '../../shared/ipc'

type StreamCb = (stream: 'stdout' | 'stderr', chunk: string) => void

interface ToolDef {
  id: ToolId
  name: string
  bin: string
  versionArgs: string[]
  required: boolean
  /** npm package to install globally, when auto-installable that way. */
  npmPackage?: string
  /** System package-manager ids, for prerequisites installed outside npm. */
  system?: { winget?: string; brew?: string }
  installHint: string
  installUrl?: string
}

const TOOLS: ToolDef[] = [
  {
    id: 'node',
    name: 'Node.js',
    bin: 'node',
    versionArgs: ['--version'],
    required: true,
    system: { winget: 'OpenJS.NodeJS.LTS', brew: 'node' },
    installHint: 'Install Node.js 18+ (includes npm).',
    installUrl: 'https://nodejs.org/en/download'
  },
  {
    id: 'npm',
    name: 'npm',
    bin: 'npm',
    versionArgs: ['--version'],
    required: true,
    installHint: 'npm ships with Node.js.',
    installUrl: 'https://nodejs.org/en/download'
  },
  {
    id: 'git',
    name: 'Git',
    bin: 'git',
    versionArgs: ['--version'],
    required: true,
    system: { winget: 'Git.Git', brew: 'git' },
    installHint: 'Install Git for version control of your apps.',
    installUrl: 'https://git-scm.com/downloads'
  },
  {
    id: 'rayfin',
    name: 'Rayfin CLI',
    bin: 'rayfin',
    versionArgs: ['--version'],
    required: true,
    npmPackage: '@microsoft/rayfin-cli',
    installHint: 'Scaffolds and deploys Rayfin apps to Microsoft Fabric.',
    installUrl: 'https://aka.ms/rayfin/docs'
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    bin: 'copilot',
    versionArgs: ['--version'],
    required: true,
    npmPackage: '@github/copilot',
    installHint: 'The AI agent that writes and edits your app code.',
    installUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli'
  }
]

const TOOLS_BY_ID: Record<ToolId, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t])
) as Record<ToolId, ToolDef>

/** Whether the OS package manager can install this tool on the current platform. */
function systemInstallable(def: ToolDef): boolean {
  if (!def.system) return false
  if (process.platform === 'win32') return Boolean(def.system.winget)
  if (process.platform === 'darwin') return Boolean(def.system.brew)
  return false
}

/** Whether the app can install this tool itself (npm package or system manager). */
function isAutoInstallable(def: ToolDef): boolean {
  return Boolean(def.npmPackage) || systemInstallable(def)
}

function parseVersion(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/\d+\.\d+\.\d+(?:[-.][\w.]+)?/)
  return m ? m[0] : raw.trim()
}

async function checkTool(def: ToolDef): Promise<ToolStatus> {
  const raw = await tryVersion(def.bin, def.versionArgs)
  return {
    id: def.id,
    name: def.name,
    found: raw !== null,
    version: parseVersion(raw),
    installHint: def.installHint,
    installUrl: def.installUrl,
    autoInstallable: isAutoInstallable(def),
    required: def.required
  }
}

export async function checkEnvironment(): Promise<DoctorReport> {
  const tools = await Promise.all(TOOLS.map(checkTool))
  const ready = tools.filter((t) => t.required).every((t) => t.found)
  return { tools, ready }
}

/** Install a global npm package (used for the rayfin / copilot CLIs). */
async function installNpmTool(def: ToolDef, onData?: StreamCb): Promise<InstallResult> {
  const pkg = def.npmPackage as string
  onData?.('stdout', `Installing ${pkg} globally via npm…\n`)
  const res = await run('npm', ['install', '-g', pkg], { onData, timeout: 5 * 60_000 })
  if (res.notFound) {
    onData?.('stderr', '\nnpm was not found. Install Node.js first, then restart.\n')
    return { ok: false, exitCode: res.exitCode, requiresRelaunch: true }
  }
  if (res.ok) onData?.('stdout', `\nInstalled ${pkg}.\n`)
  else onData?.('stderr', `\nInstall failed (exit ${res.exitCode}).\n`)
  return { ok: res.ok, exitCode: res.exitCode }
}

/**
 * Install a system prerequisite (Node.js / Git) via the OS package manager, with
 * an official-installer fallback. A successful package-manager install puts the
 * tool on PATH for *new* processes only, so the app must relaunch to see it.
 */
async function installSystemTool(def: ToolDef, onData?: StreamCb): Promise<InstallResult> {
  if (process.platform === 'win32' && def.system?.winget) {
    const hasWinget = (await tryVersion('winget', ['--version'])) !== null
    if (hasWinget) {
      onData?.('stdout', `Installing ${def.name} via winget (you may see a permission prompt)…\n`)
      const res = await run(
        'winget',
        [
          'install',
          '-e',
          '--id',
          def.system.winget,
          '--silent',
          '--accept-source-agreements',
          '--accept-package-agreements'
        ],
        { onData, timeout: 15 * 60_000 }
      )
      if (res.ok) {
        onData?.('stdout', `\nInstalled ${def.name}. Restart Rayfin Fabricator to finish setup.\n`)
        return { ok: true, exitCode: res.exitCode, requiresRelaunch: true }
      }
      onData?.(
        'stderr',
        `\nwinget could not install ${def.name} (exit ${res.exitCode}). Opening the official installer…\n`
      )
    } else {
      onData?.('stderr', `\nwinget is unavailable. Opening the official ${def.name} installer…\n`)
    }
  } else if (process.platform === 'darwin' && def.system?.brew) {
    const hasBrew = (await tryVersion('brew', ['--version'])) !== null
    if (hasBrew) {
      onData?.('stdout', `Installing ${def.name} via Homebrew…\n`)
      const res = await run('brew', ['install', def.system.brew], { onData, timeout: 15 * 60_000 })
      if (res.ok) {
        onData?.('stdout', `\nInstalled ${def.name}. Restart Rayfin Fabricator to finish setup.\n`)
        return { ok: true, exitCode: res.exitCode, requiresRelaunch: true }
      }
      onData?.(
        'stderr',
        `\nHomebrew could not install ${def.name} (exit ${res.exitCode}). Opening the official installer…\n`
      )
    } else {
      onData?.('stderr', `\nHomebrew is unavailable. Opening the official ${def.name} installer…\n`)
    }
  }

  // Fallback: open the official download page so the user can install manually.
  if (def.installUrl) {
    await shell.openExternal(def.installUrl)
    onData?.('stdout', `\nOpened ${def.installUrl}. Install ${def.name}, then click “Restart”.\n`)
  }
  return { ok: false, exitCode: null, manual: true }
}

/** Install a single auto-installable tool by id. */
export async function installTool(id: ToolId, onData?: StreamCb): Promise<InstallResult> {
  const def = TOOLS_BY_ID[id]
  if (!def) return { ok: false, exitCode: null }
  if (def.npmPackage) return installNpmTool(def, onData)
  if (systemInstallable(def)) return installSystemTool(def, onData)
  onData?.('stderr', `${def.name} cannot be installed automatically on this platform.\n`)
  if (def.installUrl) await shell.openExternal(def.installUrl)
  return { ok: false, exitCode: null, manual: true }
}

/**
 * Install every missing required tool in dependency order. System prerequisites
 * (Node, Git) come first; the npm-based CLIs need Node on PATH, so if any system
 * tool was just installed we stop and ask the caller to relaunch — after the
 * restart this can be called again to finish the npm installs.
 */
export async function installAllMissing(onData?: StreamCb): Promise<InstallResult> {
  const report = await checkEnvironment()
  const missing = report.tools.filter((t) => t.required && !t.found)
  if (missing.length === 0) return { ok: true, exitCode: 0 }

  // Phase 1 — system prerequisites (Node first so npm becomes available, then Git).
  const order: ToolId[] = ['node', 'git']
  const systemMissing = order
    .map((id) => TOOLS_BY_ID[id])
    .filter((def) => missing.some((m) => m.id === def.id) && systemInstallable(def))

  if (systemMissing.length > 0) {
    let allOk = true
    for (const def of systemMissing) {
      onData?.('stdout', `\n\u203a Installing ${def.name}\n`)
      const res = await installSystemTool(def, onData)
      allOk = allOk && res.ok
    }
    // Whether or not every install reported success, Node/Git only appear after a
    // restart — always relaunch before attempting the Node-dependent npm installs.
    return { ok: allOk, exitCode: allOk ? 0 : null, requiresRelaunch: true }
  }

  // Phase 2 — npm CLIs (Node is present). Install copilot + rayfin.
  let allOk = true
  let lastExit: number | null = 0
  for (const def of TOOLS.filter((t) => t.npmPackage && missing.some((m) => m.id === t.id))) {
    onData?.('stdout', `\n\u203a Installing ${def.name}\n`)
    const res = await installNpmTool(def, onData)
    allOk = allOk && res.ok
    if (!res.ok) lastExit = res.exitCode
  }
  return { ok: allOk, exitCode: lastExit }
}
