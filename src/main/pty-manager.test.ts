import { describe, it, expect } from 'vitest'
import { resolveShell } from './pty-manager'

describe('resolveShell', () => {
  it('uses COMSPEC on win32 when set', () => {
    expect(resolveShell('win32', { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' })).toBe(
      'C:\\Windows\\System32\\cmd.exe'
    )
  })

  it('falls back to powershell.exe on win32 when COMSPEC is unset', () => {
    expect(resolveShell('win32', {})).toBe('powershell.exe')
  })

  it('uses SHELL on posix when set', () => {
    expect(resolveShell('darwin', { SHELL: '/bin/zsh' })).toBe('/bin/zsh')
  })

  it('falls back to /bin/bash on posix when SHELL is unset', () => {
    expect(resolveShell('linux', {})).toBe('/bin/bash')
  })
})
