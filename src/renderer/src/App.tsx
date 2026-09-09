import { useEffect, useState } from 'react'
import { Terminal } from './Terminal'
import { SessionRail } from './SessionRail'
import { NewSessionDialog } from './NewSessionDialog'
import { Explorer } from './Explorer'
import { FileView } from './FileView'
import { PanelResizer } from './PanelResizer'
import { fileIconFor } from './file-icon'
import { applyTheme, nextTheme, type ThemeMode } from './theme'
import {
  RAIL_MIN,
  RAIL_MAX,
  RAIL_DEFAULT,
  EXPLORER_MIN,
  EXPLORER_MAX,
  EXPLORER_DEFAULT,
  clampWidth,
  loadWidth,
  saveWidth
} from './panel-sizes'
import {
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  clampFontSize,
  loadFontSize,
  saveFontSize
} from './font-size'
import { AGENTS } from '../../shared/agents'
import type { SessionRecord, SessionsFile } from '../../shared/session'
import type { SessionStatus } from './status-engine'
import './theme.css'

const RAIL_WIDTH_KEY = 'airport.railWidth'
const EXPLORER_WIDTH_KEY = 'airport.explorerWidth'
const FONT_SIZE_KEY = 'airport.terminalFontSize'

function makeSession(folder: string, agentId: string, shellCommand?: string): SessionRecord {
  const id = crypto.randomUUID()
  return { id, folder, agentId, name: `${agentId}-${id.slice(0, 4)}`, createdAt: Date.now(), shellCommand }
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [branches, setBranches] = useState<Record<string, string | null>>({})
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({})
  const [pendingResume, setPendingResume] = useState<SessionsFile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [explorerReloadToken, setExplorerReloadToken] = useState(0)
  const [railWidth, setRailWidth] = useState(() => loadWidth(RAIL_WIDTH_KEY, RAIL_DEFAULT, RAIL_MIN, RAIL_MAX))
  const [explorerWidth, setExplorerWidth] = useState(() =>
    loadWidth(EXPLORER_WIDTH_KEY, EXPLORER_DEFAULT, EXPLORER_MIN, EXPLORER_MAX)
  )
  const [fontSize, setFontSize] = useState(() => loadFontSize(FONT_SIZE_KEY))

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

  useEffect(() => saveWidth(RAIL_WIDTH_KEY, railWidth), [railWidth])
  useEffect(() => saveWidth(EXPLORER_WIDTH_KEY, explorerWidth), [explorerWidth])
  useEffect(() => saveFontSize(FONT_SIZE_KEY, fontSize), [fontSize])

  const handleDragRail = (deltaX: number): void => {
    setRailWidth((w) => clampWidth(w + deltaX, RAIL_MIN, RAIL_MAX))
  }

  const handleDragExplorer = (deltaX: number): void => {
    // The resizer sits left of the explorer, so dragging right shrinks it.
    setExplorerWidth((w) => clampWidth(w - deltaX, EXPLORER_MIN, EXPLORER_MAX))
  }

  const cycleTheme = (): void => {
    const mode = nextTheme(theme)
    setTheme(mode)
    applyTheme(mode)
  }

  const decreaseFontSize = (): void => {
    setFontSize((size) => clampFontSize(size - FONT_SIZE_STEP))
  }

  const increaseFontSize = (): void => {
    setFontSize((size) => clampFontSize(size + FONT_SIZE_STEP))
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

  const handleCreate = (folder: string, agentId: string, shellCommand?: string): void => {
    const session = makeSession(folder, agentId, shellCommand)
    setSessions((prev) => [...prev, session])
    setActiveId(session.id)
    setOpenFiles([])
    setActiveFile(null)
    setShowNewSession(false)
  }

  const handleClose = (id: string): void => {
    const next = sessions.filter((s) => s.id !== id)
    setSessions(next)
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null)
      setOpenFiles([])
      setActiveFile(null)
    }
    setBranches((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    setStatuses((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const handleStatusChange = (id: string, status: SessionStatus): void => {
    setStatuses((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }))
  }

  const handleRenameSession = (id: string, name: string): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    const current = sessions.find((s) => s.id === id)
    if (!current || current.name === trimmed) return
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
  }

  const handleSelectSession = (id: string): void => {
    setActiveId(id)
    setOpenFiles([])
    setActiveFile(null)
  }

  const handleOpenFile = (relPath: string): void => {
    setOpenFiles((prev) => (prev.includes(relPath) ? prev : [...prev, relPath]))
    setActiveFile(relPath)
  }

  const handleCloseFile = (relPath: string): void => {
    setOpenFiles((prev) => {
      const idx = prev.indexOf(relPath)
      const next = prev.filter((p) => p !== relPath)
      if (activeFile === relPath) {
        const fallback = next[idx - 1] ?? next[idx] ?? null
        setActiveFile(fallback)
      }
      return next
    })
  }

  const activeSession = sessions.find((s) => s.id === activeId) ?? null

  const label = theme === 'system' ? '🌗 System' : theme === 'light' ? '☀️ Light' : '🌙 Dark'
  const needsYouCount = sessions.filter((s) => statuses[s.id] === 'red').length

  return (
    <div className="app">
      <div className="titlebar">
        <div className="spacer" />
        {needsYouCount > 0 && (
          <div className="redcount">
            {needsYouCount} {needsYouCount === 1 ? 'needs you' : 'need you'}
          </div>
        )}
        <div className="fontsize-group" role="group" aria-label="Terminal font size">
          <button
            className="fontsizebtn"
            onClick={decreaseFontSize}
            disabled={fontSize <= FONT_SIZE_MIN}
            type="button"
            title="Decrease terminal font size"
            aria-label="Decrease terminal font size"
          >
            A−
          </button>
          <span className="fontsize-value">{fontSize}</span>
          <button
            className="fontsizebtn"
            onClick={increaseFontSize}
            disabled={fontSize >= FONT_SIZE_MAX}
            type="button"
            title="Increase terminal font size"
            aria-label="Increase terminal font size"
          >
            A+
          </button>
        </div>
        <button className="themebtn" onClick={cycleTheme} type="button">
          {label}
        </button>
      </div>
      <div
        className="main"
        style={{ gridTemplateColumns: `${railWidth}px 6px 1fr 6px ${explorerWidth}px` }}
      >
        <SessionRail
          sessions={sessions}
          branches={branches}
          statuses={statuses}
          activeId={activeId}
          onSelect={handleSelectSession}
          onClose={handleClose}
          onRename={handleRenameSession}
          onNewSession={() => setShowNewSession(true)}
          resumeCount={pendingResume?.sessions.length ?? 0}
          onResume={handleResume}
          onDiscardResume={handleDiscardResume}
        />
        <PanelResizer ariaLabel="Resize sessions panel" onDrag={handleDragRail} />
        <div className="center">
          {activeSession && (
            <div className="filetabs">
              <div
                className={`filetab${!activeFile ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setActiveFile(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setActiveFile(null)
                }}
              >
                Terminal
              </div>
              {openFiles.map((path) => {
                const name = path.split('/').pop() ?? path
                const icon = fileIconFor(name)
                return (
                  <div
                    key={path}
                    className={`filetab${activeFile === path ? ' active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveFile(path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setActiveFile(path)
                    }}
                  >
                    <span className="filetab-icon" style={{ color: `var(${icon.colorVar})` }}>
                      {icon.glyph}
                    </span>
                    <span className="filetab-name">{name}</span>
                    <span
                      className="x"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseFile(path)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          handleCloseFile(path)
                        }
                      }}
                    >
                      ✕
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="terminal-stack">
            {sessions.map((s) => {
              const agent = AGENTS.find((a) => a.id === s.agentId)
              const visible = s.id === activeId && !activeFile
              return (
                <div
                  key={s.id}
                  className="terminal-slot"
                  style={{
                    visibility: visible ? 'visible' : 'hidden',
                    pointerEvents: visible ? 'auto' : 'none'
                  }}
                >
                  <Terminal
                    folder={s.folder}
                    command={agent?.command}
                    shell={s.shellCommand}
                    fontSize={fontSize}
                    onTitleChange={(title) => handleRenameSession(s.id, title)}
                    onStatusChange={(status) => handleStatusChange(s.id, status)}
                  />
                </div>
              )
            })}
            {activeSession && activeFile && (
              <div className="terminal-slot diff-slot">
                <FileView
                  folder={activeSession.folder}
                  relPath={activeFile}
                  onSaved={() => setExplorerReloadToken((t) => t + 1)}
                />
              </div>
            )}
            {sessions.length === 0 && (
              <div className="empty-center">No session open — start one from the rail.</div>
            )}
          </div>
        </div>
        <PanelResizer ariaLabel="Resize explorer panel" onDrag={handleDragExplorer} />
        <Explorer
          folder={activeSession?.folder ?? null}
          activeFile={activeFile}
          onOpenFile={handleOpenFile}
          reloadToken={explorerReloadToken}
        />
      </div>
      {showNewSession && <NewSessionDialog onCancel={() => setShowNewSession(false)} onCreate={handleCreate} />}
    </div>
  )
}

export default App
