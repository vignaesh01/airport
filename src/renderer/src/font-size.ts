export const FONT_SIZE_MIN = 9
export const FONT_SIZE_MAX = 24
export const FONT_SIZE_DEFAULT = 13
export const FONT_SIZE_STEP = 1

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function clampFontSize(value: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value))
}

export function loadFontSize(key: string, store: Store | undefined = defaultStore()): number {
  try {
    const raw = store?.getItem(key) ?? null
    if (raw === null) return FONT_SIZE_DEFAULT
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return FONT_SIZE_DEFAULT
    return clampFontSize(parsed)
  } catch {
    return FONT_SIZE_DEFAULT
  }
}

export function saveFontSize(key: string, value: number, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(key, String(value))
  } catch {
    // storage unavailable (e.g. disabled site data) — size just won't persist.
  }
}
