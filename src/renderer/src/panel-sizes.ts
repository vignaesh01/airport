export const RAIL_MIN = 200
export const RAIL_MAX = 480
export const RAIL_DEFAULT = 280

export const EXPLORER_MIN = 220
export const EXPLORER_MAX = 480
export const EXPLORER_DEFAULT = 300

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function loadWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
  store: Store | undefined = defaultStore()
): number {
  try {
    const raw = store?.getItem(key) ?? null
    if (raw === null) return fallback
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return fallback
    return clampWidth(parsed, min, max)
  } catch {
    return fallback
  }
}

export function saveWidth(key: string, value: number, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(key, String(value))
  } catch {
    // storage unavailable (e.g. disabled site data) — width just won't persist.
  }
}
