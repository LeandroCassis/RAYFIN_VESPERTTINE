import type { ThemePreference, VisualSettings } from '@shared/ipc'

const media = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: light)')

/** Resolve a preference to a concrete theme, consulting the OS for 'system'. */
function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return media().matches ? 'light' : 'dark'
  return pref
}

/** Apply a theme preference to <html data-theme>. */
export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolve(pref)
}

/**
 * Apply the preference now and, when it is 'system', keep it in sync with OS
 * changes. Returns an unsubscribe function.
 */
export function watchTheme(pref: ThemePreference): () => void {
  applyTheme(pref)
  if (pref !== 'system') return () => {}
  const mq = media()
  const onChange = (): void => applyTheme('system')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** Available UI zoom presets, smallest to largest (1 = 100%). */
export const UI_SCALES = [1, 1.1, 1.25, 1.5] as const

/** Apply a UI zoom factor to the whole interface, clamped to a sane range. */
export function applyUiScale(scale: number | undefined): void {
  const value = Math.min(2, Math.max(0.8, scale || 1))
  document.documentElement.style.zoom = String(value)
  // `zoom` also multiplies vh units, so expose the factor for layouts that cap
  // their height to the viewport (e.g. modals) to divide it back out.
  document.documentElement.style.setProperty('--ui-scale', String(value))
}

const validHexColor = (value: string | undefined): value is string =>
  Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value))

/** Apply user-selected visual tokens without requiring a reload. */
export function applyVisualSettings(visual: VisualSettings | undefined): void {
  const root = document.documentElement
  const setOrClear = (name: string, value: string | undefined): void => {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }

  setOrClear('--accent', validHexColor(visual?.accentColor) ? visual.accentColor : undefined)
  setOrClear('--bg', validHexColor(visual?.surfaceColor) ? visual.surfaceColor : undefined)

  const radius = visual?.borderRadius
  if (typeof radius === 'number' && Number.isFinite(radius)) {
    const value = Math.min(28, Math.max(0, radius))
    root.style.setProperty('--radius-sm', `${Math.max(0, value - 3)}px`)
    root.style.setProperty('--radius', `${value}px`)
    root.style.setProperty('--radius-lg', `${value + 4}px`)
    root.style.setProperty('--radius-xl', `${value + 10}px`)
  } else {
    root.style.removeProperty('--radius-sm')
    root.style.removeProperty('--radius')
    root.style.removeProperty('--radius-lg')
    root.style.removeProperty('--radius-xl')
  }

  root.dataset.appIcon = visual?.appIcon === 'monogram' ? 'monogram' : 'mark'
}
