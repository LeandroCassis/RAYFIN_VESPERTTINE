/**
 * Read-only git history + diffs for the in-app "History" view.
 *
 * Studio commits on the user's behalf (scaffold, each deploy, manual commits),
 * so a project's git log is effectively a timeline of "what the assistant did".
 * This module exposes that timeline and the before/after content for each
 * changed file in plain terms a non-coder can follow — the UI renders the
 * before/after with Monaco's diff editor.
 *
 * Everything is read-only and sandboxed to the project directory; the working
 * file read is traversal-guarded exactly like the file viewer.
 */

import { readFileSync, statSync } from 'fs'
import { resolve, sep } from 'path'
import { findProject } from './store'
import { run } from './exec'
import type {
  GitChange,
  GitChangeStatus,
  GitFileDiff,
  GitHistory,
  GitCommitSummary
} from '../../shared/ipc'
import { GIT_WORKING_REF } from '../../shared/ipc'

/** Cap the timeline so a long-lived repo can't blow up the IPC payload. */
const MAX_COMMITS = 200
/** Largest single side of a diff we'll ship to the viewer (1 MiB). */
const MAX_DIFF_BYTES = 1024 * 1024

/** Field/record separators for a robust `git log` format (never appear in text). */
const FIELD = '\x1f'
const RECORD = '\x1e'

/** Run git in a project, returning trimmed stdout (or null when the repo/cmd fails). */
async function git(cwd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const res = await run('git', ['-c', 'core.quotepath=false', ...args], { cwd, timeout: 30_000 })
  return { ok: res.ok, stdout: res.stdout, stderr: res.stderr }
}

/** Parse the shortstat trailer of a `git log` record into counts. */
function parseShortstat(lines: string[]): { filesChanged: number; insertions: number; deletions: number } {
  let filesChanged = 0
  let insertions = 0
  let deletions = 0
  for (const line of lines) {
    const files = line.match(/(\d+)\s+files?\s+changed/)
    if (!files) continue
    filesChanged = Number(files[1])
    const ins = line.match(/(\d+)\s+insertions?\(\+\)/)
    const del = line.match(/(\d+)\s+deletions?\(-\)/)
    insertions = ins ? Number(ins[1]) : 0
    deletions = del ? Number(del[1]) : 0
  }
  return { filesChanged, insertions, deletions }
}

/** Parse `git log --shortstat --pretty=…` output into commit summaries. */
function parseLog(stdout: string): GitCommitSummary[] {
  const commits: GitCommitSummary[] = []
  for (const record of stdout.split(RECORD)) {
    if (!record.trim()) continue
    const lines = record.split('\n')
    const [hash, shortHash, author, relativeDate, isoDate, subject] = lines[0].split(FIELD)
    if (!hash) continue
    const stat = parseShortstat(lines.slice(1))
    commits.push({
      hash,
      shortHash: shortHash ?? hash.slice(0, 7),
      author: author ?? '',
      relativeDate: relativeDate ?? '',
      isoDate: isoDate ?? '',
      subject: subject?.trim() || '(no message)',
      ...stat
    })
  }
  return commits
}

/** A project's commit timeline plus a count of not-yet-committed changes. */
export async function gitLog(id: string): Promise<GitHistory> {
  const project = findProject(id)
  if (!project) return { isRepo: false, commits: [], workingChanges: 0 }
  const cwd = project.path

  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    return { isRepo: false, commits: [], workingChanges: 0 }
  }

  const status = await git(cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  const workingChanges = status.ok
    ? status.stdout.split('\n').filter((l) => l.trim().length > 0).length
    : 0

  const fmt = `${RECORD}%H${FIELD}%h${FIELD}%an${FIELD}%ar${FIELD}%aI${FIELD}%s`
  const log = await git(cwd, ['log', '-n', String(MAX_COMMITS), '--shortstat', `--pretty=format:${fmt}`])
  if (!log.ok) {
    // A brand-new repo with no commits yet has nothing to log (but is a repo).
    return { isRepo: true, noCommits: true, commits: [], workingChanges }
  }
  return { isRepo: true, commits: parseLog(log.stdout), workingChanges }
}

/** Map a single git status letter (name-status / porcelain) to our union. */
function statusFromCode(code: string): GitChangeStatus {
  const c = code[0]
  if (c === 'A' || code === '??') return 'added'
  if (c === 'D') return 'deleted'
  if (c === 'R' || c === 'C') return 'renamed'
  return 'modified'
}

/**
 * Reconstruct the post-change path from a numstat path field, which encodes
 * renames as either `old => new` or `dir/{old => new}/file`.
 */
function numstatPath(raw: string): string {
  const braced = raw.replace(/\{[^}]*? => ([^}]*?)\}/g, '$1')
  const arrow = braced.indexOf(' => ')
  return (arrow === -1 ? braced : braced.slice(arrow + 4)).replace(/\/{2,}/g, '/')
}

/** Build a path → {insertions, deletions, binary} map from `--numstat` output. */
function parseNumstat(stdout: string): Map<string, { insertions: number; deletions: number; binary: boolean }> {
  const map = new Map<string, { insertions: number; deletions: number; binary: boolean }>()
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const tab = line.split('\t')
    if (tab.length < 3) continue
    const [ins, del, ...rest] = tab
    const path = numstatPath(rest.join('\t'))
    const binary = ins === '-' || del === '-'
    map.set(path, {
      insertions: binary ? 0 : Number(ins) || 0,
      deletions: binary ? 0 : Number(del) || 0,
      binary
    })
  }
  return map
}

