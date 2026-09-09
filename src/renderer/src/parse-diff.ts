export interface DiffRow {
  type: 'add' | 'del' | 'ctx'
  oldLine: number | null
  newLine: number | null
  code: string
}

/** Parses a single-file unified diff (as produced by `git diff`) into displayable rows. */
export function parseUnifiedDiff(text: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of text.split('\n')) {
    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      continue
    }
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('\\ No newline')
    ) {
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ type: 'add', oldLine: null, newLine, code: line.slice(1) })
      newLine++
    } else if (line.startsWith('-')) {
      rows.push({ type: 'del', oldLine, newLine: null, code: line.slice(1) })
      oldLine++
    } else if (line.startsWith(' ')) {
      rows.push({ type: 'ctx', oldLine, newLine, code: line.slice(1) })
      oldLine++
      newLine++
    }
  }
  return rows
}

/** Turns raw file content into plain (unhighlighted) rows for files with nothing to diff. */
export function toPlainRows(content: string): DiffRow[] {
  if (content.length === 0) return []
  const lines = content.split('\n')
  // A trailing newline produces one empty extra element from split — drop it so line count matches the file.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((code, i) => ({ type: 'ctx', oldLine: i + 1, newLine: i + 1, code }))
}

export function diffStat(rows: DiffRow[]): { added: number; deleted: number } {
  let added = 0
  let deleted = 0
  for (const row of rows) {
    if (row.type === 'add') added++
    else if (row.type === 'del') deleted++
  }
  return { added, deleted }
}
