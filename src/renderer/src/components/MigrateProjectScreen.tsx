import { useEffect, useMemo, useRef, useState } from 'react'
import type { GithubStatus, MigrationSourceKind, StudioProject } from '@shared/ipc'
import { useSuppressPreview } from '../overlay'
import { FabricatorMark } from './FabricatorMark'
import { BranchIcon, FolderIcon } from './icons'

interface Props {
  onCancel: () => void
  onPrepared: (project: StudioProject) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'The migration workspace could not be prepared.'
}

/** Prepare an isolated source copy, then hand it to the agent in Plan mode. */
export default function MigrateProjectScreen({ onCancel, onPrepared }: Props): JSX.Element {
  useSuppressPreview()
  const [sourceKind, setSourceKind] = useState<MigrationSourceKind>('github')
  const [repository, setRepository] = useState('')
  const [folder, setFolder] = useState('')
  const [name, setName] = useState('')
  const [github, setGithub] = useState<GithubStatus | null>(null)
  const [checkingGithub, setCheckingGithub] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [log, setLog] = useState('')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    void window.api.github
      .status()
      .then(setGithub)
      .finally(() => setCheckingGithub(false))
  }, [])

  useEffect(
    () =>
      window.api.onProcLog((event) => {
        if (event.channel === 'create:project') setLog((current) => current + event.data)
      }),
    []
  )

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !preparing) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel, preparing])

  const source = sourceKind === 'github' ? repository.trim() : folder.trim()
  const canPrepare = Boolean(source) && !preparing
  const progress = useMemo(() => {
    const text = log.toLowerCase()
    if (text.includes('migration copy ready')) return 4
    if (text.includes('protected snapshot') || text.includes('copying source')) return 3
    if (text.includes('project ready')) return 2
    return preparing ? 1 : 0
  }, [log, preparing])

  async function chooseFolder(): Promise<void> {
    const selected = await window.api.projects.pickFolder()
    if (selected) setFolder(selected)
  }

  async function signInGithub(): Promise<void> {
    setSigningIn(true)
    setError(null)
    try {
      const result = await window.api.github.login()
      if (!result.ok) setError('GitHub sign-in could not be started.')
      else setError('Complete GitHub sign-in in the browser, then return and click Re-check.')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setSigningIn(false)
    }
  }

  async function recheckGithub(): Promise<void> {
    setCheckingGithub(true)
    setGithub(await window.api.github.status().catch(() => null))
    setCheckingGithub(false)
    setError(null)
  }

  async function prepare(): Promise<void> {
    if (!canPrepare) return
    setPreparing(true)
    setLog('')
    setError(null)
    try {
      const result = await window.api.migrations.prepare({
        sourceKind,
        source,
        name: name.trim() || undefined
      })
      if (!result.ok || !result.project) {
        setError(result.error ?? 'The migration workspace could not be prepared.')
        return
      }
      onPrepared(result.project)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setPreparing(false)
    }
  }

  return (
    <section className="create-screen migration-screen">
      <div className="create-shell migration-shell">
        <header className="create-head migration-head">
          <span className="migration-head-mark" aria-hidden="true">
            <FabricatorMark />
          </span>
          <div className="create-head-text">
            <p className="migration-eyebrow">Guided conversion</p>
            <h1 className="create-title">Migrate an app to Rayfin</h1>
            <p className="create-sub">
              Work from a protected copy, review the migration plan, then test locally before
              choosing a Fabric deployment.
            </p>
          </div>
        </header>

        <div className="migration-safety" role="note">
          <span className="codicon codicon-shield" aria-hidden="true" />
          <span>
            Your original folder and GitHub repository remain untouched. Dependencies, build
            output, Git history, and local secrets are excluded from the copy.
          </span>
        </div>

        {!preparing ? (
          <div className="create-body migration-body">
            <div className="migration-source-tabs" role="tablist" aria-label="Migration source">
              <button
                type="button"
                role="tab"
                aria-selected={sourceKind === 'github'}
                className={`migration-source-tab${sourceKind === 'github' ? ' is-active' : ''}`}
                onClick={() => setSourceKind('github')}
              >
                <BranchIcon />
                <span>
                  <strong>GitHub repository</strong>
                  <small>Clone through your connected GitHub account</small>
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceKind === 'folder'}
                className={`migration-source-tab${sourceKind === 'folder' ? ' is-active' : ''}`}
                onClick={() => setSourceKind('folder')}
              >
                <FolderIcon />
                <span>
                  <strong>Local folder</strong>
                  <small>Copy an application already on this computer</small>
                </span>
              </button>
            </div>

            <div className="migration-form-card">
              {sourceKind === 'github' ? (
                <label className="field">
                  <span>Repository</span>
                  <input
                    autoFocus
                    value={repository}
                    onChange={(event) => setRepository(event.target.value)}
                    placeholder="owner/repository or https://github.com/owner/repository"
                    disabled={preparing}
                  />
                  <small>
                    {checkingGithub
                      ? 'Checking GitHub connection...'
                      : github?.signedIn
                        ? `Connected as ${github.user ?? 'GitHub user'}`
                        : 'A signed-in GitHub CLI is required for private repositories.'}
                  </small>
                </label>
              ) : (
                <div className="field">
                  <span>Application folder</span>
                  <div className="migration-folder-row">
                    <input value={folder} readOnly placeholder="Choose the original app folder" />
                    <button type="button" className="btn btn--ghost" onClick={() => void chooseFolder()}>
                      Browse
                    </button>
                  </div>
                  <small>The destination workspace must be outside this folder.</small>
                </div>
              )}

              <label className="field">
                <span>Migration project name <em>Optional</em></span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Uses the source app name when left blank"
                />
              </label>

              {sourceKind === 'github' && !checkingGithub && !github?.signedIn && (
                <div className="migration-github-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={signingIn}
                    onClick={() => void signInGithub()}
                  >
                    {signingIn ? 'Opening sign-in...' : 'Sign in to GitHub'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => void recheckGithub()}>
                    Re-check
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="create-progress migration-progress" aria-live="polite">
            <ol className="create-phases">
              {[
                ['Create migration workspace', 'Scaffold a stable Rayfin app'],
                ['Prepare project tools', 'Install the local Rayfin dependencies'],
                ['Protect the source snapshot', 'Copy code without secrets or generated files'],
                ['Start assessment', 'Open the task plan for your approval']
              ].map(([label, hint], index) => {
                const step = index + 1
                const state = step < progress ? 'done' : step === progress ? 'active' : 'pending'
                return (
                  <li key={label} className={`create-phase create-phase--${state}`}>
                    <span className="create-phase-ico">{state === 'done' ? '✓' : null}</span>
                    <span className="create-phase-text">
                      <span className="create-phase-label">{label}</span>
                      <span className="create-phase-hint">{hint}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
            {log && (
              <details className="create-progress-details">
                <summary>Show preparation log</summary>
                <pre ref={logRef} className="migration-log">{log}</pre>
              </details>
            )}
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        <footer className="create-foot">
          <button type="button" className="btn btn--ghost" disabled={preparing} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canPrepare}
            onClick={() => void prepare()}
          >
            {preparing ? 'Preparing copy...' : 'Copy and assess'}
          </button>
        </footer>
      </div>
    </section>
  )
}
