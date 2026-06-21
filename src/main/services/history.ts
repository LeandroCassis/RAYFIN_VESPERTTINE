/**
 * Per-project chat history persistence so a conversation survives app restarts.
 *
 * The Copilot CLI session id is persisted on the project (see store.ts), which
 * preserves the *agent's* memory; this module persists the *UI transcript* so
 * the two stay in sync. Each project's messages are stored in their own JSON
 * file under `userData/chats/` to avoid rewriting the whole app state (and to
 * keep large transcripts out of the main store file).
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs'
import type { ChatMessage } from '../../shared/ipc'

/** Keep transcripts bounded; older messages beyond this are dropped on save. */
const MAX_MESSAGES = 1000

function chatsDir(): string {
  return join(app.getPath('userData'), 'chats')
}

/** Restrict the on-disk filename to a safe slug derived from the project id. */
function historyFile(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
  return join(chatsDir(), `${safe || 'unknown'}.json`)
}

/** Coerce arbitrary persisted JSON into a clean ChatMessage[]. */
function sanitize(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return []
  const out: ChatMessage[] = []
  for (const item of input) {
    const m = item as Partial<ChatMessage>
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    out.push({
      id: String(m.id ?? ''),
      role: m.role,
      text: typeof m.text === 'string' ? m.text : '',
      tools: Array.isArray(m.tools) ? m.tools : [],
      error: typeof m.error === 'string' ? m.error : undefined,
      attachments: typeof m.attachments === 'number' ? m.attachments : undefined
    })
  }
  return out
}

/** Load a project's persisted conversation (empty array when none/invalid). */
export function loadHistory(projectId: string): ChatMessage[] {
  try {
    return sanitize(JSON.parse(readFileSync(historyFile(projectId), 'utf8')))
  } catch {
    return []
  }
}

/** Persist a project's conversation. An empty array removes the file. */
export function saveHistory(projectId: string, messages: ChatMessage[]): void {
  const clean = sanitize(messages).slice(-MAX_MESSAGES)
  const file = historyFile(projectId)
  if (clean.length === 0) {
    try {
      rmSync(file, { force: true })
    } catch {
      /* best-effort */
    }
    return
  }
  const dir = chatsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(clean), 'utf8')
}

/** Delete a project's persisted conversation (used when a project is removed). */
export function clearHistory(projectId: string): void {
  try {
    rmSync(historyFile(projectId), { force: true })
  } catch {
    /* best-effort */
  }
}
