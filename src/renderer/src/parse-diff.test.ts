import { describe, it, expect } from 'vitest'
import { parseUnifiedDiff, diffStat, toPlainRows } from './parse-diff'

const SAMPLE = [
  'diff --git a/main.ts b/main.ts',
  'index abc123..def456 100644',
  '--- a/main.ts',
  '+++ b/main.ts',
  '@@ -41,3 +41,4 @@',
  ' const analyzer = new StatusAnalyzer(session.buffer)',
  '-const state = analyzer.classify()',
  '+const state = analyzer.classify({ altScreen: session.altScreen })',
  '+emitStatus(session.id, state)',
  ' // done',
  ''
].join('\n')

describe('parseUnifiedDiff', () => {
  it('splits hunk lines into typed rows with line numbers', () => {
    const rows = parseUnifiedDiff(SAMPLE)
    expect(rows).toEqual([
      { type: 'ctx', oldLine: 41, newLine: 41, code: 'const analyzer = new StatusAnalyzer(session.buffer)' },
      { type: 'del', oldLine: 42, newLine: null, code: 'const state = analyzer.classify()' },
      { type: 'add', oldLine: null, newLine: 42, code: 'const state = analyzer.classify({ altScreen: session.altScreen })' },
      { type: 'add', oldLine: null, newLine: 43, code: 'emitStatus(session.id, state)' },
      { type: 'ctx', oldLine: 43, newLine: 44, code: '// done' }
    ])
  })

  it('ignores an empty diff', () => {
    expect(parseUnifiedDiff('')).toEqual([])
  })

  it('counts added and deleted lines', () => {
    expect(diffStat(parseUnifiedDiff(SAMPLE))).toEqual({ added: 2, deleted: 1 })
  })
})

describe('toPlainRows', () => {
  it('numbers each line as unhighlighted context', () => {
    expect(toPlainRows('a\nb\nc')).toEqual([
      { type: 'ctx', oldLine: 1, newLine: 1, code: 'a' },
      { type: 'ctx', oldLine: 2, newLine: 2, code: 'b' },
      { type: 'ctx', oldLine: 3, newLine: 3, code: 'c' }
    ])
  })

  it('drops the trailing blank line produced by a final newline', () => {
    expect(toPlainRows('a\nb\n')).toEqual([
      { type: 'ctx', oldLine: 1, newLine: 1, code: 'a' },
      { type: 'ctx', oldLine: 2, newLine: 2, code: 'b' }
    ])
  })

  it('returns no rows for empty content', () => {
    expect(toPlainRows('')).toEqual([])
  })
})
