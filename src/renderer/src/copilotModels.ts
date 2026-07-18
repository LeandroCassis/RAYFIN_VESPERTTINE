import { useEffect, useState } from 'react'
import type { CopilotModel } from '@shared/ipc'

// Module-level cache so the per-user model list is fetched once and shared across
// every ChatPanel instance, rather than re-queried on each open.
let modelsCache: CopilotModel[] | null = null
let modelsPromise: Promise<CopilotModel[]> | null = null
let modelsScope: string | undefined

/** Clear the catalog when the active Tenant or its provider changes. */
export function resetCopilotModels(): void {
  modelsCache = null
  modelsPromise = null
  modelsScope = undefined
}

export function loadCopilotModels(scope = ''): Promise<CopilotModel[]> {
  if (modelsCache && modelsScope === scope) return Promise.resolve(modelsCache)
  if (!modelsPromise || modelsScope !== scope) {
    modelsScope = scope
    modelsPromise = window.api.chat
      .listModels()
      .then((list) => {
        // A Tenant may be switched while this request is in flight. Only retain
        // the result if it still belongs to the same cache scope.
        if (modelsScope === scope) modelsCache = list
        return list
      })
      .catch((err) => {
        if (modelsScope === scope) modelsPromise = null // allow a retry on the next request
        throw err
      })
  }
  return modelsPromise
}

/** Fetch the available models once `enabled`, keeping any static fallback until
 * they arrive (or if the engine can't be reached). */
export function useCopilotModels(
  enabled: boolean,
  scope = ''
): { models: CopilotModel[]; loading: boolean } {
  const [models, setModels] = useState<CopilotModel[]>(
    modelsScope === scope ? (modelsCache ?? []) : []
  )
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    if (modelsCache && modelsScope === scope) {
      setModels(modelsCache)
      return
    }
    setModels([])
    setLoading(true)
    loadCopilotModels(scope)
      .then((list) => {
        if (!cancelled) setModels(list)
      })
      .catch(() => {
        /* keep the static fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, scope])
  return { models, loading }
}

/** Substrings that mark a model as small/fast (cheap, low-latency). */
const FAST_HINTS = ['haiku', 'flash', 'mini', 'lite', 'small', 'fast', 'nano']

/** Whether a model looks small/fast by its id/name (see {@link FAST_HINTS}). */
export function isFastModel(m: CopilotModel): boolean {
  const s = `${m.id} ${m.name}`.toLowerCase()
  return FAST_HINTS.some((h) => s.includes(h))
}

/**
 * Pick a fast/cheap model id for one-shot, latency-sensitive generation (e.g. the
 * design-mode "Generate with AI" placeholder). Returns `undefined` when none
 * match (caller falls back to the engine default).
 */
export function pickFastModel(models: CopilotModel[]): string | undefined {
  return models.find(isFastModel)?.id
}
