import { describe, it, expect } from 'vitest'
import { fileIconFor } from './file-icon'

describe('fileIconFor', () => {
  it('recognizes common source extensions', () => {
    expect(fileIconFor('main.ts')).toEqual({ glyph: 'TS', colorVar: '--accent' })
    expect(fileIconFor('App.tsx')).toEqual({ glyph: 'TS', colorVar: '--accent' })
    expect(fileIconFor('index.js')).toEqual({ glyph: 'JS', colorVar: '--warning' })
    expect(fileIconFor('script.py')).toEqual({ glyph: 'PY', colorVar: '--warning' })
  })

  it('is case-insensitive on extension', () => {
    expect(fileIconFor('README.MD')).toEqual({ glyph: 'M↓', colorVar: '--text-dim' })
  })

  it('treats images distinctly, independent of the extension table', () => {
    expect(fileIconFor('logo.png')).toEqual({ glyph: '◪', colorVar: '--success' })
    expect(fileIconFor('photo.JPG')).toEqual({ glyph: '◪', colorVar: '--success' })
  })

  it('recognizes known lockfiles by exact name regardless of extension', () => {
    expect(fileIconFor('package-lock.json')).toEqual({ glyph: '🔒', colorVar: '--text-faint' })
    expect(fileIconFor('yarn.lock')).toEqual({ glyph: '🔒', colorVar: '--text-faint' })
  })

  it('falls back to a default glyph for unknown or missing extensions', () => {
    expect(fileIconFor('Makefile')).toEqual({ glyph: '•', colorVar: '--text-faint' })
    expect(fileIconFor('data.xyz')).toEqual({ glyph: '•', colorVar: '--text-faint' })
  })
})
