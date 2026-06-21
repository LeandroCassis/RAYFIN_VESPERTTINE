import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'

/** Session partition shared by the preview <webview> and its auth popups. */
const PREVIEW_PARTITION = 'persist:rayfin-preview'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Rayfin Studio',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open target=_blank / external links in the user's browser, not in-app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  registerIpc()
  configurePreviewPopups()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/** Pull width/height out of a `window.open` feature string (e.g. "popup=yes,width=480,height=640"). */
function parsePopupSize(features: string): { width: number; height: number } {
  const num = (key: string, fallback: number): number => {
    const m = new RegExp(`${key}\\s*=\\s*(\\d+)`).exec(features)
    return m ? Number(m[1]) : fallback
  }
  return { width: num('width', 520), height: num('height', 720) }
}

/**
 * The preview <webview> hosts the user's *deployed* Rayfin app. Its Fabric
 * sign-in opens a broker popup via `window.open(url, 'fabricAuth', 'popup=yes,…')`
 * and waits for that popup to `postMessage` the auth handoff back to
 * `window.opener`. For that to work inside Electron we must explicitly handle the
 * guest's window-open: allow the auth popup as a real child window that (a) keeps
 * the `opener` relationship so the postMessage handoff is delivered, and (b)
 * shares the preview session partition so Fabric SSO cookies are reused. Plain
 * `target=_blank` links (no popup features) are sent to the system browser.
 */
function configurePreviewPopups(): void {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return
    contents.setWindowOpenHandler((details) => {
      const features = details.features || ''
      const isAuthPopup = /\b(popup|width|height)\s*=/.test(features)
      if (!isAuthPopup) {
        if (details.url && /^https?:\/\//.test(details.url)) void shell.openExternal(details.url)
        return { action: 'deny' }
      }
      const { width, height } = parsePopupSize(features)
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width,
          height,
          autoHideMenuBar: true,
          title: 'Sign in',
          webPreferences: {
            partition: PREVIEW_PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
          }
        }
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
