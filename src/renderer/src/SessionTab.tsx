import { useEffect, useRef, useState } from 'react'
import type { SessionRecord } from '../../shared/session'
import type { SessionStatus } from './status-engine'
import { AGENTS } from '../../shared/agents'
import { formatElapsed } from './format-elapsed'

const STATUS_GLYPH: Record<SessionStatus, string> = { red: '▲', yellow: '◐', green: '✓', grey: '○' }
const STATUS_WORD: Record<SessionStatus, string> = {
  red: 'needs you',
  yellow: 'working',
  green: 'done',
  grey: 'exited'
}

interface SessionTabProps {
  session: SessionRecord
  branch: string | null
  status: SessionStatus
  isActive: boolean
  onSelect: () => void
  onClose: () => void
  onRename: (name: string) => void
}

export function SessionTab({ session, branch, status, isActive, onSelect, onClose, onRename }: SessionTabProps) {
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const startRename = (): void => {
    setDraft(session.name)
    setEditing(true)
  }

  const commitRename = (): void => {
    setEditing(false)
    onRename(draft)
  }

  const agent = AGENTS.find((a) => a.id === session.agentId)
  const folderName = session.folder.split(/[\\/]/).filter(Boolean).pop() ?? session.folder
  const shellName = session.shellCommand?.split(/[\\/]/).pop()?.replace(/\.exe$/i, '')

  return (
    <div
      className={`tab status-${status}${isActive ? ' active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="tab-glyph" title={STATUS_WORD[status]}>
        <span className={status === 'yellow' ? 'spin' : undefined}>{STATUS_GLYPH[status]}</span>
      </div>
      <div className="tab-body">
        <div className="tab-folder">{folderName}</div>
        <div className="tab-meta">
          <span
            className="agent-chip"
            style={{
              background: `var(${agent?.chipVar ?? '--agent-shell'})`,
              color: `var(${agent?.inkVar ?? '--agent-shell-ink'})`
            }}
          >
            {agent?.label ?? session.agentId}
          </span>
          {shellName && <span className="tab-branch">{shellName}</span>}
          <span className="tab-branch">{branch ? `⑂ ${branch}` : '—'}</span>
        </div>
        <div className="tab-sess">
          {editing ? (
            <input
              ref={inputRef}
              className="tab-name-input"
              value={draft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commitRename()
                else if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span
              className="tab-name"
              title="Double-click to rename"
              onDoubleClick={(e) => {
                e.stopPropagation()
                startRename()
              }}
            >
              {session.name}
            </span>
          )}
          <span className="tab-time">{formatElapsed(now - session.createdAt)}</span>
        </div>
      </div>
      <button
        type="button"
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label={`Close ${folderName}`}
      >
        ✕
      </button>
    </div>
  )
}
