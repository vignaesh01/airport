export interface AgentDefinition {
  id: string
  label: string
  /** CSS custom property name for the chip background, e.g. '--agent-claude'. */
  chipVar: string
  /** CSS custom property name for the chip text colour, e.g. '--agent-claude-ink'. */
  inkVar: string
  /** Becomes CreateSessionOptions.shellPath. Undefined = plain platform shell. */
  command?: string
}

export const AGENTS: AgentDefinition[] = [
  { id: 'claude', label: 'Claude', chipVar: '--agent-claude', inkVar: '--agent-claude-ink', command: 'claude' },
  { id: 'codex', label: 'Codex', chipVar: '--agent-codex', inkVar: '--agent-codex-ink', command: 'codex' },
  {
    id: 'antigravity',
    label: 'Antigravity',
    chipVar: '--agent-antigravity',
    inkVar: '--agent-antigravity-ink',
    command: 'agy'
  },
  { id: 'devin', label: 'Devin', chipVar: '--agent-devin', inkVar: '--agent-devin-ink', command: 'devin' },
  { id: 'shell', label: 'Shell', chipVar: '--agent-shell', inkVar: '--agent-shell-ink' }
]
