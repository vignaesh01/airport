export type ThemeMode = 'system' | 'light' | 'dark'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function nextTheme(current: ThemeMode): ThemeMode {
  const idx = ORDER.indexOf(current)
  return ORDER[(idx + 1) % ORDER.length]
}

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }
}

export function loadTheme(key: string, store: Store | undefined = defaultStore()): ThemeMode {
  try {
    const raw = store?.getItem(key) ?? null
    return raw !== null && (ORDER as string[]).includes(raw) ? (raw as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

export function saveTheme(key: string, mode: ThemeMode, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(key, mode)
  } catch {
    // storage unavailable (e.g. disabled site data) — theme just won't persist.
  }
}
