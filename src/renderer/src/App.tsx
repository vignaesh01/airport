import { useEffect, useState } from 'react'
import { Terminal } from './Terminal'
import { SessionRail } from './SessionRail'
import { NewSessionDialog } from './NewSessionDialog'
import { applyTheme, nextTheme, type ThemeMode } from './theme'
import { AGENTS } from '../../shared/agents'
import type { SessionRecord, SessionsFile } from '../../shared/session'
import './theme.css'

function makeSession(folder: string, agentId: string): SessionRecord {
  const id = crypto.randomUUID()
  return { id, folder, agentId, name: `${agentId}-${id.slice(0, 4)}`, createdAt: Date.now() }
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [branches, setBranches] = useState<Record<string, string | null>>({})
  const [pendingResume, setPendingResume] = useState<SessionsFile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)

  // Load persisted state once. If it holds sessions, offer to resume rather
  // than auto-launching anything — `sessions`/`activeId` stay empty until
  // the user decides.
  useEffect(() => {
    window.airport.loadSessions().then((file) => {
      if (file.sessions.length > 0) {
        setPendingResume(file)
      }
      setLoaded(true)
    })
  }, [])

  // Persist on every session-list change, but only once initial load has
  // resolved (`loaded`) — a save before that would silently overwrite the
  // real file with an empty one — and never while a resume decision is
  // still pending (`pendingResume`) — a save then would erase the very
  // sessions being offered before the user has chosen). Including `loaded`
  // in the dependency array also closes a race: if the user acts fast
  // enough to create a session before `loadSessions()` resolves, that
  // create is skipped by the `pendingResume` check's sibling guard below
  // but IS captured once `loaded` flips true and this effect re-runs.
  useEffect(() => {
    if (!loaded) return
    if (pendingResume) return
    window.airport.saveSessions({ version: 1, activeId, sessions })
  }, [loaded, pendingResume, sessions, activeId])

  // Fetch each session's git branch once, the first time it's seen.
  useEffect(() => {
    sessions.forEach((s) => {
      if (s.id in branches) return
      window.airport.gitBranch(s.folder).then((branch) => {
        setBranches((prev) => ({ ...prev, [s.id]: branch }))
      })
    })
  }, [sessions, branches])

  const cycleTheme = (): void => {
    const mode = nextTheme(theme)
    setTheme(mode)
    applyTheme(mode)
  }

  const handleResume = (): void => {
    if (!pendingResume) return
    setSessions(pendingResume.sessions)
    setActiveId(pendingResume.activeId ?? pendingResume.sessions[0]?.id ?? null)
    setPendingResume(null)
  }

  const handleDiscardResume = (): void => {
    setPendingResume(null)
  }

  const handleCreate = (folder: string, agentId: string): void => {
    const session = makeSession(folder, agentId)
    setSessions((prev) => [...prev, session])
    setActiveId(session.id)
    setShowNewSession(false)
  }

  const handleClose = (id: string): void => {
    const next = sessions.filter((s) => s.id !== id)
    setSessions(next)
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null)
    }
    setBranches((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const label = theme === 'system' ? '🌗 System' : theme === 'light' ? '☀️ Light' : '🌙 Dark'

  return (
    <div className="app">
      <div className="titlebar">
        <span className="brand">▲ Airport</span>
        <div className="spacer" />
        <button className="themebtn" onClick={cycleTheme} type="button">
          {label}
        </button>
      </div>
      <div className="main">
        <SessionRail
          sessions={sessions}
          branches={branches}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={handleClose}
          onNewSession={() => setShowNewSession(true)}
          resumeCount={pendingResume?.sessions.length ?? 0}
          onResume={handleResume}
          onDiscardResume={handleDiscardResume}
        />
        <div className="center terminal-stack">
          {sessions.map((s) => {
            const agent = AGENTS.find((a) => a.id === s.agentId)
            return (
              <div
                key={s.id}
                className="terminal-slot"
                style={{
                  visibility: s.id === activeId ? 'visible' : 'hidden',
                  pointerEvents: s.id === activeId ? 'auto' : 'none'
                }}
              >
                <Terminal folder={s.folder} command={agent?.command} />
              </div>
            )
          })}
          {sessions.length === 0 && (
            <div className="empty-center">No session open — start one from the rail.</div>
          )}
        </div>
        <div className="explorer">Explorer (next plan)</div>
      </div>
      {showNewSession && <NewSessionDialog onCancel={() => setShowNewSession(false)} onCreate={handleCreate} />}
    </div>
  )
}

export default App
