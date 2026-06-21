import { useCallback, useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import type {
  GitChange,
  GitChangeStatus,
  GitFileDiff,
  GitHistory,
  StudioProject
} from '@shared/ipc'
import { GIT_WORKING_REF } from '@shared/ipc'
import { monacoLanguage } from '../monaco'

interface Props {
  project: StudioProject
  /** Bumped by the parent when history may have changed (e.g. after a deploy). */
  refreshKey: number
  /** Resolved Monaco theme id (light/dark) from the parent. */
  theme: string
}

/** Friendly, non-coder-facing labels for each kind of change. */
const STATUS_LABEL: Record<GitChangeStatus, string> = {
  added: 'Added',
  modified: 'Edited',
  deleted: 'Deleted',
  renamed: 'Renamed'
}

function splitPath(p: string): { name: string; dir: string } {
  const i = p.lastIndexOf('/')
  return i === -1 ? { name: p, dir: '' } : { name: p.slice(i + 1), dir: p.slice(0, i) }
}

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`
}

/** A small "+12 −3" line-change indicator. */
function ChangeStat({ ins, del }: { ins: number; del: number }): JSX.Element | null {
  if (ins === 0 && del === 0) return null
  return (
    <span className="hist-stat">
      {ins > 0 && <span className="hist-stat-add">+{ins}</span>}
      {del > 0 && <span className="hist-stat-del">−{del}</span>}
    </span>
  )
}

const DIFF_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 12.5,
  lineHeight: 19,
  fontFamily: "'Cascadia Code', 'Consolas', ui-monospace, monospace",
  automaticLayout: true,
  wordWrap: 'off' as const,
  contextmenu: false,
  renderOverviewRuler: false,
  scrollbar: { useShadows: false },
  diffWordWrap: 'off' as const
}

/**
 * The "History" view: a vibe-coder-friendly timeline of everything that changed
 * in the project. Studio commits on the user's behalf (scaffold + every deploy),
 * so the git log reads as a plain-English list of "what happened". Picking an
 * entry lists its changed files; picking a file shows a clear before/after diff.
 */
export default function HistoryView({ project, refreshKey, theme }: Props): JSX.Element {
  const [history, setHistory] = useState<GitHistory | null>(null)
  const [ref, setRef] = useState<string | null>(null)
  const [changes, setChanges] = useState<GitChange[] | null>(null)
  const [changesLoading, setChangesLoading] = useState(false)
  const [file, setFile] = useState<GitChange | null>(null)
  const [diff, setDiff] = useState<GitFileDiff | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)

  // Load (and refresh) the timeline; default the selection to the newest entry.
  useEffect(() => {
    let live = true
    void window.api.projects.git.log(project.id).then((h) => {
      if (!live) return
      setHistory(h)
      setRef((prev) => {
        if (prev && (prev === GIT_WORKING_REF || h.commits.some((c) => c.hash === prev))) return prev
        if (h.workingChanges > 0) return GIT_WORKING_REF
        return h.commits[0]?.hash ?? null
      })
    })
    return () => {
      live = false
    }
  }, [project.id, refreshKey])

  // When the selected entry changes, load its changed files and open the first.
  useEffect(() => {
    if (!ref) {
      setChanges(null)
      setFile(null)
      return
    }
    let live = true
    setChangesLoading(true)
    void window.api.projects.git
      .changes(project.id, ref)
      .then((c) => {
        if (!live) return
        setChanges(c)
        setFile(c[0] ?? null)
      })
      .finally(() => {
        if (live) setChangesLoading(false)
      })
    return () => {
      live = false
    }
  }, [project.id, ref, refreshKey])

  // When the selected file changes, load its before/after for the diff editor.
  useEffect(() => {
    if (!ref || !file || file.binary) {
      setDiff(null)
      return
    }
    let live = true
    setDiffLoading(true)
    void window.api.projects.git
      .fileDiff(project.id, ref, file.path, file.oldPath)
      .then((d) => {
        if (live) setDiff(d)
      })
      .finally(() => {
        if (live) setDiffLoading(false)
      })
    return () => {
      live = false
    }
  }, [project.id, ref, file])

  const selectRef = useCallback((next: string): void => {
    setRef(next)
    setFile(null)
    setDiff(null)
  }, [])

  const commits = history?.commits ?? []
  const working = history?.workingChanges ?? 0
  const selectedCommit = ref && ref !== GIT_WORKING_REF ? commits.find((c) => c.hash === ref) : null

  if (history && !history.isRepo) {
    return (
      <div className="code-empty">
        This project isn’t tracked by git yet, so there’s no history to show.
      </div>
    )
  }
  if (history && history.commits.length === 0 && working === 0) {
    return (
      <div className="hist-empty">
        <div className="hist-empty-title">No history yet</div>
        <div className="hist-empty-sub">
          Every time you deploy or save, Rayfin Fabricator records a snapshot here so you can see
          exactly what changed.
        </div>
      </div>
    )
  }

  return (
    <div className="hist">
      <div className="hist-rail">
        <div className="hist-rail-head">
          <span>Timeline</span>
          <span className="hist-rail-hint">newest first</span>
        </div>
        <div className="hist-rail-body">
          {history === null ? (
            <div className="code-tree-empty">Loading…</div>
          ) : (
            <>
              {working > 0 && (
                <button
                  className={`hist-commit hist-commit--working${ref === GIT_WORKING_REF ? ' hist-commit--sel' : ''}`}
                  onClick={() => selectRef(GIT_WORKING_REF)}
                >
                  <span className="hist-commit-dot hist-commit-dot--working" />
                  <span className="hist-commit-main">
                    <span className="hist-commit-msg">Uncommitted changes</span>
                    <span className="hist-commit-meta">
                      {plural(working, 'file')} changed · not deployed yet
                    </span>
                  </span>
                </button>
              )}
              {commits.map((c) => (
                <button
                  key={c.hash}
                  className={`hist-commit${ref === c.hash ? ' hist-commit--sel' : ''}`}
                  onClick={() => selectRef(c.hash)}
                  title={`${c.shortHash} · ${new Date(c.isoDate).toLocaleString()}`}
                >
                  <span className="hist-commit-dot" />
                  <span className="hist-commit-main">
                    <span className="hist-commit-msg">{c.subject}</span>
                    <span className="hist-commit-meta">
                      {c.relativeDate}
                      {c.author ? ` · ${c.author}` : ''}
                    </span>
                  </span>
                  {c.filesChanged > 0 && <span className="hist-commit-count">{c.filesChanged}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="hist-files">
        <div className="hist-files-head">
          {ref === GIT_WORKING_REF ? (
            <span className="hist-files-title">Uncommitted changes</span>
          ) : selectedCommit ? (
            <span className="hist-files-title" title={selectedCommit.subject}>
              {selectedCommit.subject}
            </span>
          ) : (
            <span className="hist-files-title">Changes</span>
          )}
          {changes && changes.length > 0 && (
            <span className="hist-files-sub">{plural(changes.length, 'file')} changed</span>
          )}
        </div>
        <div className="hist-files-body">
          {changesLoading ? (
            <div className="code-tree-empty">Loading…</div>
          ) : !changes || changes.length === 0 ? (
            <div className="code-tree-empty">
              {ref === GIT_WORKING_REF ? 'Nothing changed since the last snapshot.' : 'No file changes.'}
            </div>
          ) : (
            changes.map((f) => {
              const { name, dir } = splitPath(f.path)
              const selected = file?.path === f.path
              return (
                <button
                  key={f.path}
                  className={`hist-file${selected ? ' hist-file--sel' : ''}`}
                  onClick={() => setFile(f)}
                  title={f.path}
                >
                  <span className={`hist-file-badge hist-file-badge--${f.status}`}>
                    {STATUS_LABEL[f.status]}
                  </span>
                  <span className="hist-file-name">{name}</span>
                  {dir && <span className="hist-file-dir">{dir}</span>}
                  {f.binary ? (
                    <span className="hist-file-binary">binary</span>
                  ) : (
                    <ChangeStat ins={f.insertions} del={f.deletions} />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="hist-diff">
        {file && (
          <div className="hist-diff-head">
            <span className="hist-diff-path" title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
              {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
            </span>
            <span className="hist-diff-spacer" />
            <div className="hist-seg" role="tablist" aria-label="Diff layout">
              <button
                className={`hist-seg-btn${sideBySide ? ' hist-seg-btn--on' : ''}`}
                onClick={() => setSideBySide(true)}
              >
                Side by side
              </button>
              <button
                className={`hist-seg-btn${sideBySide ? '' : ' hist-seg-btn--on'}`}
                onClick={() => setSideBySide(false)}
              >
                Unified
              </button>
            </div>
          </div>
        )}
        <div className="hist-diff-body">
          {!file ? (
            <div className="code-empty">Select a file to see what changed.</div>
          ) : file.binary ? (
            <div className="code-empty">This is an image or binary file — no text diff to show.</div>
          ) : diffLoading ? (
            <div className="code-empty">Loading…</div>
          ) : diff?.error ? (
            <div className="code-empty code-empty--err">{diff.error}</div>
          ) : diff?.tooLarge ? (
            <div className="code-empty">This file is too large to show a diff.</div>
          ) : diff ? (
            <DiffEditor
              key={`${ref}:${file.path}`}
              height="100%"
              theme={theme}
              language={monacoLanguage(file.path)}
              original={diff.before}
              modified={diff.after}
              loading={<div className="code-empty">Loading editor…</div>}
              options={{ ...DIFF_OPTIONS, renderSideBySide: sideBySide }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
