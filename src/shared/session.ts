export interface SessionRecord {
  /** Stable tab id, client-generated. Persists across relaunches. */
  id: string
  /** Absolute path to the session's working directory. */
  folder: string
  /** AgentDefinition.id this session was launched with. */
  agentId: string
  /** Display label shown in the rail. */
  name: string
  /** epoch ms, used to compute elapsed time in the rail. */
  createdAt: number
}

export interface SessionsFile {
  version: 1
  activeId: string | null
  sessions: SessionRecord[]
}

export const EMPTY_SESSIONS_FILE: SessionsFile = { version: 1, activeId: null, sessions: [] }
