import type { SessionsFile } from './session'
import type { ExplorerTree } from './explorer'
import type { ShellOption } from './shell'

export const PTY_CHANNELS = {
  create: 'pty:create',
  write: 'pty:write',
  resize: 'pty:resize',
  dispose: 'pty:dispose',
  data: 'pty:data',
  exit: 'pty:exit'
} as const

export const SESSION_CHANNELS = {
  load: 'sessions:load',
  save: 'sessions:save',
  browseFolder: 'dialog:browse-folder',
  gitBranch: 'git:branch'
} as const

export const EXPLORER_CHANNELS = {
  tree: 'explorer:tree',
  diff: 'explorer:diff',
  readFile: 'explorer:read-file',
  readImage: 'explorer:read-image',
  writeFile: 'explorer:write-file'
} as const

export const SHELL_CHANNELS = {
  list: 'shell:list'
} as const

export const NOTIFICATION_CHANNELS = {
  show: 'notify:show',
  clicked: 'notify:clicked'
} as const

export interface NotifyOptions {
  sessionId: string
  title: string
  body: string
}

export interface CreateSessionOptions {
  /** Working directory for the shell. Defaults to the user's home directory when omitted. */
  cwd?: string
  /** Override the shell/agent command to launch. Defaults to the platform shell. */
  shellPath?: string
  /**
   * Spawn this shell executable directly instead of routing a command through the
   * default platform shell — used when the user picked a specific shell (cmd,
   * PowerShell, bash, ...) rather than an agent CLI.
   */
  shell?: string
  cols: number
  rows: number
}

export interface CreateSessionResult {
  sessionId: string
}

export interface AirportApi {
  createSession(options: CreateSessionOptions): Promise<CreateSessionResult>
  write(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void
  dispose(sessionId: string): void
  onData(sessionId: string, callback: (chunk: string) => void): () => void
  onExit(sessionId: string, callback: (exitCode: number) => void): () => void
  loadSessions(): Promise<SessionsFile>
  saveSessions(file: SessionsFile): void
  browseFolder(): Promise<string | null>
  gitBranch(folder: string): Promise<string | null>
  explorerTree(folder: string): Promise<ExplorerTree>
  explorerDiff(folder: string, relPath: string): Promise<string>
  explorerReadFile(folder: string, relPath: string): Promise<string>
  explorerReadImage(folder: string, relPath: string): Promise<string>
  explorerWriteFile(folder: string, relPath: string, content: string): Promise<void>
  listShells(): Promise<ShellOption[]>
  readClipboardText(): Promise<string>
  notify(options: NotifyOptions): void
  onNotificationClick(callback: (sessionId: string) => void): () => void
}
