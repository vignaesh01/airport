import { describe, it, expect } from 'vitest'
import { parseSessionsFile } from './sessions-store'

describe('parseSessionsFile', () => {
  it('parses a valid sessions file', () => {
    const raw = JSON.stringify({
      version: 1,
      activeId: 'abc',
      sessions: [{ id: 'abc', folder: '/x', agentId: 'claude', name: 'claude-abc1', createdAt: 1 }]
    })
    expect(parseSessionsFile(raw)).toEqual({
      version: 1,
      activeId: 'abc',
      sessions: [{ id: 'abc', folder: '/x', agentId: 'claude', name: 'claude-abc1', createdAt: 1 }]
    })
  })

  it('normalizes a missing activeId to null', () => {
    const raw = JSON.stringify({ version: 1, sessions: [] })
    expect(parseSessionsFile(raw).activeId).toBeNull()
  })

  it('returns the empty file for malformed JSON', () => {
    expect(parseSessionsFile('{not json')).toEqual({ version: 1, activeId: null, sessions: [] })
  })

  it('returns the empty file for a wrong-shaped object', () => {
    expect(parseSessionsFile(JSON.stringify({ version: 2, sessions: [] }))).toEqual({
      version: 1,
      activeId: null,
      sessions: []
    })
    expect(parseSessionsFile(JSON.stringify({ version: 1 }))).toEqual({
      version: 1,
      activeId: null,
      sessions: []
    })
  })
})
