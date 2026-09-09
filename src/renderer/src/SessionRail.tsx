import type { SessionRecord } from '../../shared/session'
import type { SessionStatus } from './status-engine'
import { SessionTab } from './SessionTab'

interface SessionRailProps {
  sessions: SessionRecord[]
  branches: Record<string, string | null>
  statuses: Record<string, SessionStatus>
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onNewSession: () => void
  resumeCount: number
  onResume: () => void
  onDiscardResume: () => void
}

export function SessionRail({
  sessions,
  branches,
  statuses,
  activeId,
  onSelect,
  onClose,
  onRename,
  onNewSession,
  resumeCount,
  onResume,
  onDiscardResume
}: SessionRailProps) {
  return (
    <div className="rail">
      <div className="rail-head">
        <span>Sessions</span>
        <span>{sessions.length}</span>
      </div>
      {resumeCount > 0 && (
        <div className="resume-banner">
          <span>
            Resume {resumeCount} session{resumeCount === 1 ? '' : 's'}?
          </span>
          <div className="resume-actions">
            <button type="button" onClick={onResume}>
              Resume
            </button>
            <button type="button" onClick={onDiscardResume}>
              Start fresh
            </button>
          </div>
        </div>
      )}
      <div className="rail-list">
        {sessions.map((s) => (
          <SessionTab
            key={s.id}
            session={s}
            branch={branches[s.id] ?? null}
            status={statuses[s.id] ?? 'yellow'}
            isActive={s.id === activeId}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
            onRename={(name) => onRename(s.id, name)}
          />
        ))}
      </div>
      <div className="rail-foot">
        <button type="button" className="new-session" onClick={onNewSession}>
          ＋ New session
        </button>
      </div>
    </div>
  )
}
