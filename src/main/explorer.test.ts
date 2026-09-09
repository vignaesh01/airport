import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import simpleGit from 'simple-git'
import { readExplorerTree, readFileDiff, readFileContent, readImageDataUrl, writeFileContent } from './explorer'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'airport-explorer-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('readExplorerTree', () => {
  it('reports no repo for a plain folder', async () => {
    await fs.writeFile(path.join(dir, 'notes.txt'), 'hi')
    const tree = await readExplorerTree(dir)
    expect(tree.isRepo).toBe(false)
    expect(tree.nodes).toEqual([{ name: 'notes.txt', path: 'notes.txt', type: 'file' }])
    expect(tree.marks).toEqual({})
  })

  it('nests directories and skips node_modules', async () => {
    await fs.mkdir(path.join(dir, 'src'))
    await fs.writeFile(path.join(dir, 'src', 'main.ts'), '')
    await fs.mkdir(path.join(dir, 'node_modules'))
    await fs.writeFile(path.join(dir, 'node_modules', 'x.js'), '')

    const tree = await readExplorerTree(dir)
    expect(tree.nodes).toEqual([
      { name: 'src', path: 'src', type: 'dir', children: [{ name: 'main.ts', path: 'src/main.ts', type: 'file' }] }
    ])
  })

  it('marks modified and untracked files from git status', async () => {
    const git = simpleGit(dir)
    await git.init()
    await git.addConfig('user.email', 'test@example.com')
    await git.addConfig('user.name', 'Test')
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'v1')
    await git.add('.')
    await git.commit('initial')
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'v2')
    await fs.writeFile(path.join(dir, 'new.txt'), 'new')

    const tree = await readExplorerTree(dir)
    expect(tree.isRepo).toBe(true)
    expect(tree.marks).toEqual({ 'tracked.txt': 'M', 'new.txt': 'A' })
    expect(tree.changedCount).toBe(2)
    expect(tree.recent).toEqual(expect.arrayContaining(['tracked.txt', 'new.txt']))
  })
})

describe('readFileDiff', () => {
  it('returns the unified diff for a modified tracked file', async () => {
    const git = simpleGit(dir)
    await git.init()
    await git.addConfig('user.email', 'test@example.com')
    await git.addConfig('user.name', 'Test')
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'v1\n')
    await git.add('.')
    await git.commit('initial')
    await fs.writeFile(path.join(dir, 'tracked.txt'), 'v2\n')

    const diff = await readFileDiff(dir, 'tracked.txt')
    expect(diff).toContain('-v1')
    expect(diff).toContain('+v2')
  })

  it('returns empty text outside a repo', async () => {
    await fs.writeFile(path.join(dir, 'a.txt'), 'x')
    expect(await readFileDiff(dir, 'a.txt')).toBe('')
  })

  it('never diffs a binary path, even inside a repo', async () => {
    const git = simpleGit(dir)
    await git.init()
    await fs.writeFile(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    expect(await readFileDiff(dir, 'logo.png')).toBe('')
  })
})

describe('readFileContent', () => {
  it('refuses to decode a binary path as text', async () => {
    await fs.writeFile(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))
    expect(await readFileContent(dir, 'logo.png')).toBe('')
  })

  it('reads a plain text file normally', async () => {
    await fs.writeFile(path.join(dir, 'notes.txt'), 'hello')
    expect(await readFileContent(dir, 'notes.txt')).toBe('hello')
  })
})

describe('writeFileContent', () => {
  it('writes new content to an existing text file', async () => {
    await fs.writeFile(path.join(dir, 'notes.txt'), 'old')
    await writeFileContent(dir, 'notes.txt', 'new content')
    expect(await fs.readFile(path.join(dir, 'notes.txt'), 'utf8')).toBe('new content')
  })

  it('creates the file if it does not exist yet', async () => {
    await writeFileContent(dir, 'new-file.txt', 'hello')
    expect(await fs.readFile(path.join(dir, 'new-file.txt'), 'utf8')).toBe('hello')
  })

  it('refuses to write a binary path', async () => {
    await expect(writeFileContent(dir, 'logo.png', 'not really a png')).rejects.toThrow()
  })
})

describe('readImageDataUrl', () => {
  it('returns a base64 data URL for an image file', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    await fs.writeFile(path.join(dir, 'logo.png'), bytes)
    const url = await readImageDataUrl(dir, 'logo.png')
    expect(url).toBe(`data:image/png;base64,${bytes.toString('base64')}`)
  })

  it('returns an empty string for a non-image path', async () => {
    await fs.writeFile(path.join(dir, 'notes.txt'), 'hi')
    expect(await readImageDataUrl(dir, 'notes.txt')).toBe('')
  })
})
