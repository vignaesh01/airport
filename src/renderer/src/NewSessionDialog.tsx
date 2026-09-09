import { useEffect, useState } from 'react'
import { AGENTS } from '../../shared/agents'
import type { ShellOption } from '../../shared/shell'

interface NewSessionDialogProps {
  onCancel: () => void
  onCreate: (folder: string, agentId: string, shellCommand?: string) => void
}

const SYSTEM_DEFAULT = ''

export function NewSessionDialog({ onCancel, onCreate }: NewSessionDialogProps) {
  const [folder, setFolder] = useState('')
  const [agentId, setAgentId] = useState(AGENTS[0].id)
  const [shells, setShells] = useState<ShellOption[] | null>(null)
  const [shellPath, setShellPath] = useState(SYSTEM_DEFAULT)

  useEffect(() => {
    window.airport.listShells().then(setShells)
  }, [])

  const browse = async (): Promise<void> => {
    const picked = await window.airport.browseFolder()
    if (picked) setFolder(picked)
  }

  const start = (): void => {
    if (!folder) return
    onCreate(folder, agentId, shellPath || undefined)
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
        <div className="sub">Pick a folder, a shell to run it in, and an agent.</div>
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
          <label>Shell</label>
          <select value={shellPath} onChange={(e) => setShellPath(e.target.value)}>
            <option value={SYSTEM_DEFAULT}>System default</option>
            {shells?.map((s) => (
              <option key={s.id} value={s.path}>
                {s.label}
              </option>
            ))}
          </select>
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
