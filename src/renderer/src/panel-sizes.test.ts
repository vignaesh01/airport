import { describe, it, expect } from 'vitest'
import { clampWidth, loadWidth, saveWidth } from './panel-sizes'

function memoryStore(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    }
  }
}

describe('clampWidth', () => {
  it('leaves values inside the range untouched', () => {
    expect(clampWidth(300, 200, 480)).toBe(300)
  })

  it('clamps below the minimum', () => {
    expect(clampWidth(50, 200, 480)).toBe(200)
  })

  it('clamps above the maximum', () => {
    expect(clampWidth(1000, 200, 480)).toBe(480)
  })
})

describe('loadWidth / saveWidth', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(loadWidth('missing-key', 280, 200, 480, memoryStore())).toBe(280)
  })

  it('returns the fallback when no store is available', () => {
    expect(loadWidth('rail', 280, 200, 480, undefined)).toBe(280)
  })

  it('round-trips a saved value', () => {
    const store = memoryStore()
    saveWidth('rail', 340, store)
    expect(loadWidth('rail', 280, 200, 480, store)).toBe(340)
  })

  it('clamps a stored value that is now out of range', () => {
    const store = memoryStore()
    saveWidth('rail', 900, store)
    expect(loadWidth('rail', 280, 200, 480, store)).toBe(480)
  })

  it('falls back on unparseable stored data', () => {
    const store = memoryStore()
    store.setItem('rail', 'not-a-number')
    expect(loadWidth('rail', 280, 200, 480, store)).toBe(280)
  })
})
