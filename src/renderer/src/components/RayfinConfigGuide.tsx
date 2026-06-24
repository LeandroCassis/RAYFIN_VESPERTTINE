import { useMemo, type ReactNode } from 'react'
import { parse } from 'yaml'
import {
  DatabaseIcon,
  FabricIcon,
  GearIcon,
  GlobeIcon,
  InfoIcon,
  KeyIcon,
  ShieldIcon
} from './icons'

/**
 * A friendly, plain-language explainer for `rayfin/rayfin.yml` — the single most
 * important file in a Rayfin project. It parses the YAML and narrates what each
 * service does so a non-coder can understand (and trust) their app's backend
 * without reading config. Falls back gracefully if the file can't be parsed.
 */

interface AuthService {
  enabled?: boolean
  fabric?: { enabled?: boolean }
  password?: { enabled?: boolean }
  allowedRedirectUris?: string[]
  scopes?: string[]
  customClaims?: Record<string, unknown>
}
interface DataService {
  enabled?: boolean
  dialect?: string
}
interface HostingService {
  enabled?: boolean
  folder?: string
  buildCommand?: string
  indexDocument?: string
}
interface RayfinConfig {
  id?: string
  name?: string
  version?: string
  services?: {
    auth?: AuthService
    data?: DataService
    staticHosting?: HostingService
  }
}

