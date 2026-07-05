import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { StudioProject } from '@shared/ipc'
import { OverlayProvider } from '../overlay'
import DeploymentsControl from './DeploymentsControl'

function makeProject(over: Partial<StudioProject> = {}): StudioProject {
  return {
    id: 'p1',
    name: 'Project',
    path: 'C:/projects/p1',
    addedAt: '2024-01-01T00:00:00.000Z',
    ...over
  }
}

afterEach(() => {
  cleanup()
})

describe('DeploymentsControl chip', () => {
  it('labels the chip “Deployment:” (the workspace name now lives in the footer)', () => {
    render(
      <OverlayProvider>
        <DeploymentsControl
          project={makeProject({
            workspace: 'de0fcf1a-8c94-46cf-a029-650b2e87f172',
            workspaceName: 'Rayfin Apps'
          })}
          running={false}
          onCreate={() => {}}
          onRedeploy={() => {}}
          onSwitch={() => Promise.resolve({ ok: true, outcome: 'success' })}
          onChanged={() => {}}
        />
      </OverlayProvider>
    )
    expect(screen.getByText('Deployment:')).toBeTruthy()
    expect(screen.queryByText('Workspace:')).toBeNull()
  })
})
