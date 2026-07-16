import { useEffect, useRef, useState } from 'react'
import type {
  AppSettings,
  AuthStatus,
  DoctorReport,
  GithubStatus,
  InstallResult,
  OrganizationProfile,
  ProcLogEvent
} from '@shared/ipc'
import { FabricatorMark } from '../components/FabricatorMark'
import nodeSvg from '../assets/brands/node.svg'
import npmSvg from '../assets/brands/npm.svg'
import gitSvg from '../assets/brands/git.svg'
import azureSvg from '../assets/brands/azure.svg'
import { CopilotLogo } from '../components/brand-icons'
import { CheckIcon, DownloadIcon, ReloadIcon, TerminalIcon } from '../components/icons'

const TOOL_LOGOS: Record<string, string> = {
  node: nodeSvg,
  npm: npmSvg,
  git: gitSvg,
  az: azureSvg
}

interface Props {
  doctor: DoctorReport | null
  auth: AuthStatus | null
  refreshing: boolean
  onRefresh: () => Promise<void> | void
  onEnter: () => void
  settings?: AppSettings | null
  onSettingsChange?: (patch: Partial<AppSettings>) => Promise<void>
}

type SetupTab = 'organizations' | 'environment'

export default function SetupScreen({
  doctor,
  auth,
  refreshing,
  onRefresh,
  onEnter,
  settings,
  onSettingsChange
}: Props): JSX.Element {
  const [tab, setTab] = useState<SetupTab>('organizations')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [organizationBusy, setOrganizationBusy] = useState<string | null>(null)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [githubStatus, setGithubStatus] = useState<GithubStatus | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [showOrganizationForm, setShowOrganizationForm] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [organizationTenant, setOrganizationTenant] = useState('')
  const [organizationGithub, setOrganizationGithub] = useState('')
  const [needsRelaunch, setNeedsRelaunch] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  const profiles = settings?.organizationProfiles ?? []
  const activeOrganization = profiles.find((profile) => profile.id === settings?.activeOrganizationId)
  const tools = doctor?.tools ?? []
  const needsAuto = tools.filter((tool) => tool.required && !tool.satisfied && tool.autoInstallable)
  const toolsSatisfied = tools.filter((tool) => tool.satisfied).length
  const providers = [auth?.copilot.signedIn ?? false, auth?.az.signedIn ?? false]
  const signedInCount = providers.filter(Boolean).length
  const allReady = (doctor?.ready ?? false) && signedInCount === providers.length
  const totalSteps = tools.length + providers.length
  const doneSteps = toolsSatisfied + signedInCount
  const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0
  const azReady = tools.find((tool) => tool.id === 'az')?.satisfied ?? false

  useEffect(() => window.api.onProcLog((event: ProcLogEvent) => setLog((value) => value + event.data)), [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  useEffect(() => {
    if (!window.api.github?.status) return
    void window.api.github.status().then(setGithubStatus).catch(() => undefined)
  }, [])

  async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
    if (onSettingsChange) await onSettingsChange(patch)
  }

  async function runAction(key: string, label: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(key)
    setShowLog(true)
    setLog((value) => `${value}\n› ${label}\n`)
    try {
      await fn()
      await onRefresh()
    } catch (error) {
      setLog((value) => `${value}\n[error] ${String(error)}\n`)
    } finally {
      setBusy(null)
    }
  }

  async function runInstall(
    key: string,
    label: string,
    fn: () => Promise<InstallResult>
  ): Promise<void> {
    setBusy(key)
    setShowLog(true)
    setLog((value) => `${value}\n› ${label}\n`)
    try {
      const result = await fn()
      if (result?.requiresRelaunch) setNeedsRelaunch(true)
      if (result?.manual) {
        setLog((value) => `${value}\nFinish the install in the page that opened, then restart.\n`)
      }
      await onRefresh()
    } catch (error) {
      setLog((value) => `${value}\n[error] ${String(error)}\n`)
    } finally {
      setBusy(null)
    }
  }

  async function selectOrganization(
    profile: OrganizationProfile,
    nextProfiles: OrganizationProfile[] = profiles
  ): Promise<void> {
    if (organizationBusy) return
    setOrganizationBusy(profile.id)
    setOrganizationError(null)
    try {
      await saveSettings({ organizationProfiles: nextProfiles, activeOrganizationId: profile.id })

      if (!auth?.rayfin.signedIn || auth.rayfin.tenant?.toLowerCase() !== profile.tenantId.toLowerCase()) {
        await window.api.auth.loginRayfin(profile.tenantId)
      }

      let github = window.api.github?.status ? await window.api.github.status() : null
      if (github && profile.githubUser && github.user?.toLowerCase() !== profile.githubUser.toLowerCase()) {
        const switched = await window.api.github.switchAccount(profile.githubUser)
        if (!switched.ok) await window.api.github.login()
        github = await window.api.github.status()
      } else if (github && !github.signedIn) {
        await window.api.github.login()
        github = await window.api.github.status()
      }

      const currentAuth = await window.api.auth.status()
      const updatedProfiles = nextProfiles.map((item) =>
        item.id === profile.id
          ? {
              ...item,
              fabricUser: currentAuth.rayfin.user ?? item.fabricUser,
              githubUser: github?.user ?? item.githubUser
            }
          : item
      )
      await saveSettings({
        organizationProfiles: updatedProfiles,
        activeOrganizationId: profile.id
      })
      setGithubStatus(github)
      await onRefresh()
    } catch (error) {
      setOrganizationError(error instanceof Error ? error.message : String(error))
    } finally {
      setOrganizationBusy(null)
    }
  }

  async function addOrganization(): Promise<void> {
    const name = organizationName.trim()
    const tenantId = organizationTenant.trim()
    if (!name || !tenantId) return
    const profile: OrganizationProfile = {
      id: crypto.randomUUID(),
      name,
      tenantId,
      githubUser: organizationGithub.trim() || githubStatus?.user
    }
    setOrganizationName('')
    setOrganizationTenant('')
    setOrganizationGithub('')
    setShowOrganizationForm(false)
    await selectOrganization(profile, [...profiles, profile])
  }

  function openEditor(): void {
    if (!activeOrganization) {
      setOrganizationError('Select an organization before opening the editor.')
      setTab('organizations')
      return
    }
    if (!allReady) {
      setTab('environment')
      return
    }
    onEnter()
  }

  const loginProvider = organizationBusy
    ? 'your organization accounts'
    : busy === 'login:copilot'
      ? 'GitHub Copilot'
      : busy === 'login:az'
        ? 'Azure'
        : null

  const logTail = log
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith('›'))
    .slice(-6)
    .join('\n')

  return (
    <div className="setup setup-launch">
      <header className="setup-launch-header">
        <div className="setup-launch-brand">
          <FabricatorMark />
          <span>VESPERTTINE RAYFIN EDITOR</span>
        </div>
        <span className={`setup-launch-health${allReady ? ' setup-launch-health--ready' : ''}`}>
          <span /> {allReady ? 'Environment ready' : 'Setup required'}
        </span>
      </header>

      <div className="setup-scroll">
        <main className="setup-launch-main">
          <div className="setup-launch-intro">
            <span className="setup-eyebrow">Workspace</span>
            <h1>{tab === 'organizations' ? 'Choose an organization' : 'Environment status'}</h1>
            <p>
              {tab === 'organizations'
                ? 'Projects, Fabric credentials and GitHub accounts stay isolated per organization.'
                : 'Review local tools and the accounts used to build and deploy your projects.'}
            </p>
          </div>

          <nav className="setup-launch-tabs" aria-label="Start screen">
            <button
              className={tab === 'organizations' ? 'setup-launch-tab--active' : ''}
              onClick={() => setTab('organizations')}
            >
              Organizations <span>{profiles.length}</span>
            </button>
            <button
              className={tab === 'environment' ? 'setup-launch-tab--active' : ''}
              onClick={() => setTab('environment')}
            >
              Environment <span>{doneSteps}/{totalSteps}</span>
            </button>
          </nav>

          <section
            className={`setup-launch-panel${tab === 'organizations' ? ' setup-launch-panel--active' : ''}`}
            aria-hidden={tab !== 'organizations'}
          >
            <div className="setup-launch-section-head">
              <div>
                <h2>Your organizations</h2>
                <p>Selecting one switches its Fabric tenant and GitHub identity.</p>
              </div>
              <button className="btn btn--primary btn--sm" onClick={() => setShowOrganizationForm(true)}>
                Add organization
              </button>
            </div>

            {organizationError && <div className="setup-org-error">{organizationError}</div>}

            {showOrganizationForm && (
              <div className="setup-org-form">
                <div className="setup-org-form-head">
                  <div>
                    <strong>New organization</strong>
                    <span>Use the Microsoft tenant and GitHub account for this client.</span>
                  </div>
                  <button className="btn btn--ghost btn--sm" onClick={() => setShowOrganizationForm(false)}>
                    Cancel
                  </button>
                </div>
                <div className="setup-org-fields">
                  <label>
                    <span>Organization name</span>
                    <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Contoso" />
                  </label>
                  <label>
                    <span>Microsoft tenant</span>
                    <input value={organizationTenant} onChange={(event) => setOrganizationTenant(event.target.value)} placeholder="contoso.onmicrosoft.com" />
                  </label>
                  <label>
                    <span>GitHub username</span>
                    <input value={organizationGithub} onChange={(event) => setOrganizationGithub(event.target.value)} placeholder={githubStatus?.user ?? 'octocat'} />
                  </label>
                </div>
                <div className="setup-org-form-actions">
                  <button
                    className="btn btn--primary"
                    disabled={!organizationName.trim() || !organizationTenant.trim() || Boolean(organizationBusy)}
                    onClick={() => void addOrganization()}
                  >
                    Add and connect
                  </button>
                </div>
              </div>
            )}

            {profiles.length > 0 ? (
              <div className="setup-org-grid">
                {profiles.map((profile) => {
                  const active = profile.id === activeOrganization?.id
                  const switching = organizationBusy === profile.id
                  return (
                    <article key={profile.id} className={`setup-org-card${active ? ' setup-org-card--active' : ''}`}>
                      <div className="setup-org-card-top">
                        <span className="setup-org-monogram">{profile.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <h3>{profile.name}</h3>
                          <p>{profile.tenantId}</p>
                        </div>
                        {active && <span className="setup-org-current"><CheckIcon /> Active</span>}
                      </div>
                      <dl className="setup-org-accounts">
                        <div><dt>Fabric</dt><dd>{profile.fabricUser ?? (active ? auth?.rayfin.user : undefined) ?? 'Connect on selection'}</dd></div>
                        <div><dt>GitHub</dt><dd>{profile.githubUser ?? (active ? githubStatus?.user : undefined) ?? 'Use current account'}</dd></div>
                      </dl>
                      <button
                        className={`btn ${active ? 'btn--ghost' : 'btn--primary'} setup-org-select`}
                        disabled={Boolean(organizationBusy)}
                        onClick={() => void selectOrganization(profile)}
                      >
                        {switching ? 'Connecting…' : active ? 'Reconnect accounts' : 'Use organization'}
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : !showOrganizationForm ? (
              <button className="setup-org-empty" onClick={() => setShowOrganizationForm(true)}>
                <span>+</span>
                <strong>Add your first organization</strong>
                <small>Connect a Fabric tenant and GitHub account to begin.</small>
              </button>
            ) : null}
          </section>

          <section
            className={`setup-launch-panel${tab === 'environment' ? ' setup-launch-panel--active' : ''}`}
            aria-hidden={tab !== 'environment'}
          >
            <div className="setup-environment-summary">
              <div>
                <span>{allReady ? 'Ready to build' : 'Environment setup'}</span>
                <strong>{doneSteps} of {totalSteps} checks passed</strong>
              </div>
              <div className="setup-environment-track"><span style={{ width: `${pct}%` }} /></div>
              <button className="btn btn--ghost btn--sm" disabled={refreshing || Boolean(busy)} onClick={() => onRefresh()}>
                <ReloadIcon className={`btn-ico ${refreshing ? 'icon-spin' : ''}`} />
                {refreshing ? 'Checking…' : 'Re-check'}
              </button>
            </div>

            {needsRelaunch && (
              <div className="setup-relaunch">
                <span><strong>Restart required.</strong> Finish installing the recently added tools.</span>
                <button className="btn btn--primary btn--sm" onClick={() => window.api.relaunch()}>Restart now</button>
              </div>
            )}

            <div className="setup-environment-grid">
              <section className="setup-environment-card">
                <div className="setup-environment-card-head">
                  <div><h2>Local tools</h2><p>Required command-line dependencies</p></div>
                  {needsAuto.length > 0 && (
                    <button className="btn btn--primary btn--sm" disabled={Boolean(busy)} onClick={() => runInstall('install:all', 'Install everything', () => window.api.doctor.installAll())}>
                      Install all
                    </button>
                  )}
                </div>
                <ul className="tool-list setup-compact-list">
                  {tools.map((tool) => {
                    const logoSrc = TOOL_LOGOS[tool.id]
                    return (
                      <li key={tool.id} className="tool-row">
                        <span className="tool-ico">{logoSrc ? <img className="brand-glyph" src={logoSrc} alt="" /> : <TerminalIcon />}</span>
                        <div className="tool-main"><span className="tool-name">{tool.name}</span><span className="tool-meta">{tool.satisfied ? tool.version : tool.installHint}</span></div>
                        <div className="tool-action">
                          {tool.satisfied ? <span className="setup-row-state"><CheckIcon /> Ready</span> : tool.autoInstallable ? (
                            <button className="btn btn--sm" disabled={Boolean(busy)} onClick={() => runInstall(`install:${tool.id}`, `Install ${tool.name}`, () => window.api.doctor.install(tool.id))}>
                              <DownloadIcon className="btn-ico" /> Install
                            </button>
                          ) : <a className="btn btn--sm" href={tool.installUrl} target="_blank" rel="noreferrer">Get it</a>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="setup-environment-card">
                <div className="setup-environment-card-head"><div><h2>Developer accounts</h2><p>AI and Azure command-line sessions</p></div></div>
                <ul className="auth-list setup-compact-list">
                  <AuthRow
                    icon={<CopilotLogo />}
                    title="GitHub Copilot"
                    subtitle="AI coding account"
                    signedIn={auth?.copilot.signedIn ?? false}
                    detail={auth?.copilot.user}
                    disabled={Boolean(busy)}
                    busy={busy === 'login:copilot'}
                    onSignIn={() => runAction('login:copilot', 'Sign in to GitHub Copilot', () => window.api.auth.loginCopilot())}
                  />
                  <AuthRow
                    icon={<img className="brand-glyph" src={azureSvg} alt="" />}
                    title="Azure CLI"
                    subtitle="Azure resource account"
                    signedIn={auth?.az.signedIn ?? false}
                    detail={auth?.az.user}
                    extra={auth?.az.tenant}
                    disabled={Boolean(busy) || !azReady}
                    disabledReason={!azReady ? 'Install Azure CLI first' : undefined}
                    busy={busy === 'login:az'}
                    onSignIn={() => runAction('login:az', 'Sign in to Azure', () => window.api.auth.loginAz())}
                  />
                </ul>
              </section>
            </div>
          </section>
        </main>
      </div>

      {showLog && (
        <div className="setup-logwrap"><div className="setup-logwrap-inner"><pre ref={logRef} className="setup-log">{log.trim() || 'Process output will appear here.'}</pre></div></div>
      )}

      <footer className="setup-actionbar setup-launch-footer">
        <div className="setup-actionbar-inner">
          <button className="btn btn--ghost btn--sm" onClick={() => setShowLog((value) => !value)}>{showLog ? 'Hide log' : 'Show log'}</button>
          <div className="setup-actionbar-right">
            <span className="setup-actionbar-status">
              {activeOrganization ? `${activeOrganization.name} selected` : 'Choose an organization'}
            </span>
            <button className="btn btn--primary setup-enter" disabled={!activeOrganization || !allReady || Boolean(organizationBusy)} onClick={openEditor}>
              Open editor <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </footer>

      {loginProvider && (
        <div className="signin-overlay" role="alertdialog" aria-busy="true" aria-label="Signing in">
          <div className="signin-card">
            <div className="signin-mark"><FabricatorMark /><span className="signin-ring" /></div>
            <div className="signin-text"><strong>Connecting…</strong><span>Complete the sign-in for {loginProvider} in the window that opened.</span></div>
            {logTail && <pre className="signin-log">{logTail}</pre>}
          </div>
        </div>
      )}
    </div>
  )
}

interface AuthRowProps {
  icon: JSX.Element
  title: string
  subtitle: string
  signedIn: boolean
  detail?: string
  extra?: string
  disabled: boolean
  disabledReason?: string
  busy: boolean
  onSignIn: () => void
}

function AuthRow(props: AuthRowProps): JSX.Element {
  return (
    <li className={`auth-row${props.signedIn ? ' auth-row--ok' : ''}`}>
      <span className="auth-ico">{props.icon}</span>
      <div className="auth-row-main">
        <span className="auth-row-title">{props.title}</span>
        <span className={`auth-row-meta${props.signedIn ? ' auth-row-meta--ok' : ''}`}>
          {props.signedIn ? `${props.detail ?? 'Signed in'}${props.extra ? ` · ${props.extra}` : ''}` : props.disabledReason ?? props.subtitle}
        </span>
      </div>
      <div className="auth-row-action">
        {props.signedIn ? <span className="setup-row-state"><CheckIcon /> Connected</span> : (
          <button className="btn btn--primary btn--sm" disabled={props.disabled} onClick={props.onSignIn}>{props.busy ? 'Waiting…' : 'Sign in'}</button>
        )}
      </div>
    </li>
  )
}
