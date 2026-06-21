import type { ThemePreference } from '@shared/ipc'

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