/** Friendly names for the database dialects Rayfin supports. */
const DIALECTS: Record<string, string> = {
  mssql: 'Microsoft SQL — a powerful relational database',
  postgres: 'PostgreSQL — a popular open-source database',
  postgresql: 'PostgreSQL — a popular open-source database',
  sqlite: 'SQLite — a lightweight, file-based database'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function Status({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={`cfg-status${on ? ' cfg-status--on' : ' cfg-status--off'}`}>
      {on ? 'On' : 'Off'}
    </span>
  )
}

function Card({
  icon,
  title,
  on,
  children
}: {
  icon: JSX.Element
  title: string
  on?: boolean
  children: ReactNode
}): JSX.Element {
  return (
    <section className="cfg-card">
      <header className="cfg-card-head">
        <span className="cfg-card-icon">{icon}</span>
        <h3 className="cfg-card-title">{title}</h3>
        {on !== undefined && <Status on={on} />}
      </header>
      <div className="cfg-card-body">{children}</div>
    </section>
  )
}

function Method({
  icon,
  label,
  desc,
  on
}: {
  icon: JSX.Element
  label: string
  desc: string
  on: boolean
}): JSX.Element {
  return (
    <div className={`cfg-method${on ? '' : ' cfg-method--off'}`}>
      <span className="cfg-method-icon">{icon}</span>
      <div className="cfg-method-text">
        <span className="cfg-method-label">{label}</span>
        <span className="cfg-method-desc">{desc}</span>
      </div>
      <span className="cfg-method-mark" aria-hidden="true">
        {on ? '✓' : '—'}
      </span>
    </div>
  )
}

function Note({ children }: { children: ReactNode }): JSX.Element {
  return <p className="cfg-note">{children}</p>
}

function ListBlock({
  label,
  hint,
  items
}: {
  label: string
  hint: string
  items?: string[]
}): JSX.Element | null {
  if (!items || items.length === 0) return null
  return (
    <div className="cfg-list">
      <div className="cfg-list-head">
        <span className="cfg-list-label">{label}</span>
        <span className="cfg-list-hint">{hint}</span>
      </div>
      <ul className="cfg-list-items">
        {items.map((it, i) => (
          <li key={i}>
            <code>{String(it)}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}

function KV({ k, children }: { k: string; children: ReactNode }): JSX.Element {
  return (
    <div className="cfg-kv">
      <span className="cfg-kv-k">{k}</span>
      <span className="cfg-kv-v">{children}</span>
    </div>
  )
}

export default function RayfinConfigGuide({ content }: { content: string }): JSX.Element {
  const cfg = useMemo<RayfinConfig | null>(() => {
    try {
      const parsed: unknown = parse(content)
      return isRecord(parsed) ? (parsed as RayfinConfig) : null
    } catch {
      return null
    }
  }, [content])

  if (!cfg) {
    return (
      <div className="cfg-guide cfg-guide--empty">
        <InfoIcon className="cfg-empty-icon" />
        <p>
          We couldn&apos;t turn this file into a friendly guide. Switch to <strong>YAML</strong> to
          view it directly.
        </p>
      </div>
    )
  }

  const auth = cfg.services?.auth
  const data = cfg.services?.data
  const hosting = cfg.services?.staticHosting
  const fabricOn = !!auth?.fabric?.enabled
  const passwordOn = !!auth?.password?.enabled
  const claims = auth && isRecord(auth.customClaims) ? Object.entries(auth.customClaims) : []

  return (
    <div className="cfg-guide">
      <header className="cfg-head">
        <div className="cfg-head-row">
          <span className="cfg-head-icon">
            <GearIcon />
          </span>
          <div className="cfg-head-text">
            <h2 className="cfg-title">{cfg.name || 'Your Rayfin app'}</h2>
            <p className="cfg-sub">
              This is your app&apos;s blueprint — the single file that defines your backend: who can
              sign in, where your data lives, and how your site goes online.
            </p>
          </div>
        </div>
        <div className="cfg-meta">
          {cfg.id && (
            <span className="cfg-meta-item">
              <span className="cfg-meta-k">ID</span>
              {cfg.id}
            </span>
          )}
          {cfg.version && (
            <span className="cfg-meta-item">
              <span className="cfg-meta-k">Version</span>
              {cfg.version}
            </span>
          )}
          <span className="cfg-meta-item cfg-meta-item--file">rayfin/rayfin.yml</span>
        </div>
      </header>

      {auth && (
        <Card icon={<ShieldIcon />} title="Sign-in &amp; accounts" on={!!auth.enabled}>
          {auth.enabled ? (
            <>
              <p className="cfg-card-desc">Controls who can use your app and how they sign in.</p>
              <div className="cfg-methods">
                <Method
                  icon={<FabricIcon />}
                  label="Microsoft work or school account"
                  desc="Sign in with Microsoft Fabric / Entra ID"
                  on={fabricOn}
                />
                <Method
                  icon={<KeyIcon />}
                  label="Email &amp; password"
                  desc="A classic email and password login"
                  on={passwordOn}
                />
              </div>
              {!fabricOn && !passwordOn && (
                <Note>No sign-in methods are switched on yet, so no one can sign in.</Note>
              )}
              <ListBlock
                label="Allowed return URLs"
                hint="Where people land right after signing in"
                items={auth.allowedRedirectUris}
              />
              <ListBlock
                label="Permissions (scopes)"
                hint="What a signed-in user is allowed to do"
                items={auth.scopes}
              />
              {claims.length > 0 && (
                <div className="cfg-list">
                  <div className="cfg-list-head">
                    <span className="cfg-list-label">Extra account details (custom claims)</span>
                    <span className="cfg-list-hint">Saved into each user&apos;s sign-in token</span>
                  </div>
                  <ul className="cfg-list-items">
                    {claims.map(([k, v]) => (
                      <li key={k}>
                        <code>{k}</code> = <code>{String(v)}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <Note>Sign-in is turned off — anyone can use your app without an account.</Note>
          )}
        </Card>
      )}

      {data && (
        <Card icon={<DatabaseIcon />} title="Database" on={!!data.enabled}>
          {data.enabled ? (
            <>
              <p className="cfg-card-desc">
                A managed database where your app stores and reads its data.
              </p>
              {data.dialect && (
                <KV k="Type">{DIALECTS[data.dialect.toLowerCase()] ?? data.dialect}</KV>
              )}
            </>
          ) : (
            <Note>No managed database — your app won&apos;t store data on the backend.</Note>
          )}
        </Card>
      )}

      {hosting && (
        <Card icon={<GlobeIcon />} title="Website hosting" on={!!hosting.enabled}>
          {hosting.enabled ? (
            <>
              <p className="cfg-card-desc">
                Publishes your built website so it&apos;s available online.
              </p>
              {hosting.buildCommand && (
                <KV k="Build step">
                  Runs <code>{hosting.buildCommand}</code> to build your site
                </KV>
              )}
              {hosting.folder && (
                <KV k="Published folder">
                  Serves the <code>{hosting.folder}</code> folder
                </KV>
              )}
              {hosting.indexDocument && (
                <KV k="Home page">
                  <code>{hosting.indexDocument}</code>
                </KV>
              )}
            </>
          ) : (
            <Note>No website is being hosted from this project.</Note>
          )}
        </Card>
      )}

      {!cfg.services && <Note>This config doesn&apos;t define any services yet.</Note>}

      <footer className="cfg-foot">
        <InfoIcon className="cfg-foot-icon" />
        <span>
          This is a friendly summary of the settings that matter most. Switch to{' '}
          <strong>YAML</strong> to see the exact file, or use <strong>Open in VS Code</strong> to
          edit it.
        </span>
      </footer>
    </div>
  )
}
