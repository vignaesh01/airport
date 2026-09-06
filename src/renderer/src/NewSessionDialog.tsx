import { useState } from 'react'
import { AGENTS } from '../../shared/agents'

interface NewSessionDialogProps {
  onCancel: () => void
  onCreate: (folder: string, agentId: string) => void
}

export function NewSessionDialog({ onCancel, onCreate }: NewSessionDialogProps) {
  const [folder, setFolder] = useState('')
  const [agentId, setAgentId] = useState(AGENTS[0].id)

  const browse = async (): Promise<void> => {
    const picked = await window.airport.browseFolder()
    if (picked) setFolder(picked)
  }

  const start = (): void => {
    if (!folder) return
    onCreate(folder, agentId)
  }

  return (
    <div
      className="picker-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="picker">
        <h3>New session</h3>
        <div className="sub">Pick a folder and an agent.</div>
        <div className="field">
          <label>Folder</label>
          <div className="folder-row">
            <input type="text" value={folder} placeholder="No folder chosen" readOnly />
            <button type="button" onClick={browse}>
              Browse…
            </button>
          </div>
        </div>
        <div className="field">
          <label>Agent</label>
          <div className="agentgrid">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`agentopt${a.id === agentId ? ' sel' : ''}`}
                onClick={() => setAgentId(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="picker-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={start} disabled={!folder}>
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
