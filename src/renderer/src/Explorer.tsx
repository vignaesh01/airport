import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ExplorerTree, FileNode } from '../../shared/explorer'
import { fileIconFor } from './file-icon'

interface ExplorerProps {
  folder: string | null
  onOpenFile: (relPath: string) => void
  activeFile: string | null
  /** Bump this to silently refresh the tree/git-marks without collapsing folders. */
  reloadToken?: number
}

function fileName(relPath: string): string {
  return relPath.split('/').pop() ?? relPath
}

export function Explorer({ folder, onOpenFile, activeFile, reloadToken }: ExplorerProps) {
  const [tree, setTree] = useState<ExplorerTree | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const loadedFolderRef = useRef<string | null>(null)

  const load = (dir: string): void => {
    setLoading(true)
    window.airport
      .explorerTree(dir)
      .then((result) => setTree(result))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!folder) {
      setTree(null)
      setExpanded(new Set())
      loadedFolderRef.current = null
      return
    }
    if (loadedFolderRef.current !== folder) {
      setExpanded(new Set())
      loadedFolderRef.current = folder
    }
    load(folder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, reloadToken])

  const toggleDir = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const rows: ReactElement[] = []
  if (tree) {
    if (tree.recent.length > 0) {
      rows.push(
        <div className="recent-group" key="__recent__">
          <div className="recent-label">Recently changed</div>
          {tree.recent.map((relPath) => (
            <FileRow
              key={`recent-${relPath}`}
              name={fileName(relPath)}
              path={relPath}
              type="file"
              indent={0}
              mark={tree.marks[relPath] ?? null}
              isActive={relPath === activeFile}
              onOpen={() => onOpenFile(relPath)}
            />
          ))}
        </div>
      )
    }
    renderNodes(tree.nodes, 1, rows, expanded, toggleDir, tree.marks, activeFile, onOpenFile)
  }

  return (
    <div className="explorer">
      <div className="exp-head">
        <span>Explorer</span>
        <span
          className="refresh"
          title="Refresh"
          role="button"
          tabIndex={0}
          onClick={() => folder && load(folder)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && folder) load(folder)
          }}
        >
          {loading ? '…' : '⟳'}
        </span>
      </div>
      <div className="exp-body">
        {!folder && <div className="exp-empty">No session selected</div>}
        {folder && !tree && <div className="exp-empty">Loading…</div>}
        {folder && tree && tree.nodes.length === 0 && tree.recent.length === 0 && (
          <div className="exp-empty">Empty folder</div>
        )}
        {rows}
      </div>
      <div className="exp-foot">
        {!tree
          ? ''
          : !tree.isRepo
            ? 'no git repo'
            : `${tree.changedCount} changed`}
      </div>
    </div>
  )
}

function renderNodes(
  nodes: FileNode[],
  indent: number,
  out: ReactElement[],
  expanded: Set<string>,
  toggleDir: (path: string) => void,
  marks: Record<string, string>,
  activeFile: string | null,
  onOpenFile: (relPath: string) => void
): void {
  for (const node of nodes) {
    if (node.type === 'dir') {
      const open = expanded.has(node.path)
      out.push(
        <div
          className="tree-row dir"
          key={node.path}
          style={{ paddingLeft: 8 + indent * 14 }}
          role="button"
          tabIndex={0}
          onClick={() => toggleDir(node.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleDir(node.path)
          }}
        >
          <span className="twist">{open ? '▾' : '▸'}</span>
          <span className="icon folder-icon">{open ? '📂' : '📁'}</span>
          <span className="name">{node.name}</span>
          <span className="gitmark Q" />
        </div>
      )
      if (open && node.children) {
        renderNodes(node.children, indent + 1, out, expanded, toggleDir, marks, activeFile, onOpenFile)
      }
    } else {
      const mark = marks[node.path] ?? null
      out.push(
        <FileRow
          key={node.path}
          name={node.name}
          path={node.path}
          type="file"
          indent={indent}
          mark={mark}
          isActive={node.path === activeFile}
          onOpen={() => onOpenFile(node.path)}
        />
      )
    }
  }
}

interface FileRowProps {
  name: string
  path: string
  type: 'file'
  indent: number
  mark: string | null
  isActive: boolean
  onOpen: () => void
}

function FileRow({ name, indent, mark, isActive, onOpen }: FileRowProps): ReactElement {
  const icon = fileIconFor(name)
  return (
    <div
      className={`tree-row file${isActive ? ' active' : ''}`}
      style={{ paddingLeft: 8 + indent * 14 }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
    >
      <span className="twist" />
      <span className="icon" style={{ color: `var(${icon.colorVar})` }}>
        {icon.glyph}
      </span>
      <span className="name">{name}</span>
      {mark ? <span className={`gitmark ${mark}`}>{mark === 'A' ? '+' : mark}</span> : <span className="gitmark Q" />}
    </div>
  )
}
