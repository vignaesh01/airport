type Store = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): Store | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function loadNotificationsEnabled(key: string, store: Store | undefined = defaultStore()): boolean {
  try {
    const raw = store?.getItem(key) ?? null
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

export function saveNotificationsEnabled(
  key: string,
  value: boolean,
  store: Store | undefined = defaultStore()
): void {
  try {
    store?.setItem(key, String(value))
  } catch {
    // storage unavailable (e.g. disabled site data) — setting just won't persist.
  }
}
