import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  FabricBackupResult,
  FabricItem,
  FabricWorkspace
} from '@shared/ipc'
import { Codicon } from './icons'

interface Props {
  organizationId?: string
  tenantId?: string
  onImported: () => void
}

function itemTypeLabel(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export default function BackupView({ organizationId, tenantId, onImported }: Props): JSX.Element {
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [items, setItems] = useState<Record<string, FabricItem[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyWorkspace, setBusyWorkspace] = useState<string | null>(null)
  const [copyingItem, setCopyingItem] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [outputRoot, setOutputRoot] = useState(() => localStorage.getItem('vesperttine.backupRoot') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [result, setResult] = useState<FabricBackupResult | null>(null)
  const [log, setLog] = useState('')

  const loadWorkspaces = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsLogin(false)
    const response = await window.api.fabric.listWorkspaces()
    if (!response.ok) {
      setError(response.error ?? 'Could not list Fabric workspaces.')
      setNeedsLogin(Boolean(response.needsLogin))
      setLoading(false)
      return
    }
    const next = response.workspaces ?? []
    setWorkspaces(next)
    setSelected(new Set(next.map((workspace) => workspace.id)))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  async function signInForBackup(): Promise<void> {
    setSigningIn(true)
    setError(null)
    const response = await window.api.auth.loginRayfin(tenantId)
    setSigningIn(false)
    if (!response.ok) {
      setError('Microsoft sign-in was not completed. Try again and finish it in the browser window.')
      return
    }
    await loadWorkspaces()
  }

  useEffect(
    () =>
      window.api.onProcLog((event) => {
        if (event.channel !== 'backup:run') return
        setLog((current) => `${current}${event.data}`.slice(-24_000))
      }),
    []
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return workspaces
    return workspaces.filter((workspace) =>
      `${workspace.displayName} ${workspace.capacityName ?? ''} ${workspace.region ?? ''}`
        .toLocaleLowerCase()
        .includes(needle)
    )
  }, [query, workspaces])

  function toggleSelected(id: string): void {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleWorkspace(workspace: FabricWorkspace): Promise<void> {
    if (expanded === workspace.id) {
      setExpanded(null)
      return
    }
    setExpanded(workspace.id)
    if (items[workspace.id]) return
    setBusyWorkspace(workspace.id)
    setError(null)
    const response = await window.api.fabric.listItems(workspace.id)
    setBusyWorkspace(null)
    if (!response.ok) {
      setError(response.error ?? `Could not read ${workspace.displayName}.`)
      return
    }
    setItems((current) => ({ ...current, [workspace.id]: response.items ?? [] }))
  }

  async function chooseFolder(): Promise<string | null> {
    const picked = await window.api.fabric.pickBackupFolder()
    if (picked) {
      setOutputRoot(picked)
      localStorage.setItem('vesperttine.backupRoot', picked)
    }
    return picked
  }

  async function runBackup(): Promise<void> {
    setError(null)
    setNotice(null)
    setResult(null)
    setLog('')
    const folder = outputRoot || (await chooseFolder())
    if (!folder) return
    const chosen = workspaces
      .filter((workspace) => selected.has(workspace.id))
      .map(({ id, displayName }) => ({ id, displayName }))
    if (!chosen.length) {
      setError('Select at least one workspace.')
      return
    }
    setRunning(true)
    const response = await window.api.fabric.backup({ outputRoot: folder, workspaces: chosen })
    setRunning(false)
    setResult(response)
    if (!response.ok && !response.path) setError(response.error ?? 'Backup failed.')
    else if (response.path) setNotice(`Backup saved in ${response.path}`)
  }

  async function copyLocally(workspace: FabricWorkspace, item: FabricItem): Promise<void> {
    setCopyingItem(item.id)
    setError(null)
    setNotice(null)
    const response = await window.api.fabric.importApp({
      workspaceId: workspace.id,
      workspaceName: workspace.displayName,
      itemId: item.id,
      displayName: item.displayName,
      itemType: item.type,
      organizationId
    })
    setCopyingItem(null)
    if (!response.ok) {
      setError(response.error ?? 'This app does not expose recoverable source code.')
      if (response.path) setNotice(`The available definition and metadata were saved in ${response.path}`)
      return
    }
    setNotice(`Local project created in ${response.path}`)
    onImported()
  }

  return (
    <section className="backup-view">
      <header className="backup-head">
        <div className="backup-head-copy">
          <span className="backup-kicker">Fabric recovery</span>
          <h2>Workspace backup</h2>
          <p>
            Preserve the item inventory and every editable definition Fabric makes available.
          </p>
        </div>
        <button className="btn btn--primary" disabled={running || loading} onClick={() => void runBackup()}>
          <Codicon name={running ? 'loading' : 'cloud-download'} className={running ? 'codicon-modifier-spin' : ''} />
          {running ? 'Backing up…' : `Back up ${selected.size}`}
        </button>
      </header>

      <div className="backup-scope-note">
        <Codicon name="info" />
        <span>
          Definitions and metadata are included. OneLake files, Lakehouse/Warehouse table data and
          semantic-model cached data require separate data-copy processes and are not included here.
        </span>
      </div>

      <div className="backup-toolbar">
        <label className="backup-search">
          <Codicon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces" />
        </label>
        <div className="backup-folder" title={outputRoot || 'Choose a backup location'}>
          <Codicon name="folder" />
          <span>{outputRoot || 'Choose backup location'}</span>
          <button className="btn btn--sm btn--ghost" onClick={() => void chooseFolder()}>Choose</button>
        </div>
        <button className="backup-selection-action" onClick={() => setSelected(new Set(workspaces.map((workspace) => workspace.id)))}>
          Select all
        </button>
        <button className="backup-selection-action" onClick={() => setSelected(new Set())}>
          Clear
        </button>
      </div>

      {error && (
        <div className="alert alert--error backup-alert backup-auth-alert">
          <span>{error}</span>
          {needsLogin && (
            <button className="btn btn--sm" disabled={signingIn} onClick={() => void signInForBackup()}>
              <Codicon name={signingIn ? 'loading' : 'account'} className={signingIn ? 'codicon-modifier-spin' : ''} />
              {signingIn ? 'Signing inâ€¦' : 'Sign in to Microsoft'}
            </button>
          )}
        </div>
      )}
      {notice && <div className="alert backup-alert">{notice}</div>}

      {result && (
        <div className="backup-summary">
          <div><strong>{result.workspaceCount}</strong><span>workspaces</span></div>
          <div><strong>{result.itemCount}</strong><span>items inventoried</span></div>
          <div><strong>{result.definitionCount}</strong><span>definitions</span></div>
          <div><strong>{result.metadataOnlyCount}</strong><span>metadata only</span></div>
          <div className={result.failedCount ? 'backup-summary-failed' : ''}><strong>{result.failedCount}</strong><span>failed</span></div>
        </div>
      )}

      <div className="backup-list" aria-busy={loading}>
        <div className="backup-list-head">
          <span>{loading ? 'Loading workspaces…' : `${workspaces.length} accessible workspaces`}</span>
          <span>{selected.size} selected by default</span>
        </div>
        {!loading && visible.length === 0 && <div className="backup-empty">No workspaces match this search.</div>}
        {visible.map((workspace) => {
          const open = expanded === workspace.id
          const workspaceItems = items[workspace.id] ?? []
          return (
            <article className={`backup-workspace${open ? ' backup-workspace--open' : ''}`} key={workspace.id}>
              <div className="backup-workspace-row">
                <label className="backup-check" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(workspace.id)} onChange={() => toggleSelected(workspace.id)} />
                  <span />
                </label>
                <button className="backup-workspace-main" onClick={() => void toggleWorkspace(workspace)}>
                  <span className="backup-workspace-icon"><Codicon name="server-environment" /></span>
                  <span className="backup-workspace-copy">
                    <strong>{workspace.displayName}</strong>
                    <small>{workspace.capacityName ?? workspace.sku ?? 'Capacity details unavailable'} · {workspace.region ?? 'Region unavailable'}</small>
                  </span>
                  <span className="backup-capacity-badge">{workspace.sku ?? workspace.capacityKind}</span>
                  <Codicon name={open ? 'chevron-up' : 'chevron-down'} />
                </button>
              </div>
              {open && (
                <div className="backup-items">
                  {busyWorkspace === workspace.id ? (
                    <div className="backup-items-loading"><Codicon name="loading" className="codicon-modifier-spin" /> Reading workspace inventory…</div>
                  ) : workspaceItems.length === 0 ? (
                    <div className="backup-items-loading">This workspace has no visible items.</div>
                  ) : (
                    workspaceItems.map((item) => {
                      const canCopy = /appbackend|rayfin/i.test(item.type)
                      return (
                        <div className="backup-item" key={item.id}>
                          <span className="backup-item-type">{itemTypeLabel(item.type)}</span>
                          <span className="backup-item-name">{item.displayName}</span>
                          {canCopy ? (
                            <button className="btn btn--sm btn--ghost" disabled={Boolean(copyingItem)} onClick={() => void copyLocally(workspace, item)}>
                              <Codicon name={copyingItem === item.id ? 'loading' : 'repo-clone'} className={copyingItem === item.id ? 'codicon-modifier-spin' : ''} />
                              {copyingItem === item.id ? 'Copying…' : 'Copy locally'}
                            </button>
                          ) : <span className="backup-item-inventory">Included in backup</span>}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>

      {(running || log) && <pre className="backup-log" aria-live="polite">{log || 'Preparing backup…'}</pre>}
    </section>
  )
}
