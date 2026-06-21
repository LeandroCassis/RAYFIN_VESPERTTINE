import { useCallback, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { FileContent, FileNode, StudioProject } from '@shared/ipc'
import { monacoLanguage } from '../monaco'

interface Props {
  project: StudioProject
  /** Bumped by the parent when files may have changed (e.g. after a chat turn). */
  refreshKey: number
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Track the app's resolved theme so Monaco matches light/dark. */
function useEditorTheme(): string {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light')
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.dataset.theme !== 'light'))
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark ? 'rayfin-dark' : 'rayfin-light'
}

interface TreeRowProps {
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelect: (node: FileNode) => void
}

function TreeRow({ node, depth, selectedPath, onSelect }: TreeRowProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const indent = 8 + depth * 12

  if (node.type === 'dir') {
    return (
      <div>
        <button
          className="tree-row tree-row--dir"
          style={{ paddingLeft: indent }}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="tree-caret">{open ? '▾' : '▸'}</span>
          <span className="tree-name">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      className={`tree-row tree-row--file${selectedPath === node.path ? ' tree-row--active' : ''}`}
      style={{ paddingLeft: indent + 14 }}
      onClick={() => onSelect(node)}
    >
      <span className="tree-name">{node.name}</span>
    </button>
  )
}

/** Read-only project code browser: a file tree + a Monaco (VS Code) viewer. */
export default function CodeViewer({ project, refreshKey }: Props): JSX.Element {
  const [tree, setTree] = useState<FileNode[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const theme = useEditorTheme()

  const loadTree = useCallback(async (): Promise<void> => {
    setTree(await window.api.projects.files.tree(project.id))
  }, [project.id])

  const readPath = useCallback(
    async (path: string): Promise<void> => {
      setLoading(true)
      try {
        setFile(await window.api.projects.files.read(project.id, path))
      } finally {
        setLoading(false)
      }
    },
    [project.id]
  )

  // Load (and refresh) the tree; re-read the open file when files may have changed.
  useEffect(() => {
    void loadTree()
  }, [loadTree, refreshKey])

  useEffect(() => {
    if (selected) void readPath(selected)
  }, [refreshKey, selected, readPath])

  const onSelect = useCallback((node: FileNode): void => {
    setSelected(node.path)
  }, [])

  const copy = (): void => {
    if (!file?.content) return
    void navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="code-viewer">
      <div className="code-tree">
        <div className="code-tree-head">
          <span>Files</span>
          <button className="btn btn--xs btn--ghost" onClick={() => void loadTree()} title="Refresh">
            ⟳
          </button>
        </div>
        <div className="code-tree-body">
          {tree === null ? (
            <div className="code-tree-empty">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="code-tree-empty">No files found.</div>
          ) : (
            tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selected}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>

      <div className="code-main">
        {selected && (
          <div className="code-head">
            <span className="code-path" title={selected}>
              {selected}
            </span>
            <span className="code-head-spacer" />
            {file && !file.error && file.size > 0 && (
              <span className="code-size">{formatBytes(file.size)}</span>
            )}
            {file?.content != null && (
              <button className="btn btn--xs btn--ghost" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        )}

        <div className="code-body">
          {!selected ? (
            <div className="code-empty">Select a file to view its code.</div>
          ) : loading ? (
            <div className="code-empty">Loading…</div>
          ) : file?.error ? (
            <div className="code-empty code-empty--err">{file.error}</div>
          ) : file?.binary ? (
            <div className="code-empty">Binary file — not shown.</div>
          ) : file?.tooLarge ? (
            <div className="code-empty">
              File is too large to preview ({formatBytes(file.size)}).
            </div>
          ) : file?.content === '' ? (
            <div className="code-empty">Empty file.</div>
          ) : file?.content != null ? (
            <div className="code-editor-host">
              <Editor
                height="100%"
                theme={theme}
                language={monacoLanguage(selected)}
                value={file.content}
                loading={<div className="code-empty">Loading editor…</div>}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 12.5,
                  fontFamily: "'Cascadia Code', 'Consolas', ui-monospace, monospace",
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  renderWhitespace: 'selection',
                  smoothScrolling: true,
                  automaticLayout: true,
                  wordWrap: 'off',
                  contextmenu: false,
                  scrollbar: { useShadows: false }
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
