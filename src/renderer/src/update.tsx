import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { AppUpdateInfo, UpdateProgress } from '@shared/ipc'

/**
 * In-app update state, shared between the app-wide {@link UpdateBanner} and the
 * "Check for updates" control in Settings.
 *
 * On startup (production builds only) the app checks GitHub Releases and, if a
 * newer signed release exists, downloads its installer in the background and
 * surfaces a banner. The user confirms, and `install()` applies the update and
 * restarts. All of this is driven by Rust (`window.api.updates`, backed by the
 * Tauri updater); the renderer only orchestrates the UX.
 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdateApi {
  status: UpdateStatus
  info: AppUpdateInfo | null
  progress: UpdateProgress | null
  /** Manually check, and download in the background if an update is found. */
  checkNow: () => Promise<void>
  /** Install the downloaded update and restart the app. */
  install: () => Promise<void>
  /** Hide the banner for now (until the next check finds an update). */
  dismiss: () => void
}

const UpdateContext = createContext<UpdateApi | null>(null)

export function UpdateProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [info, setInfo] = useState<AppUpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const dismissed = useRef(false)
  const startedAutoCheck = useRef(false)

  useEffect(() => window.api.updates.onProgress((p) => setProgress(p)), [])

  const download = useCallback(async (): Promise<void> => {
    setStatus('downloading')
    setProgress(null)
    try {
      const found = await window.api.updates.download()
      if (dismissed.current) return
      if (found) {
        setInfo(found)
        setStatus('ready')
      } else {
        setStatus('idle')
      }
    } catch (err) {
      console.error('[update] download failed', err)
      if (!dismissed.current) setStatus('error')
    }
  }, [])

  const checkNow = useCallback(async (): Promise<void> => {
    dismissed.current = false
    setStatus('checking')
    try {
      const found = await window.api.updates.check()
      if (!found) {
        setInfo(null)
        setStatus('idle')
        return
      }
      setInfo(found)
      await download()
    } catch (err) {
      console.error('[update] check failed', err)
      setStatus('error')
    }
  }, [download])

  const install = useCallback(async (): Promise<void> => {
    setStatus('installing')
    try {
      await window.api.updates.install()
      // On success the app restarts, so nothing else runs here.
    } catch (err) {
      console.error('[update] install failed', err)
      setStatus('error')
    }
  }, [])

  const dismiss = useCallback(() => {
    dismissed.current = true
    setStatus('idle')
  }, [])

  // Automatic background check + download once on startup. Skipped in dev, where
  // there is no published `latest.json` endpoint to hit. Uses `checkNow` (silent
  // 'checking' state) so up-to-date launches never flash the banner; it only
  // appears once an update is actually found and downloading.
  useEffect(() => {
    if (import.meta.env.DEV || startedAutoCheck.current) return
    startedAutoCheck.current = true
    void checkNow()
  }, [checkNow])

  const value: UpdateApi = { status, info, progress, checkNow, install, dismiss }
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

/** Access the shared in-app update state. Must be used within an `UpdateProvider`. */
export function useUpdates(): UpdateApi {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdates must be used within an UpdateProvider')
  return ctx
}
