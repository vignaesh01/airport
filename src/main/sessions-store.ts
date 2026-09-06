import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMPTY_SESSIONS_FILE, type SessionsFile } from '../shared/session'

export function parseSessionsFile(raw: string): SessionsFile {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).version === 1 &&
      Array.isArray((parsed as Record<string, unknown>).sessions)
    ) {
      const obj = parsed as Record<string, unknown>
      return {
        version: 1,
        activeId: typeof obj.activeId === 'string' ? obj.activeId : null,
        sessions: obj.sessions as SessionsFile['sessions']
      }
    }
  } catch {
    // fall through to default
  }
  return EMPTY_SESSIONS_FILE
}

function sessionsFilePath(): string {
  return join(app.getPath('userData'), 'sessions.json')
}

export function loadSessionsFile(): SessionsFile {
  try {
    const raw = readFileSync(sessionsFilePath(), 'utf-8')
    return parseSessionsFile(raw)
  } catch {
    return EMPTY_SESSIONS_FILE
  }
}

export function saveSessionsFile(file: SessionsFile): void {
  writeFileSync(sessionsFilePath(), JSON.stringify(file, null, 2), 'utf-8')
}
