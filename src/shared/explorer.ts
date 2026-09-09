export type GitMark = 'M' | 'A' | 'D'

export interface FileNode {
  /** File or directory name, not the full path. */
  name: string
  /** Path relative to the session's workspace folder, forward-slash separated. */
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

export interface ExplorerTree {
  nodes: FileNode[]
  /** Git status letter keyed by relative path, for files with pending changes. */
  marks: Record<string, GitMark>
  /** Relative paths of changed files, most-recently-modified first. */
  recent: string[]
  isRepo: boolean
  changedCount: number
}
