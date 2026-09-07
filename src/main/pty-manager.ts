import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { PTY_CHANNELS, type CreateSessionOptions } from '../shared/ipc'

export function resolveShell(
  platform: NodeJS.Platform,
  env: Partial<NodeJS.ProcessEnv>
): string {
  if (platform === 'win32') {
    return env.COMSPEC || 'powershell.exe'
  }
  return env.SHELL || '/bin/bash'
}

/**
 * node-pty's Windows backend spawns via CreateProcess, which can't resolve
 * PATH shims like the `.cmd`/`.ps1` launchers npm installs for CLI tools
 * (e.g. `claude`, `codex`) — it fails with "File not found" for anything
 * that isn't a literal .exe. Routing the command through the platform shell
 * lets the shell's own command resolution (which does handle PATHEXT) find
 * it. POSIX shells don't have this problem since node-pty's spawn resolves
 * commands via `execvp` there, so `command` is left as the process directly.
 */
export function resolveSpawnTarget(
  platform: NodeJS.Platform,
  env: Partial<NodeJS.ProcessEnv>,
  command: string | undefined
): { file: string; args: string[] } {
  const shell = resolveShell(platform, env)
  if (!command) return { file: shell, args: [] }
  if (platform !== 'win32') return { file: command, args: [] }
  return /powershell(\.exe)?$/i.test(shell)
    ? { file: shell, args: ['-NoExit', '-Command', command] }
    : { file: shell, args: ['/k', command] }
}

const sessions = new Map<string, pty.IPty>()

export function registerPtyHandlers(): void {
  ipcMain.handle(PTY_CHANNELS.create, (event, options: CreateSessionOptions) => {
    const sessionId = randomUUID()
    const { file, args } = resolveSpawnTarget(process.platform, process.env, options.shellPath)
    const window = BrowserWindow.fromWebContents(event.sender)

    const ptyProcess = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd || homedir(),
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((chunk) => {
      if (!window || window.isDestroyed()) return
      window.webContents.send(PTY_CHANNELS.data, sessionId, chunk)
    })

    ptyProcess.onExit(({ exitCode }) => {
      sessions.delete(sessionId)
      if (!window || window.isDestroyed()) return
      window.webContents.send(PTY_CHANNELS.exit, sessionId, exitCode)
    })

    sessions.set(sessionId, ptyProcess)
    return { sessionId }
  })

  ipcMain.on(PTY_CHANNELS.write, (_event, sessionId: string, data: string) => {
    sessions.get(sessionId)?.write(data)
  })

  ipcMain.on(PTY_CHANNELS.resize, (_event, sessionId: string, cols: number, rows: number) => {
    sessions.get(sessionId)?.resize(cols, rows)
  })

  ipcMain.on(PTY_CHANNELS.dispose, (_event, sessionId: string) => {
    sessions.get(sessionId)?.kill()
    sessions.delete(sessionId)
  })
}

export function disposeAllSessions(): void {
  for (const ptyProcess of sessions.values()) {
    ptyProcess.kill()
  }
  sessions.clear()
}
