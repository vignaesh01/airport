import { describe, it, expect } from 'vitest'
import { resolveShell, resolveSpawnTarget } from './pty-manager'

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

describe('resolveSpawnTarget', () => {
  it('spawns the plain shell with no args when no command is given', () => {
    expect(resolveSpawnTarget('win32', { COMSPEC: 'cmd.exe' }, undefined)).toEqual({
      file: 'cmd.exe',
      args: []
    })
  })

  it('routes a command through cmd.exe on win32', () => {
    expect(resolveSpawnTarget('win32', { COMSPEC: 'cmd.exe' }, 'claude')).toEqual({
      file: 'cmd.exe',
      args: ['/k', 'claude']
    })
  })

  it('routes a command through powershell.exe with -Command on win32', () => {
    expect(resolveSpawnTarget('win32', {}, 'claude')).toEqual({
      file: 'powershell.exe',
      args: ['-NoExit', '-Command', 'claude']
    })
  })

  it('spawns the command directly on posix, unwrapped', () => {
    expect(resolveSpawnTarget('linux', { SHELL: '/bin/bash' }, 'claude')).toEqual({
      file: 'claude',
      args: []
    })
  })
})
