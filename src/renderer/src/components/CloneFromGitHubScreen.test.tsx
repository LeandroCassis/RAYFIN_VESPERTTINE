import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OverlayProvider } from '../overlay'
import CloneFromGitHubScreen from './CloneFromGitHubScreen'

/**
 * Guards the Clone-from-GitHub flow's state machine: gh-missing → Install,
 * signed-out → Sign in, signed-in → filterable repo list + clone.
 */

type GithubApi = {
  status: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  listRepos: ReturnType<typeof vi.fn>
  clone: ReturnType<typeof vi.fn>
}

function installApi(github: Partial<GithubApi>): GithubApi {
  const api: GithubApi = {
    status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: false })),
    login: vi.fn(() => Promise.resolve({ ok: true })),
    listRepos: vi.fn(() => Promise.resolve({ ok: true, repos: [] })),
    clone: vi.fn(() => Promise.resolve({ ok: true })),
    ...github
  }
  ;(window as unknown as { api: unknown }).api = {
    github: api,
    doctor: { install: vi.fn(() => Promise.resolve({ ok: true, requiresRelaunch: true })) },
    onProcLog: vi.fn(() => () => {}),
    relaunch: vi.fn(() => Promise.resolve()),
    openExternal: vi.fn(() => Promise.resolve())
  }
  return api
}

function renderScreen(): { onCancel: () => void; onCloned: () => void } {
  const onCancel = vi.fn()
  const onCloned = vi.fn()
  render(
    <OverlayProvider>
      <CloneFromGitHubScreen onCancel={onCancel} onCloned={onCloned} />
    </OverlayProvider>
  )
  return { onCancel, onCloned }
}

afterEach(() => {
  cleanup()
  delete (window as unknown as { api?: unknown }).api
})

describe('CloneFromGitHubScreen', () => {
  it('offers to install the GitHub CLI when it is missing', async () => {
    installApi({ status: vi.fn(() => Promise.resolve({ ghInstalled: false, signedIn: false })) })
    await act(async () => renderScreen())

    expect(await screen.findByRole('button', { name: 'Install GitHub CLI' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign in with GitHub' })).toBeNull()
  })

  it('prompts sign-in when gh is installed but signed out', async () => {
    installApi({ status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: false })) })
    await act(async () => renderScreen())

    expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Install GitHub CLI' })).toBeNull()
  })

  it('lists the user repos, filters them, and clones the selected one', async () => {
    const api = installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() =>
        Promise.resolve({
          ok: true,
          repos: [
            {
              nameWithOwner: 'octocat/alpha-app',
              name: 'alpha-app',
              description: 'First app',
              isPrivate: true,
              isFork: false,
              primaryLanguage: 'TypeScript'
            },
            {
              nameWithOwner: 'octocat/beta-tool',
              name: 'beta-tool',
              description: 'Second thing',
              isPrivate: false,
              isFork: false,
              primaryLanguage: 'Rust'
            }
          ]
        })
      )
    })
    const { onCloned } = renderScreen()

    // Both repos load and render.
    expect(await screen.findByRole('button', { name: /alpha-app/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /beta-tool/ })).toBeTruthy()
    expect(api.listRepos).toHaveBeenCalledTimes(1)

    // Filter narrows the list client-side.
    fireEvent.change(screen.getByPlaceholderText('Filter repositories…'), {
      target: { value: 'beta' }
    })
    expect(screen.queryByRole('button', { name: /alpha-app/ })).toBeNull()
    expect(screen.getByRole('button', { name: /beta-tool/ })).toBeTruthy()

    // Selecting a repo enables Clone; clicking it clones that repo.
    fireEvent.click(screen.getByRole('button', { name: /beta-tool/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clone & open' }))

    await waitFor(() => expect(api.clone).toHaveBeenCalledWith('octocat/beta-tool'))
    await waitFor(() => expect(onCloned).toHaveBeenCalledTimes(1))
  })
})
