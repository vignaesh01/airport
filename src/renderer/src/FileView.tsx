import { useEffect, useState } from 'react'
import { parseUnifiedDiff, diffStat, toPlainRows, type DiffRow } from './parse-diff'
import { isImagePath, isBinaryPath } from '../../shared/binary-files'

interface FileViewProps {
  folder: string
  relPath: string
  /** Called after a successful save, so the Explorer can refresh git-status marks. */
  onSaved?: () => void
}

export function FileView({ folder, relPath, onSaved }: FileViewProps) {
  if (isImagePath(relPath)) return <ImagePreview folder={folder} relPath={relPath} />
  if (isBinaryPath(relPath)) {
    return (
      <div className="diffwrap">
        <div className="diff-file">{relPath} — binary file, preview not available</div>
      </div>
    )
  }
  return <TextFileView folder={folder} relPath={relPath} onSaved={onSaved} />
}

function ImagePreview({ folder, relPath }: FileViewProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    window.airport.explorerReadImage(folder, relPath).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [folder, relPath])

  return (
    <div className="diffwrap">
      <div className="diff-file">{relPath}</div>
      {src ? (
        <img src={src} alt={relPath} style={{ maxWidth: '100%', borderRadius: 8 }} />
      ) : (
        <div>Loading…</div>
      )}
    </div>
  )
}

function TextFileView({ folder, relPath, onSaved }: FileViewProps) {
  const [rows, setRows] = useState<DiffRow[] | null>(null)
  const [isDiff, setIsDiff] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [original, setOriginal] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadView = (): void => {
    setRows(null)
    window.airport.explorerDiff(folder, relPath).then(async (diffText) => {
      const diffRows = parseUnifiedDiff(diffText)
      if (diffRows.length > 0) {
        setIsDiff(true)
        setRows(diffRows)
        return
      }
      const content = await window.airport.explorerReadFile(folder, relPath)
      setIsDiff(false)
      setRows(toPlainRows(content))
    })
  }

  useEffect(() => {
    setMode('view')
    setOriginal(null)
    setError(null)
    loadView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, relPath])

  const startEdit = async (): Promise<void> => {
    setError(null)
    let content = original
    if (content === null) {
      content = await window.airport.explorerReadFile(folder, relPath)
      setOriginal(content)
    }
    setDraft(content)
    setMode('edit')
  }

  const cancelEdit = (): void => {
    if (draft !== original && !window.confirm('Discard unsaved changes?')) return
    setMode('view')
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      await window.airport.explorerWriteFile(folder, relPath, draft)
      setOriginal(draft)
      setMode('view')
      onSaved?.()
      loadView()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'edit') {
    return (
      <div className="diffwrap">
        <div className="diff-file">
          {relPath}
          <div className="edit-actions">
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
        {error && <div className="edit-error">{error}</div>}
        <textarea
          className="file-editor"
          value={draft}
          spellCheck={false}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
              e.preventDefault()
              save()
            }
          }}
        />
      </div>
    )
  }

  if (rows === null) {
    return <div className="diffwrap">Loading…</div>
  }

  const { added, deleted } = isDiff ? diffStat(rows) : { added: 0, deleted: 0 }

  return (
    <div className="diffwrap">
      <div className="diff-file">
        {relPath}
        {isDiff && (
          <>
            {' '}
            <span className="diff-stat-add">+{added}</span> <span className="diff-stat-del">-{deleted}</span>
          </>
        )}
        <div className="edit-actions">
          <button type="button" className="btn" onClick={startEdit}>
            Edit
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="diff-file">— empty file</div>
      ) : (
        <table className="diff">
          <tbody>
            {rows.map((row, i) => (
              <tr className={row.type} key={i}>
                <td className="ln">{row.newLine ?? row.oldLine ?? ''}</td>
                <td className="code">{row.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
