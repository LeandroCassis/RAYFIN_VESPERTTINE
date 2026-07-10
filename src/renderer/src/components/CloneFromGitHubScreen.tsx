import { useEffect, useRef, useState } from 'react'
import type { GithubRepo, GithubStatus, InstallResult } from '@shared/ipc'
import { useSuppressPreview } from '../overlay'

interface Props {
  /** Abandon the flow (no clone happened). */
  onCancel: () => void
  /** A repo was cloned + opened; the parent refreshes and closes this screen. */
  onCloned: () => void
}

/** Case-insensitive match of a repo against the filter box (name / desc / language). */
function matches(repo: GithubRepo, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    repo.nameWithOwner.toLowerCase().includes(q) ||
    (repo.description ?? '').toLowerCase().includes(q) ||
    (repo.primaryLanguage ?? '').toLowerCase().includes(q)
  )
}

/**
 * "Open existing… → Clone from GitHub" full-screen flow. Gated on the optional
 * `gh` CLI: install → sign in (external terminal + status poll) → browse the
 * user's repos (or paste a URL) → clone into the workspace and open it.
 */
export default function CloneFromGitHubScreen({ onCancel, onCloned }: Props): JSX.Element {
  // The native preview webview floats above HTML; suppress it while this covers the body.
  useSuppressPreview()

  const [status, setStatus] = useState<GithubStatus | null>(null)
  const [checking, setChecking] = useState(true)

  // gh install
  const [installing, setInstalling] = useState(false)
  const [installLog, setInstallLog] = useState('')
  const [installResult, setInstallResult] = useState<InstallResult | null>(null)

  // sign-in
  const [waitingLogin, setWaitingLogin] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // repos
  const [repos, setRepos] = useState<GithubRepo[] | null>(null)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  // clone
  const [cloning, setCloning] = useState(false)
  const [cloneLog, setCloneLog] = useState('')
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [showCloneLog, setShowCloneLog] = useState(false)
  const cloneLogRef = useRef<HTMLPreElement>(null)

  const busy = checking || installing || cloning

  async function recheck(): Promise<void> {
    setChecking(true)
    try {
      setStatus(await window.api.github.status())
    } finally {
      setChecking(false)
    }
  }

  // Initial gh + auth probe.
  useEffect(() => {
    void recheck()
  }, [])

  // Esc abandons the flow when nothing is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  // Stream gh install + clone output.
  useEffect(() => {
    return window.api.onProcLog((e) => {
      if (e.channel === 'clone:project') setCloneLog((prev) => prev + e.data)
      else if (e.channel === 'install:gh') setInstallLog((prev) => prev + e.data)
    })
  }, [])

  // Poll for sign-in completion after the terminal is launched.
  useEffect(() => {
    if (!waitingLogin) return
    let cancelled = false
    const tick = async (): Promise<void> => {
      const s = await window.api.github.status().catch(() => null)
      if (cancelled || !s) return
      setStatus(s)
      if (s.signedIn) setWaitingLogin(false)
    }
    const id = window.setInterval(() => void tick(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [waitingLogin])

  // Load the user's repos once signed in.
  useEffect(() => {
    if (status?.signedIn && repos === null && !loadingRepos) void loadRepos()
  }, [status?.signedIn])

  useEffect(() => {
    if (cloneLogRef.current) cloneLogRef.current.scrollTop = cloneLogRef.current.scrollHeight
  }, [cloneLog, showCloneLog])

  async function loadRepos(): Promise<void> {
    setLoadingRepos(true)
    setReposError(null)
    try {
      const res = await window.api.github.listRepos()
      if (res.ok) {
        setRepos(res.repos)
      } else {
        setRepos([])
        setReposError(res.error ?? 'Could not load your repositories.')
      }
    } catch (e) {
      setRepos([])
      setReposError(String(e))
    } finally {
      setLoadingRepos(false)
    }
  }

  async function installGh(): Promise<void> {
    setInstalling(true)
    setInstallLog('')
    setInstallResult(null)
    try {
      const res = await window.api.doctor.install('gh')
      setInstallResult(res)
      // An in-process install that needs no relaunch (rare) — re-probe immediately.
      if (res.ok && !res.requiresRelaunch) await recheck()
    } finally {
      setInstalling(false)
    }
  }

  async function beginLogin(): Promise<void> {
    setLoginError(null)
    const res = await window.api.github.login()
    if (!res.ok) {
      setLoginError(
        'Could not open a terminal automatically. Run "gh auth login" in your terminal, then click Re-check.'
      )
      return
    }
    setWaitingLogin(true)
  }

  const cloneTarget = (manual.trim() || selected || '').trim()

  async function clone(): Promise<void> {
    if (!cloneTarget) return
    setCloning(true)
    setCloneError(null)
    setCloneLog('')
    setShowCloneLog(false)
    try {
      const res = await window.api.github.clone(cloneTarget)
      if (res.ok) {
        onCloned()
      } else {
        setCloneError(res.error ?? 'Clone failed.')
        setShowCloneLog(true)
      }
    } catch (e) {
      setCloneError(String(e))
      setShowCloneLog(true)
    } finally {
      setCloning(false)
    }
  }

  const filtered = (repos ?? []).filter((r) => matches(r, filter))

  /* --------------------------------- render --------------------------------- */

  const ghInstalled = status?.ghInstalled ?? false
  const signedIn = status?.signedIn ?? false

  let sub = 'Sign in to GitHub to clone one of your repositories into your workspace.'
  if (signedIn) sub = 'Pick a repository to clone into your workspace, or paste a URL.'
  else if (status && !ghInstalled) sub = 'The GitHub CLI (gh) is needed to sign in and clone repositories.'

  return (
    <div className="create-screen">
      <div className="create-shell">
        <header className="create-head">
          <div className="create-head-text">
            <h1 className="create-title">Clone from GitHub</h1>
            <p className="create-sub">{sub}</p>
          </div>
        </header>

        <div className="create-body">
          {/* 1) Initial probe */}
          {checking && repos === null && (
            <div className="gallery-empty">
              <p className="gallery-empty-msg">
                <span className="ws-spinner" aria-hidden="true" /> Checking GitHub CLI…
              </p>
            </div>
          )}

          {/* 2) gh missing → install */}
          {!checking && status && !ghInstalled && (
            <div className="gallery-empty">
              <p className="gallery-empty-msg">
                The GitHub CLI (<code>gh</code>) isn’t installed. Install it to sign in to GitHub and
                clone your repositories.
              </p>
              <div className="gallery-empty-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={installing}
                  onClick={() => void installGh()}
                >
                  {installing ? 'Installing…' : 'Install GitHub CLI'}
                </button>
                {installResult?.requiresRelaunch ? (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => void window.api.relaunch()}
                  >
                    Restart to finish
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={installing}
                    onClick={() => void recheck()}
                  >
                    Re-check
                  </button>
                )}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void window.api.openExternal('https://cli.github.com')}
                >
                  Install manually
                </button>
              </div>
              {installResult?.manual && (
                <p className="field-hint">
                  The installer was opened in your browser. After installing, click Restart.
                </p>
              )}
              {(installing || installLog) && (
                <pre className="log-console log-console--sm" style={{ marginTop: 12 }}>
                  {installLog || 'Starting…'}
                </pre>
              )}
            </div>
          )}

          {/* 3) Installed but signed out → sign in */}
          {!checking && ghInstalled && !signedIn && (
            <div className="gallery-empty">
              {waitingLogin ? (
                <>
                  <p className="gallery-empty-msg">
                    <span className="ws-spinner" aria-hidden="true" /> Waiting for sign-in… A terminal
                    window opened — follow the prompts in your browser, then come back here.
                  </p>
                  <div className="gallery-empty-actions">
                    <button type="button" className="btn btn--sm" onClick={() => void recheck()}>
                      Re-check now
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setWaitingLogin(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="gallery-empty-msg">
                    Sign in to GitHub to browse and clone your repositories.
                  </p>
                  <div className="gallery-empty-actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => void beginLogin()}
                    >
                      Sign in with GitHub
                    </button>
                    <button type="button" className="btn btn--sm" onClick={() => void recheck()}>
                      Re-check
                    </button>
                  </div>
                  <p className="field-hint">
                    A terminal opens running <code>gh auth login --web</code>; complete it in your
                    browser.
                  </p>
                </>
              )}
              {loginError && <div className="alert alert--error">{loginError}</div>}
            </div>
          )}

          {/* 4) Signed in → browse + clone */}
          {!checking && signedIn && (
            <>
              <div className="field">
                <span className="field-label">
                  Your repositories
                  {status?.user && <span className="field-hint"> — signed in as {status.user}</span>}
                </span>
                <input
                  className="field-input"
                  type="text"
                  value={filter}
                  placeholder="Filter repositories…"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={cloning}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              {loadingRepos ? (
                <div className="gallery-empty">
                  <p className="gallery-empty-msg">
                    <span className="ws-spinner" aria-hidden="true" /> Loading repositories…
                  </p>
                </div>
              ) : reposError ? (
                <div className="gallery-empty">
                  <p className="gallery-empty-msg">{reposError}</p>
                  <div className="gallery-empty-actions">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        setRepos(null)
                        void loadRepos()
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="gallery-empty">
                  <p className="gallery-empty-msg">
                    {repos && repos.length === 0
                      ? 'No repositories found for this account.'
                      : 'No repositories match your filter.'}
                  </p>
                </div>
              ) : (
                <div className="gh-repo-scroll">
                  {filtered.map((r) => (
                    <div
                      key={r.nameWithOwner}
                      className={`project-item${selected === r.nameWithOwner ? ' project-item--active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (cloning) return
                        setSelected(r.nameWithOwner)
                        setManual('')
                      }}
                      onKeyDown={(e) => {
                        if (cloning) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(r.nameWithOwner)
                          setManual('')
                        }
                      }}
                    >
                      <div className="project-item-mark" aria-hidden="true">
                        {r.name.trim()[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="project-item-main">
                        <span className="project-item-name">
                          {r.nameWithOwner}
                          {r.isPrivate && <span className="badge">Private</span>}
                          {r.primaryLanguage && (
                            <span className="badge badge--accent">{r.primaryLanguage}</span>
                          )}
                        </span>
                        <span className="project-item-path" title={r.description ?? ''}>
                          {r.description || r.url || ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="field" style={{ marginTop: 12 }}>
                <span className="field-label">Or paste a repository</span>
                <input
                  className="field-input"
                  type="text"
                  value={manual}
                  placeholder="owner/name or https://github.com/owner/name"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={cloning}
                  onChange={(e) => {
                    setManual(e.target.value)
                    if (e.target.value.trim()) setSelected(null)
                  }}
                />
                <span className="field-hint">
                  Cloned into your workspace. It must be a Rayfin project (has rayfin/rayfin.yml).
                </span>
              </label>

              {(cloning || cloneLog) && (
                <div className="create-progress" aria-busy={cloning} style={{ marginTop: 12 }}>
                  <p className="gallery-empty-msg" style={{ margin: 0 }}>
                    {cloning ? (
                      <>
                        <span className="ws-spinner" aria-hidden="true" /> Cloning{' '}
                        <code>{cloneTarget}</code> and installing dependencies…
                      </>
                    ) : cloneError ? (
                      'Clone failed.'
                    ) : (
                      'Done.'
                    )}
                  </p>
                  <div className="create-progress-meta">
                    <span />
                    <button
                      type="button"
                      className="link-btn create-progress-toggle"
                      onClick={() => setShowCloneLog((v) => !v)}
                    >
                      {showCloneLog ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                  {showCloneLog && (
                    <pre className="log-console log-console--sm" ref={cloneLogRef}>
                      {cloneLog || 'Starting…'}
                    </pre>
                  )}
                </div>
              )}

              {cloneError && <div className="alert alert--error">{cloneError}</div>}
            </>
          )}
        </div>

        <footer className="create-foot">
          <button className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          {signedIn && (
            <button
              className="btn btn--primary"
              onClick={() => void clone()}
              disabled={cloning || !cloneTarget}
            >
              {cloning ? 'Cloning…' : 'Clone & open'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
