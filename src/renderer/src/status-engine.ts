export type SessionStatus = 'red' | 'yellow' | 'green' | 'grey'

/** Output written more recently than this counts as still actively streaming. */
export const YELLOW_ACTIVE_MS = 400
/** Minimum quiet time before a prompt-shaped last line is trusted as "needs you". */
export const RED_QUIET_MS = 800
/** Quiet time after which, absent a prompt match, the agent is considered idle/done. */
export const GREEN_QUIET_MS = 1500

// Deliberately narrow: a bare trailing `>`/`❯` was tried first and dropped —
// full-screen TUI agents (Claude Code included) park the cursor in a
// persistent input box whose leading `❯` caret is visible whether or not
// anything actually needs you, and a plain wrapping shell prompt (cmd's
// "C:\path>", PowerShell's "PS C:\path>") left behind once an agent process
// exits ends in '>' too — both used to cause a false "needs you" red. What's
// left targets an actual question: a literal '?', a "(y/n)" confirmation, or
// a numbered choice line ("1. Yes", "[1] Yes", "1) Yes", optionally preceded
// by a `❯`/`>` selection marker).
const QUESTION_END_RE = /\?\s*$/
const CONFIRM_RE = /\(y\/n\)/i
const OPTION_LINE_RE = /^\s*[❯>]?\s*(?:\[\d+\]|\d+[.):])\s*\S/

export function looksLikePrompt(line: string): boolean {
  const trimmed = line.trimEnd()
  if (trimmed.length === 0) return false
  return QUESTION_END_RE.test(trimmed) || CONFIRM_RE.test(trimmed) || OPTION_LINE_RE.test(trimmed)
}

export interface ClassifyParams {
  /** True once the PTY process has exited. */
  exited: boolean
  now: number
  /** epoch ms of the last output chunk received, or null if none has arrived yet. */
  lastOutputAt: number | null
  /**
   * The last few rendered terminal rows up to and including the cursor's row,
   * oldest first. Full-screen TUI agents (Claude Code included) park the
   * cursor in a persistent input box at the bottom of the screen — the actual
   * question or option list renders on the rows just above it — so checking
   * only the cursor's own row misses every real prompt.
   */
  lines: string[]
}

/**
 * Tier 1 heuristic status classifier — works for any command, including plain
 * shells, using only output timing and the shape of the most recently
 * rendered rows (not the raw byte stream, so it stays meaningful across
 * full-screen/alt-screen TUI redraws).
 */
export function classifyStatus({ exited, now, lastOutputAt, lines }: ClassifyParams): SessionStatus {
  if (exited) return 'grey'
  if (lastOutputAt === null) return 'yellow'

  const quiet = now - lastOutputAt
  if (quiet < YELLOW_ACTIVE_MS) return 'yellow'
  if (quiet >= RED_QUIET_MS && lines.some(looksLikePrompt)) return 'red'
  if (quiet >= GREEN_QUIET_MS) return 'green'
  return 'yellow'
}
