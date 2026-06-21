import { useEffect, useState } from 'react'
import type { FabricWorkspacesResult, StudioProject } from '../../../shared/ipc'

interface Props {
  project: StudioProject
  /** Persist the change and refresh the project list. */
  onChanged: () => void
}

/** Where to send users who have no Fabric/Premium capacity yet. */
const TRIAL_URL = 'https://learn.microsoft.com/fabric/fundamentals/fabric-trial'
const BUY_URL = 'https://learn.microsoft.com/fabric/enterprise/buy-subscription'

/** Trim a portal URL / GUID down to something readable for the chip label. */
function shortLabel(workspace: string): string {
  const ws = workspace.trim()
  if (/^https?:\/\//i.test(ws)) {
    const m = ws.match(/groups\/([0-9a-f-]{8,})/i)
    return m ? `ws ${m[1].slice(0, 8)}…` : 'portal URL'
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ws)) return `${ws.slice(0, 8)}…`
  return ws
}

/**
 * Compact Fabric-workspace pill for the project header. Opening it lists the
 * signed-in user's Fabric workspaces that can host a Rayfin app (those backed
 * by an F-SKU or P-SKU capacity), each badged with its SKU. When the account
 * has no eligible workspace it explains why and links to a trial / purchase.
 * A manual-entry fallback remains for names, portal URLs, or GUIDs.
 */
export default function WorkspaceControl({ project, onChanged }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FabricWorkspacesResult | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState(project.workspace ?? '')

  const workspace = project.workspace?.trim()
  const label = project.workspaceName?.trim() || (workspace ? shortLabel(workspace) : '')

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setResult(await window.api.fabric.listWorkspaces())
    } catch (err) {
      setResult({ ok: false, error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setManual(project.workspace ?? '')
    setShowManual(false)
    void load()
  }, [open, project.workspace])

  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  async function save(nextWorkspace?: string, nextName?: string): Promise<void> {
    setBusy(true)
    try {
      await window.api.projects.setWorkspace(project.id, nextWorkspace, nextName)
      onChanged()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const all = result?.ok && result.workspaces ? result.workspaces : []
  const eligible = all.filter((w) => w.eligible)

  return (
    <div className="ws-control" onClick={(e) => e.stopPropagation()}>
      <button
        className={`chip ws-chip${workspace ? ' ws-chip--set' : ''}`}
        title={
          workspace
            ? `Fabric workspace: ${project.workspaceName ?? workspace}`
            : 'No Fabric workspace set'
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ws-chip-icon">◆</span>
        <span className="ws-chip-label">{workspace ? label : 'set workspace'}</span>
      </button>

      {open && (
        <div className="ws-popover">
          <div className="ws-popover-head">
            <span className="ws-popover-title">Fabric workspace</span>
            <button
              className="ws-refresh"
              title="Refresh"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              ↻
            </button>
          </div>

          {loading ? (
            <div className="ws-loading">
              <span className="ws-spinner" />
              Loading your workspaces…
            </div>
          ) : result?.ok && eligible.length > 0 ? (
            <div className="ws-list" role="listbox">
              {eligible.map((w) => {
                const selected = project.workspace === w.id
                return (
                  <button
                    key={w.id}
                    className={`ws-item${selected ? ' ws-item--sel' : ''}`}
                    disabled={busy}
                    onClick={() => void save(w.id, w.displayName)}
                  >
                    <span className="ws-item-main">
                      <span className="ws-item-name">{w.displayName}</span>
                      {w.region && <span className="ws-item-sub">{w.region}</span>}
                    </span>
                    <span
                      className={`ws-sku ws-sku--${w.capacityKind}`}
                      title={w.capacityName ? `${w.capacityName} (${w.sku})` : w.sku}
                    >
                      {w.capacityKind === 'fabric' ? 'F-SKU' : 'P-SKU'}
                      {w.sku ? ` · ${w.sku}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : result?.ok ? (
            <div className="ws-empty">
              <p className="ws-empty-title">No eligible workspaces</p>
              <p className="ws-empty-sub">
                Rayfin apps need a workspace on a Fabric (<strong>F-SKU</strong>) or Power BI
                Premium (<strong>P-SKU</strong>) capacity.
                {all.length > 0
                  ? ` None of your ${all.length} workspace${all.length === 1 ? '' : 's'} qualify.`
                  : ''}{' '}
                Start a free Fabric trial or add a capacity, then refresh.
              </p>
              <div className="ws-empty-actions">
                <button
                  className="btn btn--xs btn--primary"
                  onClick={() => void window.api.openExternal(TRIAL_URL)}
                >
                  Start a free trial
                </button>
                <button
                  className="btn btn--xs btn--ghost"
                  onClick={() => void window.api.openExternal(BUY_URL)}
                >
                  Buy a capacity
                </button>
              </div>
            </div>
          ) : (
            <div className="ws-empty">
              <p className="ws-empty-sub">
                {result?.needsLogin
                  ? 'Your Fabric session has expired — sign out and back in to list workspaces.'
                  : `Couldn’t load workspaces${
                      result?.error ? `: ${result.error}` : '.'
                    } You can still enter one manually.`}
              </p>
            </div>
          )}

          <button className="ws-manual-toggle" onClick={() => setShowManual((s) => !s)}>
            {showManual ? '▾' : '▸'} Enter a name, URL, or ID manually
          </button>
          {showManual && (
            <>
              <input
                className="ws-input"
                placeholder="Name, portal URL, or workspace ID"
                value={manual}
                autoFocus
                spellCheck={false}
                disabled={busy}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void save(manual.trim() || undefined, undefined)
                  else if (e.key === 'Escape') setOpen(false)
                }}
              />
              <div className="ws-popover-actions">
                <span className="ws-popover-spacer" />
                <button
                  className="btn btn--xs btn--primary"
                  disabled={busy || manual.trim() === (project.workspace ?? '')}
                  onClick={() => void save(manual.trim() || undefined, undefined)}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}

          {workspace && (
            <div className="ws-current">
              <span className="ws-current-label" title={project.workspaceName ?? workspace}>
                Current: {label}
              </span>
              <button
                className="btn btn--xs btn--ghost"
                disabled={busy}
                onClick={() => void save(undefined, undefined)}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
