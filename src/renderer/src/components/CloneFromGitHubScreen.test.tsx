import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GithubRepo, GithubReposResult, GithubStatus } from '@shared/ipc'
import { OverlayProvider } from '../overlay'
import CloneFromGitHubScreen from './CloneFromGitHubScreen'

/**
 * Guards the Clone-from-GitHub flow's state machine: gh-missing -> Install,
 * signed-out -> Sign in, signed-in -> stable repository loading -> clone.
 */

type GithubApi = {
  status: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  listRepos: ReturnType<typeof vi.fn>
  clone: ReturnType<typeof vi.fn>
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function makeRepo(overrides: Partial<GithubRepo> = {}): GithubRepo {
  return {
    nameWithOwner: 'octocat/alpha-app',
    name: 'alpha-app',
    description: 'First app',
    isPrivate: false,
    isFork: false,
    primaryLanguage: 'TypeScript',
    ...overrides
  }
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
  it('keeps a picker-shaped loading state while the initial GitHub check is pending', async () => {
    const status = deferred<GithubStatus>()
    installApi({ status: vi.fn(() => status.promise) })
    renderScreen()

    expect(screen.getByLabelText('Checking GitHub connection')).toBeTruthy()
    expect(screen.getByText('Preparing your GitHub repositories')).toBeTruthy()
    expect(screen.queryByText('No repositories match your filter.')).toBeNull()
    const manual = screen.getByPlaceholderText(
      'owner/name or https://github.com/owner/name'
    ) as HTMLInputElement
    expect(manual.disabled).toBe(false)
    fireEvent.change(manual, { target: { value: 'octocat/alpha-app' } })
    expect(manual.value).toBe('octocat/alpha-app')

    await act(async () => {
      status.resolve({ ghInstalled: true, signedIn: false })
    })

    expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy()
  })

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

  it('shows repository skeletons instead of a false empty list while repositories load', async () => {
    const repos = deferred<GithubReposResult>()
    installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() => repos.promise)
    })
    renderScreen()

    expect(await screen.findByText('Loading your repositories...')).toBeTruthy()
    expect(screen.queryByText('No repositories match your filter.')).toBeNull()
    expect((screen.getByPlaceholderText('Filter repositories') as HTMLInputElement).disabled).toBe(
      true
    )

    await act(async () => {
      repos.resolve({ ok: true, repos: [makeRepo()] })
    })

    expect(await screen.findByRole('button', { name: /alpha-app/ })).toBeTruthy()
  })

  it('keeps a failed repository request retryable', async () => {
    const api = installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          error: 'GitHub did not return repositories.',
          repos: []
        })
        .mockResolvedValueOnce({ ok: true, repos: [makeRepo()] })
    })
    renderScreen()

    expect(await screen.findByText('GitHub did not return repositories.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Loading your repositories...')).toBeTruthy()
    expect(await screen.findByRole('button', { name: /alpha-app/ })).toBeTruthy()
    expect(api.listRepos).toHaveBeenCalledTimes(2)
  })

  it('renders repositories in pages so a large account does not block the picker', async () => {
    const repos = Array.from({ length: 45 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0')
      return makeRepo({
        nameWithOwner: `octocat/repo-${number}`,
        name: `repo-${number}`
      })
    })
    installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() => Promise.resolve({ ok: true, repos }))
    })
    renderScreen()

    expect(await screen.findByRole('button', { name: /repo-01/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /repo-45/ })).toBeNull()
    expect(screen.getByText('Showing 40 of 45 repositories')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show 5 more' }))

    expect(screen.getByRole('button', { name: /repo-45/ })).toBeTruthy()
  })

  it('lists the user repos, filters them, and clones the selected one', async () => {
    const api = installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() =>
        Promise.resolve({
          ok: true,
          repos: [
            makeRepo({ isPrivate: true }),
            makeRepo({
              nameWithOwner: 'octocat/beta-tool',
              name: 'beta-tool',
              description: 'Second thing',
              primaryLanguage: 'Rust'
            })
          ]
        })
      )
    })
    const { onCloned } = renderScreen()

    expect(await screen.findByRole('button', { name: /alpha-app/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /beta-tool/ })).toBeTruthy()
    expect(api.listRepos).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText('Filter repositories'), {
      target: { value: 'beta' }
    })
    expect(screen.queryByRole('button', { name: /alpha-app/ })).toBeNull()
    expect(screen.getByRole('button', { name: /beta-tool/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /beta-tool/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clone and open' }))

    await waitFor(() => expect(api.clone).toHaveBeenCalledWith('octocat/beta-tool'))
    await waitFor(() => expect(onCloned).toHaveBeenCalledTimes(1))
  })

  it('marks only the selected repository with a checkmark', async () => {
    installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() =>
        Promise.resolve({
          ok: true,
          repos: [
            makeRepo(),
            makeRepo({ nameWithOwner: 'octocat/beta-tool', name: 'beta-tool' })
          ]
        })
      )
    })
    renderScreen()

    const repo = await screen.findByRole('button', { name: /alpha-app/ })
    expect(repo.querySelector('.clone-repo-selected')).toBeNull()

    fireEvent.click(repo)

    expect(repo.classList.contains('clone-repo--active')).toBe(true)
    expect(repo.querySelector('.clone-repo-selected')).not.toBeNull()
    // The unselected repo has no checkmark.
    expect(
      screen.getByRole('button', { name: /beta-tool/ }).querySelector('.clone-repo-selected')
    ).toBeNull()
  })

  it('advances the clone checklist as the backend streams progress markers', async () => {
    let emitLog: ((event: { channel: string; data: string }) => void) | null = null
    const cloneCall = deferred<{ ok: boolean }>()
    installApi({
      status: vi.fn(() => Promise.resolve({ ghInstalled: true, signedIn: true, user: 'octocat' })),
      listRepos: vi.fn(() => Promise.resolve({ ok: true, repos: [makeRepo()] })),
      clone: vi.fn(() => cloneCall.promise)
    })
    // Capture the streamed-log subscriber so the test can drive phase markers.
    ;(
      window as unknown as {
        api: { onProcLog: (cb: (event: { channel: string; data: string }) => void) => () => void }
      }
    ).api.onProcLog = (cb) => {
      emitLog = cb
      return () => {}
    }

    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /alpha-app/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clone and open' }))

    // The progress checklist appears; the install step is not active yet (no hint).
    expect(await screen.findByRole('button', { name: 'Show details' })).toBeTruthy()
    expect(screen.getByText('Installing dependencies')).toBeTruthy()
    expect(screen.queryByText(/First run can take a minute or two/i)).toBeNull()

    // Streaming the npm-install marker activates the dependency-install step —
    // regression cover for surfacing that clone runs `npm install`.
    await act(async () => {
      emitLog?.({ channel: 'clone:project', data: '\nInstalling dependencies (npm install)…\n' })
    })
    expect(await screen.findByText(/First run can take a minute or two/i)).toBeTruthy()

    await act(async () => {
      cloneCall.resolve({ ok: true })
    })
  })
})
