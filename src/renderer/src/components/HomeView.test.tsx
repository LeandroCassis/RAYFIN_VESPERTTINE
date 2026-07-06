import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import HomeView from './HomeView'

/**
 * Guards the "Open existing…" dropdown added for Clone-from-GitHub: the button
 * opens a menu whose two items route to the folder picker vs. the GitHub flow.
 */

function baseProps(): React.ComponentProps<typeof HomeView> {
  return {
    projects: [],
    activeId: null,
    workspaceRoot: '/ws',
    opening: false,
    menuOpenId: null,
    setMenuOpenId: vi.fn(),
    renamingId: null,
    renameValue: '',
    setRenameValue: vi.fn(),
    onSelect: vi.fn(),
    onStartRename: vi.fn(),
    onSubmitRename: vi.fn(),
    onCancelRename: vi.fn(),
    onRemoveFromList: vi.fn(),
    onDeleteFromDisk: vi.fn(),
    onNewProject: vi.fn(),
    onOpenExisting: vi.fn(),
    onCloneFromGitHub: vi.fn(),
    onChangeWorkspaceRoot: vi.fn()
  }
}

afterEach(() => cleanup())

describe('HomeView "Open existing…" menu', () => {
  it('is closed initially and opens the two options on click', () => {
    render(<HomeView {...baseProps()} />)

    expect(screen.queryByRole('menuitem', { name: 'Browse folder…' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Clone from GitHub…' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open existing…' }))

    expect(screen.getByRole('menuitem', { name: 'Browse folder…' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Clone from GitHub…' })).toBeTruthy()
  })

  it('"Browse folder…" fires onOpenExisting (and not the clone flow)', () => {
    const props = baseProps()
    render(<HomeView {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open existing…' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Browse folder…' }))

    expect(props.onOpenExisting).toHaveBeenCalledTimes(1)
    expect(props.onCloneFromGitHub).not.toHaveBeenCalled()
  })

  it('"Clone from GitHub…" fires onCloneFromGitHub (and not the folder picker)', () => {
    const props = baseProps()
    render(<HomeView {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open existing…' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clone from GitHub…' }))

    expect(props.onCloneFromGitHub).toHaveBeenCalledTimes(1)
    expect(props.onOpenExisting).not.toHaveBeenCalled()
  })
})
