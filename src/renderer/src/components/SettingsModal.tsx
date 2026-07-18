import { useEffect, useId, useMemo, useState } from 'react'
import type {
  AiProvider,
  AiProviderStatus,
  AppSettings,
  AppVersions,
  AuthStatus,
  CopilotModel,
  OrganizationProfile,
  ThemePreference,
  VisualSettings
} from '@shared/ipc'
import { applyTheme, applyUiScale, applyVisualSettings, UI_SCALES } from '../theme'
import { useSuppressPreview } from '../overlay'
import { useModalFocus } from '../modalFocus'
import { useUpdates } from '../update'
import ConfirmModal from './ConfirmModal'
import { FabricatorMark } from './FabricatorMark'
import { resetCopilotModels } from '../copilotModels'

interface Props {
  settings: AppSettings
  versions: AppVersions | null
  auth?: AuthStatus
  onAuthChanged?: () => Promise<void> | void
  /** Persist a settings patch; the parent re-applies theme + stores it. */
  onChange: (patch: Partial<AppSettings>) => Promise<void> | void
  onClose: () => void
}

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' }
]

const DEFAULT_ACCENT = '#3ecf8e'
const DEFAULT_SURFACE = '#181818'

function ToggleRow({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <label className="set-row">
      <span className="set-row-text">
        <span className="set-row-label">{label}</span>
        <span className="field-hint">{hint}</span>
      </span>
      <span className={`switch${checked ? ' switch--on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-knob" />
      </span>
    </label>
  )
}

export default function SettingsModal({
  settings,
  versions,
  auth,
  onAuthChanged,
  onChange,
  onClose
}: Props): JSX.Element {
  useSuppressPreview()
  const { status: updateStatus, info: updateInfo, checkNow } = useUpdates()
  const [checkedUpdates, setCheckedUpdates] = useState(false)
  const [tab, setTab] = useState<'general' | 'appearance' | 'ai' | 'accounts'>('general')
  const [accountBusy, setAccountBusy] = useState<'copilot' | 'github' | null>(null)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'provider' | 'key' | 'remove' | null>(null)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null)
  const [openRouterKey, setOpenRouterKey] = useState('')
  const [aiModels, setAiModels] = useState<CopilotModel[]>([])
  const [aiModelsLoading, setAiModelsLoading] = useState(false)
  const [showExperiments, setShowExperiments] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const titleId = useId()
  const dialogRef = useModalFocus<HTMLDivElement>()
  // Compatibility rendering is applied at startup, so any change only takes effect
  // after a relaunch. Toggling it opens a mandatory restart prompt; `restartPrompt`
  // holds the value to revert to if the user declines, keeping the setting from
  // being left half-applied.
  const [restartPrompt, setRestartPrompt] = useState<{ revertTo: boolean } | null>(null)
  const activeTenant = useMemo(
    () =>
      settings.organizationProfiles?.find((profile) => profile.id === settings.activeOrganizationId) ??
      null,
    [settings.activeOrganizationId, settings.organizationProfiles]
  )
  const selectedAiProvider: AiProvider = activeTenant?.aiProvider ?? 'github'

  // Toggling compatibility rendering forces a restart: persist the new value, then
  // require the user to relaunch (or cancel, which reverts the change).
  function toggleCompatRendering(value: boolean): void {
    const revertTo = Boolean(settings.experiments?.compatibilityRendering)
    onChange({ experiments: { compatibilityRendering: value } })
    setRestartPrompt({ revertTo })
  }

  useEffect(() => {
    void window.api.projects.state().then((s) => setWorkspaceRoot(s.workspaceRoot))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Preview a theme choice immediately; persistence happens via onChange.
  function pickTheme(theme: ThemePreference): void {
    applyTheme(theme)
    onChange({ theme })
  }

  // Preview the UI scale immediately so the whole window resizes as you pick.
  function pickScale(uiScale: number): void {
    applyUiScale(uiScale)
    onChange({ uiScale })
  }

  function pickVisual(patch: Partial<VisualSettings>): void {
    const visual = { ...settings.visual, ...patch }
    applyVisualSettings(visual)
    onChange({ visual })
  }

  async function changeRoot(): Promise<void> {
    const next = await window.api.projects.pickWorkspaceRoot()
    setWorkspaceRoot(next.workspaceRoot)
  }

  async function reauthenticateCopilot(): Promise<void> {
    setAccountBusy('copilot')
    setAccountMessage(null)
    try {
      const result = await window.api.auth.loginCopilot()
      await onAuthChanged?.()
      setAccountMessage(result.ok ? 'GitHub Copilot reauthenticated.' : 'Copilot sign-in did not complete.')
    } catch (error) {
      setAccountMessage(`Could not reauthenticate Copilot: ${String(error)}`)
    } finally {
      setAccountBusy(null)
    }
  }

  async function reconnectGithub(): Promise<void> {
    setAccountBusy('github')
    setAccountMessage(null)
    try {
      const result = await window.api.github.login()
      setAccountMessage(
        result.ok
          ? 'GitHub sign-in opened in a terminal. Complete it there, then return to the editor.'
          : 'GitHub CLI is not installed or the sign-in window could not be opened.'
      )
    } finally {
      setAccountBusy(null)
    }
  }

  async function refreshAiStatus(profileId = activeTenant?.id): Promise<void> {
    if (!profileId) {
      setAiStatus(null)
      return
    }
    const status = await window.api.settings.openRouterStatus(profileId)
    setAiStatus(status)
  }

  async function refreshAiModels(): Promise<void> {
    if (!activeTenant) {
      setAiModels([])
      return
    }
    setAiModelsLoading(true)
    try {
      // Do not use the renderer cache here: this screen changes providers and
      // needs the current Tenant's catalog immediately.
      setAiModels(await window.api.chat.listModels())
    } catch (error) {
      setAiModels([])
      setAiMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setAiModelsLoading(false)
    }
  }

  async function updateAiProfile(patch: Partial<OrganizationProfile>): Promise<void> {
    if (!activeTenant) return
    const profiles = (settings.organizationProfiles ?? []).map((profile) =>
      profile.id === activeTenant.id ? { ...profile, ...patch } : profile
    )
    await onChange({ organizationProfiles: profiles })
    // The chat/advisor model picker holds a global cache. Its values belong to
    // the previous provider/tenant after this mutation, so force a fresh list.
    resetCopilotModels()
  }

  async function selectAiProvider(provider: AiProvider): Promise<void> {
    if (!activeTenant || provider === selectedAiProvider) return
    setAiBusy('provider')
    setAiMessage(null)
    try {
      await updateAiProfile({ aiProvider: provider, aiModel: undefined })
      await refreshAiStatus(activeTenant.id)
      await refreshAiModels()
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setAiBusy(null)
    }
  }

  async function saveOpenRouterKey(): Promise<void> {
    if (!activeTenant || !openRouterKey.trim()) return
    setAiBusy('key')
    setAiMessage(null)
    try {
      const status = await window.api.settings.saveOpenRouterKey(activeTenant.id, openRouterKey)
      setAiStatus(status)
      setOpenRouterKey('')
      resetCopilotModels()
      await refreshAiModels()
      setAiMessage('OpenRouter key saved securely for this Tenant.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setAiBusy(null)
    }
  }

  async function removeOpenRouterKey(): Promise<void> {
    if (!activeTenant) return
    setAiBusy('remove')
    setAiMessage(null)
    try {
      setAiStatus(await window.api.settings.removeOpenRouterKey(activeTenant.id))
      setAiModels([])
      resetCopilotModels()
      setAiMessage('OpenRouter key removed from this device.')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setAiBusy(null)
    }
  }

  useEffect(() => {
    if (tab !== 'ai' || !activeTenant) return
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const status = await window.api.settings.openRouterStatus(activeTenant.id)
        if (cancelled) return
        setAiStatus(status)
        await refreshAiModels()
      } catch (error) {
        if (!cancelled) setAiMessage(error instanceof Error ? error.message : String(error))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // Refresh when opening the tab or when the selected Tenant/provider changes.
  }, [tab, activeTenant?.id, selectedAiProvider])

  // Build and reveal a shareable diagnostics bundle. Best-effort: the backend
  // reveals the logs folder on success, and a failure must never throw.
  async function exportDiagnostics(): Promise<void> {
    if (exporting) return
    setExporting(true)
    try {
      await window.api.diagnostics.export()
    } catch {
      /* diagnostics export is best-effort */
    } finally {
      setExporting(false)
    }
  }

  const updateBusy =
    updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'installing'
  let updateMsg: string
  if (updateStatus === 'checking') updateMsg = 'Checking for updates…'
  else if (updateStatus === 'downloading') updateMsg = 'Downloading the latest update…'
  else if (updateStatus === 'ready')
    updateMsg = `Update ${updateInfo?.version ?? ''} is ready — restart from the banner.`.replace(
      '  ',
      ' '
    )
  else if (updateStatus === 'installing') updateMsg = 'Installing update…'
  else if (updateStatus === 'error') updateMsg = 'Couldn’t check for updates. Try again later.'
  else if (checkedUpdates) updateMsg = 'You’re up to date.'
  else updateMsg = versions ? `You’re on version ${versions.app}.` : ''

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 id={titleId}>Settings</h2>
            <button
              className="btn btn--sm btn--ghost"
              onClick={onClose}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          <div className="settings-tabs" role="tablist" aria-label="Settings sections">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'general'}
              className={`settings-tab${tab === 'general' ? ' settings-tab--active' : ''}`}
              onClick={() => setTab('general')}
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'appearance'}
              className={`settings-tab${tab === 'appearance' ? ' settings-tab--active' : ''}`}
              onClick={() => setTab('appearance')}
            >
              Appearance
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'ai'}
              className={`settings-tab${tab === 'ai' ? ' settings-tab--active' : ''}`}
              onClick={() => setTab('ai')}
            >
              AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'accounts'}
              className={`settings-tab${tab === 'accounts' ? ' settings-tab--active' : ''}`}
              onClick={() => setTab('accounts')}
            >
              Accounts
            </button>
          </div>

          <div className="modal-body">
            {tab === 'ai' ? (
              <div className="settings-ai" role="tabpanel">
                {activeTenant ? (
                  <>
                    <div className="settings-ai-tenant">
                      <span className="field-label">Active Tenant</span>
                      <strong>{activeTenant.name}</strong>
                      <span className="field-hint">
                        Provider, model, and OpenRouter credential are isolated from your other Tenants.
                      </span>
                    </div>

                    <div className="settings-ai-provider" role="radiogroup" aria-label="AI provider">
                      {([
                        ['github', 'GitHub Copilot', 'Use your linked GitHub Copilot subscription.'],
                        ['openrouter', 'OpenRouter', 'Use this Tenant’s OpenRouter key and model catalog.']
                      ] as const).map(([value, label, hint]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selectedAiProvider === value}
                          className={`settings-ai-provider-option${selectedAiProvider === value ? ' settings-ai-provider-option--active' : ''}`}
                          onClick={() => void selectAiProvider(value)}
                          disabled={aiBusy !== null}
                        >
                          <strong>{label}</strong>
                          <small>{hint}</small>
                        </button>
                      ))}
                    </div>

                    {selectedAiProvider === 'openrouter' && (
                      <div className="settings-ai-key">
                        <div>
                          <span className="field-label">OpenRouter API key</span>
                          <span className="field-hint">
                            Stored only in your operating system credential vault — never in project files.
                          </span>
                        </div>
                        <div className="settings-ai-key-row">
                          <input
                            type="password"
                            value={openRouterKey}
                            onChange={(event) => setOpenRouterKey(event.target.value)}
                            placeholder={aiStatus?.openrouterConfigured ? 'A key is already saved' : 'sk-or-…'}
                            aria-label="OpenRouter API key"
                            autoComplete="off"
                          />
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => void saveOpenRouterKey()}
                            disabled={aiBusy !== null || !openRouterKey.trim()}
                          >
                            {aiBusy === 'key' ? 'Saving…' : 'Save key'}
                          </button>
                          {aiStatus?.openrouterConfigured && (
                            <button
                              className="btn btn--sm btn--ghost"
                              onClick={() => void removeOpenRouterKey()}
                              disabled={aiBusy !== null}
                            >
                              {aiBusy === 'remove' ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="field settings-ai-model">
                      <span className="field-label">Default model</span>
                      <select
                        value={activeTenant.aiModel ?? ''}
                        onChange={(event) => void updateAiProfile({ aiModel: event.target.value || undefined })}
                        disabled={
                          aiModelsLoading ||
                          aiBusy !== null ||
                          (selectedAiProvider === 'openrouter' && !aiStatus?.openrouterConfigured)
                        }
                      >
                        <option value="">Provider default</option>
                        {activeTenant.aiModel && !aiModels.some((model) => model.id === activeTenant.aiModel) && (
                          <option value={activeTenant.aiModel}>{activeTenant.aiModel}</option>
                        )}
                        {aiModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                      <span className="field-hint">
                        {aiModelsLoading
                          ? 'Loading models…'
                          : 'Used by the chat, Advisor, and design tools unless a project selects another model.'}
                      </span>
                    </label>
                    {aiMessage && <div className="settings-account-message">{aiMessage}</div>}
                  </>
                ) : (
                  <div className="settings-ai-empty">
                    Choose a Tenant from the workspace switcher before configuring its AI provider.
                  </div>
                )}
              </div>
            ) : tab === 'accounts' ? (
              <div className="settings-accounts" role="tabpanel">
                <div className="settings-account-card">
                  <div>
                    <span className="field-label">GitHub Copilot</span>
                    <strong>{auth?.copilot.user ?? 'Not connected'}</strong>
                    <span className="field-hint">
                      Reauthenticate the AI engine and discard its stale local connection.
                    </span>
                  </div>
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={accountBusy !== null}
                    onClick={() => void reauthenticateCopilot()}
                  >
                    {accountBusy === 'copilot' ? 'Reauthenticating…' : 'Reauthenticate Copilot'}
                  </button>
                </div>
                <div className="settings-account-card">
                  <div>
                    <span className="field-label">GitHub CLI</span>
                    <strong>Repository account</strong>
                    <span className="field-hint">
                      Used to clone repositories and switch tenant accounts.
                    </span>
                  </div>
                  <button
                    className="btn btn--sm btn--ghost"
                    disabled={accountBusy !== null}
                    onClick={() => void reconnectGithub()}
                  >
                    {accountBusy === 'github' ? 'Opening…' : 'Connect another GitHub account'}
                  </button>
                </div>
                {accountMessage && <div className="settings-account-message">{accountMessage}</div>}
              </div>
            ) : tab === 'appearance' ? (
              <div className="settings-appearance" role="tabpanel">
                <div className="field">
                  <span className="field-label">Theme</span>
                  <div className="seg">
                    {THEMES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        className={`seg-btn${settings.theme === t.value ? ' seg-btn--active' : ''}`}
                        onClick={() => pickTheme(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <span className="field-hint">Dark is the default product theme.</span>
                </div>
                <div className="appearance-grid">
                  <label className="field appearance-color">
                    <span className="field-label">Accent colour</span>
                    <span className="appearance-colour-control">
                      <input
                        type="color"
                        value={settings.visual?.accentColor ?? DEFAULT_ACCENT}
                        onChange={(e) => pickVisual({ accentColor: e.target.value })}
                        aria-label="Accent colour"
                      />
                      <code>{settings.visual?.accentColor ?? DEFAULT_ACCENT}</code>
                    </span>
                  </label>
                  <label className="field appearance-color">
                    <span className="field-label">Surface colour</span>
                    <span className="appearance-colour-control">
                      <input
                        type="color"
                        value={settings.visual?.surfaceColor ?? DEFAULT_SURFACE}
                        onChange={(e) => pickVisual({ surfaceColor: e.target.value })}
                        aria-label="Surface colour"
                      />
                      <code>{settings.visual?.surfaceColor ?? DEFAULT_SURFACE}</code>
                    </span>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Corner rounding</span>
                  <span className="appearance-range">
                    <input
                      type="range"
                      min="0"
                      max="28"
                      value={settings.visual?.borderRadius ?? 10}
                      onChange={(e) => pickVisual({ borderRadius: Number(e.target.value) })}
                    />
                    <output>{settings.visual?.borderRadius ?? 10}px</output>
                  </span>
                  <span className="field-hint">Adjusts the rounding of panels, fields, and controls.</span>
                </label>
                <div className="field">
                  <span className="field-label">Application icon</span>
                  <div className="appearance-icon-grid">
                    {([
                      ['mark', 'VESPERTTINE mark', 'The high-quality tiled product mark.'],
                      ['monogram', 'Compact VESPERTTINE', 'A smaller presentation of the VESPERTTINE tiles.']
                    ] as const).map(([value, label, hint]) => (
                      <button
                        key={value}
                        type="button"
                        className={`appearance-icon-option${(settings.visual?.appIcon ?? 'mark') === value ? ' appearance-icon-option--active' : ''}`}
                        onClick={() => pickVisual({ appIcon: value })}
                      >
                        <span className={`appearance-icon-preview appearance-icon-preview--${value}`}>
                          <FabricatorMark />
                        </span>
                        <span><strong>{label}</strong><small>{hint}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div className="field">
              <span className="field-label">Text size</span>
              <div className="seg">
                {UI_SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`seg-btn${(settings.uiScale ?? 1) === s ? ' seg-btn--active' : ''}`}
                    onClick={() => pickScale(s)}
                  >
                    {Math.round(s * 100)}%
                  </button>
                ))}
              </div>
              <span className="field-hint">Scale the whole interface — handy on large monitors.</span>
            </div>

            <label className="field">
              <span className="field-label">Workspace folder</span>
              <div className="settings-row">
                <code className="settings-path" title={workspaceRoot ?? ''}>
                  {workspaceRoot ?? '…'}
                </code>
                <button className="btn btn--sm btn--ghost" onClick={() => void changeRoot()}>
                  Change…
                </button>
              </div>
              <span className="field-hint">New projects are created here.</span>
            </label>

            <div className="field">
              <span className="field-label">Usage stats</span>
              <span className="field-hint">
                We send your sign-in domain and a hashed email so we can see how the product is
                used. Your email, code, and apps stay on this device.
              </span>
            </div>

            <div className="field">
              <span className="field-label">Performance</span>
              <ToggleRow
                label="Compatibility rendering"
                hint="Disable GPU acceleration to fix freezing in VMs like Parallels."
                checked={Boolean(settings.experiments?.compatibilityRendering)}
                onChange={toggleCompatRendering}
              />
            </div>

            <div className="field">
              <span className="field-label">Updates</span>
              <div className="settings-row">
                <span className="field-hint">{updateMsg}</span>
                <button
                  className="btn btn--sm btn--ghost"
                  disabled={updateBusy}
                  onClick={() => {
                    setCheckedUpdates(true)
                    void checkNow()
                  }}
                >
                  {updateBusy ? 'Checking…' : 'Check for updates'}
                </button>
              </div>
            </div>

            <div className="field">
              <span className="field-label">Diagnostics</span>
              <ToggleRow
                label="Full diagnostics"
                hint="Also capture prompts, responses, and tool output for each chat turn. Off by default — only lightweight metadata (timing, tools used, errors) is recorded. Turn on to include more detail in a bug report."
                checked={Boolean(settings.fullDiagnostics)}
                onChange={(v) => onChange({ fullDiagnostics: v })}
              />
              <div className="settings-row">
                <span className="field-hint">
                  Diagnostics for your chat sessions are saved on this device. Export them to
                  attach to a bug report.
                </span>
                <span className="diagnostics-actions">
                  <button
                    className="btn btn--sm btn--ghost"
                    disabled={exporting}
                    onClick={() => void exportDiagnostics()}
                  >
                    {exporting ? 'Exporting…' : 'Export diagnostics'}
                  </button>
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => void window.api.openLogs()}
                  >
                    Open logs folder
                  </button>
                </span>
              </div>
            </div>

            <div
              className={`field settings-experiments${showExperiments ? ' settings-experiments--open' : ''}`}
            >
              <button
                type="button"
                className={`settings-disclosure${showExperiments ? ' settings-disclosure--open' : ''}`}
                aria-expanded={showExperiments}
                onClick={() => setShowExperiments((s) => !s)}
              >
                <span
                  className="codicon codicon-chevron-right settings-disclosure-caret"
                  aria-hidden="true"
                />
                <span className="field-label">
                  Experiments <span className="settings-beta">Beta</span>
                </span>
              </button>
              {showExperiments && (
                <div className="settings-disclosure-body">
                  <div className="settings-warn" role="note">
                    <span className="codicon codicon-warning" aria-hidden="true" />
                    <span>
                      These features are experimental and off by default. They may be unstable,
                      change, or be removed in a future update.
                    </span>
                  </div>
                  <ToggleRow
                    label="Chat mode selector"
                    hint="Show Agent, Plan, and Autopilot in the composer. Plan researches, clarifies, and waits for approval before building."
                    checked={Boolean(settings.experiments?.chatModeSelector)}
                    onChange={(v) => onChange({ experiments: { chatModeSelector: v } })}
                  />
                  <ToggleRow
                    label="Live local preview"
                    hint="While an agent turn runs, start the app's Vite dev server and show it in the preview so edits appear live. Stopped at turn end; needs a project with a dev script."
                    checked={Boolean(settings.experiments?.localDevPreview)}
                    onChange={(v) => onChange({ experiments: { localDevPreview: v } })}
                  />
                </div>
              )}
            </div>
              </>
            )}
          </div>

          <div className="modal-footer settings-footer">
            <span className="settings-version">
              {versions
                ? `VESPERTTINE RAYFIN EDITOR ${versions.app} · Tauri ${versions.tauri} · WebView2 ${versions.webview2} · Copilot CLI ${versions.copilot ?? 'unknown'}`
                : ''}
            </span>
            <button className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      {restartPrompt && (
        <ConfirmModal
          title="Restart required"
          message="Compatibility rendering only changes after a restart. VESPERTTINE RAYFIN EDITOR will restart now to apply it."
          confirmLabel="Restart now"
          cancelLabel="Cancel"
          onConfirm={() => void window.api.relaunch()}
          onCancel={() => {
            onChange({ experiments: { compatibilityRendering: restartPrompt.revertTo } })
            setRestartPrompt(null)
          }}
        />
      )}
    </>
  )
}
