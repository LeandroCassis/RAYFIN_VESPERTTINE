import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, AuthStatus, DoctorReport } from '@shared/ipc'
import SetupScreen from './screens/SetupScreen'
import Workbench from './screens/Workbench'
import UpdateBanner from './components/UpdateBanner'
import { watchTheme } from './theme'
import logo from './assets/logo.png'

type Phase = 'loading' | 'setup' | 'ready'

function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('loading')
  const [doctor, setDoctor] = useState<DoctorReport | null>(null)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true)
    try {
      const [d, a] = await Promise.all([window.api.doctor.check(), window.api.auth.status()])
      setDoctor(d)
      setAuth(a)
      const ready = d.ready && a.copilot.signedIn && a.rayfin.signedIn
      setPhase(ready ? 'ready' : 'setup')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void window.api.settings.get().then(setSettings)
  }, [refresh])

  // Apply the theme app-wide (covers splash + setup, not just the workbench)
  // and follow the OS when set to 'system'.
  useEffect(() => {
    if (!settings) return
    return watchTheme(settings.theme)
  }, [settings])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>): Promise<void> => {
    setSettings(await window.api.settings.set(patch))
  }, [])

  if (phase === 'loading') {
    return (
      <>
        <UpdateBanner />
        <div className="splash">
          <img className="brand-mark" src={logo} alt="Rayfin Fabricator" />
          <span>Starting Rayfin Fabricator…</span>
        </div>
      </>
    )
  }

  if (phase === 'ready' && auth) {
    return (
      <>
        <UpdateBanner />
        <Workbench
          auth={auth}
          onSignOut={refresh}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </>
    )
  }

  return (
    <>
      <UpdateBanner />
      <SetupScreen doctor={doctor} auth={auth} refreshing={refreshing} onRefresh={refresh} />
    </>
  )
}

export default App
