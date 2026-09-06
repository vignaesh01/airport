export type ThemeMode = 'system' | 'light' | 'dark'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

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
