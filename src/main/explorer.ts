import { promises as fs } from 'node:fs'
import path from 'node:path'
import simpleGit from 'simple-git'
import type { ExplorerTree, FileNode, GitMark } from '../shared/explorer'
import { imageMimeType, isBinaryPath } from '../shared/binary-files'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'out',
  'dist',
  'build',
  'coverage',
  '.next',
  '.vite',
  '.turbo'
])

const MAX_RECENT = 8

async function readDir(root: string, rel: string): Promise<FileNode[]> {
  const abs = path.join(root, rel)
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(abs, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes = await Promise.all(
    entries
      .filter((e) => !(e.isDirectory() && IGNORED_DIRS.has(e.name)))
      .map(async (e): Promise<FileNode> => {
        const relPath = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) {
          return { name: e.name, path: relPath, type: 'dir', children: await readDir(root, relPath) }
        }
        return { name: e.name, path: relPath, type: 'file' }
      })
  )

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

function statusToMark(code: string): GitMark | null {
  if (code === ' ') return null
  if (code === '?' || code === 'A') return 'A'
  if (code === 'D') return 'D'
  if (code === 'M' || code === 'R' || code === 'C') return 'M'
  return null
}

async function readGitMarks(
  root: string
): Promise<{ marks: Record<string, GitMark>; isRepo: boolean }> {
  try {
    const git = simpleGit(root)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return { marks: {}, isRepo: false }

    const status = await git.status()
    const marks: Record<string, GitMark> = {}
    for (const file of status.files) {
      const mark = statusToMark(file.working_dir) ?? statusToMark(file.index)
      if (mark) marks[file.path.replace(/\\/g, '/')] = mark
    }
    return { marks, isRepo: true }
  } catch {
    return { marks: {}, isRepo: false }
  }
}

async function readRecent(root: string, paths: string[]): Promise<string[]> {
  const withTimes = await Promise.all(
    paths.map(async (p) => {
      try {
        const st = await fs.stat(path.join(root, p))
        return { p, mtime: st.mtimeMs }
      } catch {
        return { p, mtime: 0 }
      }
    })
  )
  withTimes.sort((a, b) => b.mtime - a.mtime)
  return withTimes.slice(0, MAX_RECENT).map((x) => x.p)
}

export async function readExplorerTree(root: string): Promise<ExplorerTree> {
  const [nodes, { marks, isRepo }] = await Promise.all([readDir(root, ''), readGitMarks(root)])
  const changedPaths = Object.keys(marks)
  const recent = await readRecent(root, changedPaths)
  return { nodes, marks, recent, isRepo, changedCount: changedPaths.length }
}

export async function readFileDiff(root: string, relPath: string): Promise<string> {
  if (isBinaryPath(relPath)) return ''
  try {
    const git = simpleGit(root)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return ''
    const tracked = await git.diff(['--', relPath])
    if (tracked.trim().length > 0) return tracked
    // Untracked file: diff against /dev/null so new files still render as an addition.
    return await git.diff(['--no-index', '--', '/dev/null', relPath]).catch(() => '')
  } catch {
    return ''
  }
}

export async function readFileContent(root: string, relPath: string): Promise<string> {
  // Never decode a binary file as UTF-8 text — on an image or archive this can
  // produce a multi-megabyte garbled string that hangs the renderer trying to
  // lay it out. Callers should route binary paths through readImageDataUrl
  // (images) or skip content entirely (other binary types); this is a backstop.
  if (isBinaryPath(relPath)) return ''
  try {
    return await fs.readFile(path.join(root, relPath), 'utf8')
  } catch {
    return ''
  }
}

export async function writeFileContent(root: string, relPath: string, content: string): Promise<void> {
  if (isBinaryPath(relPath)) {
    throw new Error(`Refusing to write binary path as text: ${relPath}`)
  }
  await fs.writeFile(path.join(root, relPath), content, 'utf8')
}

export async function readImageDataUrl(root: string, relPath: string): Promise<string> {
  const mime = imageMimeType(relPath)
  if (!mime) return ''
  try {
    const buffer = await fs.readFile(path.join(root, relPath))
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}
