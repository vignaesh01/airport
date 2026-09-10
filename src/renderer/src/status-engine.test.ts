import { describe, it, expect } from 'vitest'
import { classifyStatus, looksLikePrompt } from './status-engine'

describe('looksLikePrompt', () => {
  it('matches an actual question or confirmation', () => {
    expect(looksLikePrompt('Allow Bash(npm test)?')).toBe(true)
    expect(looksLikePrompt('Continue? (y/n)')).toBe(true)
  })

  it('matches a numbered choice line, with or without a leading selection marker', () => {
    expect(looksLikePrompt('❯ 1. Yes')).toBe(true)
    expect(looksLikePrompt('  2. No, and tell it what to do differently')).toBe(true)
    expect(looksLikePrompt('[1] Yes')).toBe(true)
    expect(looksLikePrompt('1) Yes')).toBe(true)
  })

  it('does not match a bare trailing > or ❯ on its own', () => {
    // These used to false-positive on two real cases: a full-screen TUI agent's
    // persistent input-box caret (visible whether or not it needs you), and a
    // plain wrapping-shell prompt left behind once the agent process exits.
    expect(looksLikePrompt('❯')).toBe(false)
    expect(looksLikePrompt('some/path >')).toBe(false)
    expect(looksLikePrompt('C:\\Users\\me\\project>')).toBe(false)
    expect(looksLikePrompt('PS C:\\Users\\me\\project>')).toBe(false)
  })

  it('rejects plain output and blank lines', () => {
    expect(looksLikePrompt('Compiling module 4 of 10')).toBe(false)
    expect(looksLikePrompt('')).toBe(false)
    expect(looksLikePrompt('   ')).toBe(false)
  })
})

describe('classifyStatus', () => {
  const base = { exited: false, now: 10_000, lastOutputAt: 10_000, lines: [] as string[] }

  it('is grey once the process has exited, regardless of everything else', () => {
    expect(classifyStatus({ ...base, exited: true, lines: ['❯'] })).toBe('grey')
  })

  it('is yellow before any output has arrived', () => {
    expect(classifyStatus({ ...base, lastOutputAt: null })).toBe('yellow')
  })

  it('is yellow while output is still streaming (< 400ms quiet)', () => {
    expect(classifyStatus({ ...base, now: 10_300, lastOutputAt: 10_000 })).toBe('yellow')
  })

  it('is red once quiet >= 800ms and the last line looks like a prompt', () => {
    expect(classifyStatus({ ...base, now: 10_900, lastOutputAt: 10_000, lines: ['Allow Bash(npm test)?'] })).toBe(
      'red'
    )
  })

  it('is red when a prompt-shaped line sits above the cursor row, not just on it', () => {
    // Mirrors a full-screen TUI: the question/options render above the
    // persistent input box the cursor actually sits in.
    expect(
      classifyStatus({
        ...base,
        now: 10_900,
        lastOutputAt: 10_000,
        lines: ['Allow Bash(npm test)?', '❯ 1. Yes', '  2. No', '', '>']
      })
    ).toBe('red')
  })

  it('is not red at 800ms quiet without a prompt-shaped line', () => {
    expect(classifyStatus({ ...base, now: 10_900, lastOutputAt: 10_000, lines: ['still building…'] })).not.toBe(
      'red'
    )
  })

  it('is green once quiet >= 1500ms with no prompt match', () => {
    expect(classifyStatus({ ...base, now: 11_600, lastOutputAt: 10_000, lines: ['done.'] })).toBe('green')
  })

  it('stays yellow in the ambiguous gap between 400ms and the red/green thresholds', () => {
    expect(classifyStatus({ ...base, now: 10_600, lastOutputAt: 10_000, lines: ['still building…'] })).toBe(
      'yellow'
    )
  })

  it('turns green, not red, once an agent exits back to the wrapping shell prompt', () => {
    // The PTY itself is still alive (it wraps the agent command in cmd/PowerShell
    // so the window stays open), so `exited` is false — only the rendered line
    // changes to a bare shell prompt. That alone must not read as "needs you".
    expect(
      classifyStatus({ ...base, now: 11_600, lastOutputAt: 10_000, lines: ['PS C:\\Users\\me\\project>'] })
    ).toBe('green')
  })
})
