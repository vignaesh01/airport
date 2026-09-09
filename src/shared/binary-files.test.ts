import { describe, it, expect } from 'vitest'
import { imageMimeType, isImagePath, isBinaryPath } from './binary-files'

describe('imageMimeType / isImagePath', () => {
  it('recognizes common image extensions case-insensitively', () => {
    expect(imageMimeType('logo.PNG')).toBe('image/png')
    expect(imageMimeType('photo.jpg')).toBe('image/jpeg')
    expect(imageMimeType('icon.svg')).toBe('image/svg+xml')
    expect(isImagePath('src/assets/pic.webp')).toBe(true)
  })

  it('returns null/false for non-image files', () => {
    expect(imageMimeType('main.ts')).toBeNull()
    expect(isImagePath('README.md')).toBe(false)
  })
})

describe('isBinaryPath', () => {
  it('treats images as binary', () => {
    expect(isBinaryPath('screenshot.png')).toBe(true)
  })

  it('treats archives, fonts and executables as binary', () => {
    expect(isBinaryPath('bundle.zip')).toBe(true)
    expect(isBinaryPath('font.woff2')).toBe(true)
    expect(isBinaryPath('app.exe')).toBe(true)
  })

  it('treats text/source files as non-binary', () => {
    expect(isBinaryPath('src/index.ts')).toBe(false)
    expect(isBinaryPath('package.json')).toBe(false)
    expect(isBinaryPath('no-extension')).toBe(false)
  })
})