/** Changed files for one commit (vs its parent), with status + line counts. */
async function commitChanges(cwd: string, hash: string): Promise<GitChange[]> {
  const nameStatus = await git(cwd, ['show', hash, '--name-status', '--format=', '-M'])
  if (!nameStatus.ok) return []
  const numstat = await git(cwd, ['show', hash, '--numstat', '--format=', '-M'])
  const counts = parseNumstat(numstat.ok ? numstat.stdout : '')

  const changes: GitChange[] = []
  for (const line of nameStatus.stdout.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const status = statusFromCode(parts[0])
    const renamed = status === 'renamed'
    const path = (renamed ? parts[2] : parts[1])?.trim()
    if (!path) continue
    const oldPath = renamed ? parts[1]?.trim() : undefined
    const c = counts.get(path) ?? { insertions: 0, deletions: 0, binary: false }
    changes.push({ path, oldPath, status, insertions: c.insertions, deletions: c.deletions, binary: c.binary || undefined })
  }
  return changes
}

/** Changed files in the working tree (vs HEAD), including untracked files. */
async function workingChangeList(cwd: string): Promise<GitChange[]> {
  const status = await git(cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (!status.ok) return []
  const numstat = await git(cwd, ['diff', '--numstat', 'HEAD'])
  const counts = parseNumstat(numstat.ok ? numstat.stdout : '')

  const changes: GitChange[] = []
  for (const raw of status.stdout.split('\n')) {
    if (!raw.trim()) continue
    const code = raw.slice(0, 2)
    const rest = raw.slice(3)
    const renamed = code.includes('R')
    let path = rest
    let oldPath: string | undefined
    if (renamed && rest.includes(' -> ')) {
      const [from, to] = rest.split(' -> ')
      oldPath = from.trim()
      path = to.trim()
    }
    path = path.trim().replace(/^"|"$/g, '')
    if (!path) continue
    const status2 = statusFromCode(code.trim() || code)
    const c = counts.get(path) ?? { insertions: 0, deletions: 0, binary: false }
    changes.push({
      path,
      oldPath,
      status: code === '??' ? 'added' : status2,
      insertions: c.insertions,
      deletions: c.deletions,
      binary: c.binary || undefined
    })
  }
  return changes
}

/** List the files changed by a commit (`ref` = SHA) or the working tree. */
export async function gitChanges(id: string, ref: string): Promise<GitChange[]> {
  const project = findProject(id)
  if (!project) return []
  const cwd = project.path
  const list = ref === GIT_WORKING_REF ? await workingChangeList(cwd) : await commitChanges(cwd, ref)
  return list.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }))
}

/** Resolve a project-relative path, guarding against directory traversal. */
function safeResolve(root: string, relPath: string): string | null {
  const target = resolve(root, relPath)
  const rootResolved = resolve(root)
  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) return null
  return target
}

/** Return the content of `path` at a git revision (empty string when absent). */
async function showAt(cwd: string, rev: string, path: string): Promise<string> {
  const res = await run('git', ['-c', 'core.quotepath=false', 'show', `${rev}:${path}`], {
    cwd,
    timeout: 30_000
  })
  return res.ok ? res.stdout : ''
}

/** Read a working-tree file from disk (empty string when missing/unreadable). */
function readWorking(root: string, relPath: string): string {
  const target = safeResolve(root, relPath)
  if (!target) return ''
  try {
    if (!statSync(target).isFile()) return ''
    return readFileSync(target, 'utf8')
  } catch {
    return ''
  }
}

const looksBinary = (s: string): boolean => s.includes('\u0000')

/**
 * Before/after content for one changed file, to drive a side-by-side diff.
 * `ref` is a commit SHA (diffed against its parent) or the working-tree
 * sentinel (diffed against HEAD). `oldPath` carries the pre-rename path.
 */
export async function gitFileDiff(
  id: string,
  ref: string,
  path: string,
  oldPath?: string
): Promise<GitFileDiff> {
  const project = findProject(id)
  if (!project) return { path, status: 'modified', before: '', after: '', error: 'Project not found.' }
  const cwd = project.path

  let before = ''
  let after = ''
  if (ref === GIT_WORKING_REF) {
    before = await showAt(cwd, 'HEAD', oldPath ?? path)
    after = readWorking(cwd, path)
  } else {
    before = await showAt(cwd, `${ref}^`, oldPath ?? path)
    after = await showAt(cwd, ref, path)
  }

  const status: GitChangeStatus = oldPath ? 'renamed' : before && !after ? 'deleted' : !before && after ? 'added' : 'modified'

  if (looksBinary(before) || looksBinary(after)) {
    return { path, oldPath, status, before: '', after: '', binary: true }
  }
  if (before.length > MAX_DIFF_BYTES || after.length > MAX_DIFF_BYTES) {
    return { path, oldPath, status, before: '', after: '', tooLarge: true }
  }
  return { path, oldPath, status, before, after }
}
