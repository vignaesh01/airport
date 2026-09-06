import { useEffect, useState } from 'react'
import type { SessionRecord } from '../../shared/session'
import { AGENTS } from '../../shared/agents'
import { formatElapsed } from './format-elapsed'

interface SessionTabProps {
  session: SessionRecord
  branch: string | null
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

export function SessionTab({ session, branch, isActive, onSelect, onClose }: SessionTabProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const agent = AGENTS.find((a) => a.id === session.agentId)
  const folderName = session.folder.split(/[\\/]/).filter(Boolean).pop() ?? session.folder

  return (
    <div
      className={`tab${isActive ? ' active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      role="button"
      tabIndex={0}
    >
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
          <span className="tab-branch">{branch ? `⑂ ${branch}` : '—'}</span>
        </div>
        <div className="tab-sess">
          <span>{session.name}</span>
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
