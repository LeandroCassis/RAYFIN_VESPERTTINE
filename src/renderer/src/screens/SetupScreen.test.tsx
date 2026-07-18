import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AppSettings, AuthStatus, DoctorReport, ToolStatus } from '@shared/ipc'
import SetupScreen from './SetupScreen'

function tool(overrides: Partial<ToolStatus>): ToolStatus {
  return {
    id: 'node',
    name: 'Node.js',
    found: true,
    satisfied: true,
    version: 'v20.0.0',
    installHint: '',
    autoInstallable: false,
    required: true,
    ...overrides
  }
}

const doctor: DoctorReport = {
  ready: true,
  tools: [
    tool({ id: 'node', name: 'Node.js' }),
    tool({ id: 'npm', name: 'npm' }),
    tool({ id: 'git', name: 'Git' }),
    tool({ id: 'az', name: 'Azure CLI' })
  ]
}

const auth: AuthStatus = {
  copilot: { signedIn: false },
  rayfin: { signedIn: false },
  az: { signedIn: false }
}

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    onProcLog: vi.fn(() => () => {}),
    doctor: {
      install: vi.fn(),
      installAll: vi.fn()
    },
    auth: {
      loginCopilot: vi.fn(),
      loginAz: vi.fn(),
      loginRayfin: vi.fn().mockResolvedValue({ ok: true }),
      status: vi.fn().mockResolvedValue(auth)
    },
    github: {
      status: vi.fn().mockResolvedValue({ ghInstalled: true, signedIn: true, user: 'octocat' }),
      switchAccount: vi.fn().mockResolvedValue({ ok: true }),
      login: vi.fn()
    },
    relaunch: vi.fn()
  }
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
})

describe('SetupScreen sign-in providers', () => {
  it('does not show Microsoft Fabric sign-in before a project exists', () => {
    render(
      <SetupScreen
        doctor={doctor}
        auth={auth}
        refreshing={false}
        onRefresh={() => {}}
        onEnter={() => {}}
      />
    )

    expect(screen.getByText('GitHub Copilot')).toBeTruthy()
    expect(screen.getAllByText('Azure CLI').length).toBeGreaterThan(0)
    expect(screen.queryByText('Microsoft Fabric')).toBeNull()
  })

  it('selects a tenant and switches its tenant before entering the editor', async () => {
    const profile = {
      id: 'org-1',
      name: 'Contoso',
      tenantId: 'contoso.onmicrosoft.com',
      githubUser: 'octocat'
    }
    const settings: AppSettings = {
      theme: 'dark',
      organizationProfiles: [profile]
    }
    const onSettingsChange = vi.fn().mockResolvedValue(undefined)

    render(
      <SetupScreen
        doctor={doctor}
        auth={auth}
        refreshing={false}
        onRefresh={() => {}}
        onEnter={() => {}}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Use tenant' }))

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ activeOrganizationId: 'org-1' })
      )
      expect(window.api.auth.loginRayfin).toHaveBeenCalledWith('contoso.onmicrosoft.com')
    })
  })

  it('opens the editor from the active tenant card when the environment is ready', () => {
    const profile = {
      id: 'tenant-1',
      name: 'Contoso',
      tenantId: 'contoso.onmicrosoft.com',
      githubUser: 'octocat'
    }
    const onEnter = vi.fn()
    render(
      <SetupScreen
        doctor={doctor}
        auth={{
          copilot: { signedIn: true, user: 'octocat' },
          rayfin: { signedIn: true, tenant: profile.tenantId },
          az: { signedIn: true, user: 'dev@contoso.com' }
        }}
        refreshing={false}
        onRefresh={() => {}}
        onEnter={onEnter}
        settings={{ theme: 'dark', organizationProfiles: [profile], activeOrganizationId: profile.id }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open editor →' }))
    expect(onEnter).toHaveBeenCalledOnce()
  })
})
