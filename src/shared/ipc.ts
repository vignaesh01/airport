import type { SessionsFile } from './session'

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

export interface CreateSessionOptions {
  /** Working directory for the shell. Defaults to the user's home directory when omitted. */
  cwd?: string
  /** Override the shell/agent command to launch. Defaults to the platform shell. */
  shellPath?: string
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
}
