# Multi-session rail & new-session picker — design

## Context

Airport currently runs exactly one implicit terminal, mounted directly in `App.tsx`, with no way
to open a second one. The session rail and file explorer are static placeholder text
(`"Sessions (next plan)"` / `"Explorer (next plan)"`). This is Step 4 of `docs/design.md`'s build
order: "Multiple PTYs, the vertical tab component, folder/agent/branch metadata, persistence to
`userData/sessions.json`, restore-on-launch." This spec covers exactly that slice — nothing from
Step 5 (status detection), Step 6 (real agent-conversation resume via hooks), or Step 7 (file
explorer).

**Scope boundary, stated explicitly:** tabs in this plan carry **no status glyph** and are **not
sorted by status** — that data doesn't exist until Step 5's `StatusEngine`, and showing a fake or
placeholder glyph would be a dishonest signal. "Resume" in this plan means *relaunch the same
folder + agent as a fresh process*, not resume the agent's actual prior conversation (that needs
the agent's own session-id plumbing, which is Step 6 territory per `docs/design.md`'s "Session
name" section).

## Data model

`src/shared/session.ts` (imported by both main and renderer, like `src/shared/ipc.ts`):

```ts
export interface SessionRecord {
  id: string // stable tab id, client-generated (crypto.randomUUID), persists across relaunches
  folder: string // absolute path
  agentId: string // AgentDefinition.id
  name: string // display label, e.g. "claude-a1b2"
  createdAt: number // epoch ms
}
```

Persisted to `userData/sessions.json`:

```ts
export interface SessionsFile {
  version: 1
  activeId: string | null
  sessions: SessionRecord[]
}
```

The live `node-pty` session id returned by `createSession` is never persisted — every launch or
resume creates a fresh PTY.

`src/shared/agents.ts`:

```ts
export interface AgentDefinition {
  id: string
  label: string
  colorVar: string // CSS custom property name for the rail chip
  command?: string // becomes CreateSessionOptions.shellPath; undefined = plain platform shell
}

export const AGENTS: AgentDefinition[] = [
  { id: 'claude', label: 'Claude', colorVar: '--agent-claude', command: 'claude' },
  { id: 'codex', label: 'Codex', colorVar: '--agent-codex', command: 'codex' },
  { id: 'gemini', label: 'Gemini', colorVar: '--agent-gemini', command: 'gemini' },
  { id: 'devin', label: 'Devin', colorVar: '--agent-devin', command: 'devin' },
  { id: 'shell', label: 'Shell', colorVar: '--agent-shell' }
]
```

## Main process additions

- `src/main/sessions-store.ts` — `loadSessionsFile(): SessionsFile` / `saveSessionsFile(file: SessionsFile): void`,
  reading/writing `path.join(app.getPath('userData'), 'sessions.json')`. Missing file / parse
  failure returns `{ version: 1, activeId: null, sessions: [] }` rather than throwing.
- `src/main/dialog.ts` — `browseForFolder(): Promise<string | null>` wrapping
  `dialog.showOpenDialog({ properties: ['openDirectory'] })`; returns `null` on cancel.
- `src/main/git.ts` — `getBranch(folder: string): Promise<string | null>` via `simple-git` (new
  dependency); returns `null` on any failure (not a repo, no commits yet, etc.) rather than
  throwing — a non-repo folder is a legal, common case, not an error.
- `registerSessionHandlers()` in `src/main/pty-manager.ts`'s neighbourhood (new file
  `src/main/session-handlers.ts`) wires four new `ipcMain` entries: `sessions:load`,
  `sessions:save`, `dialog:browse-folder`, `git:branch`. Called once from `app.whenReady()`
  alongside `registerPtyHandlers()`.

## IPC contract additions

`src/shared/ipc.ts` gains:

```ts
export const SESSION_CHANNELS = {
  load: 'sessions:load',
  save: 'sessions:save',
  browseFolder: 'dialog:browse-folder',
  gitBranch: 'git:branch'
} as const
```

`AirportApi` gains:

```ts
loadSessions(): Promise<SessionsFile>
saveSessions(file: SessionsFile): void
browseFolder(): Promise<string | null>
gitBranch(folder: string): Promise<string | null>
```

## Renderer architecture

- `App.tsx` owns `sessions: SessionRecord[]` and `activeId: string | null` as React state — the
  renderer's working copy is the source of truth while the app runs; `sessions.json` is where it's
  durably persisted between launches. (A main-owned push-based store, as a literal reading of
  `docs/design.md`'s "renderer is a view over serialisable session state" might suggest, buys
  nothing extra for a single-window app with no other writer — adding a main→renderer event
  channel now would be unused machinery. If Airport ever supports multiple windows, that's the
  natural point to revisit this.)
- On mount, `loadSessions()` runs once. If the persisted list is non-empty, render a **"Resume N
  sessions?"** banner in the rail instead of auto-launching anything — matching
  `docs/design.md`'s literal wording and your explicit choice. "Resume" hydrates `sessions` state
  from the persisted list (mounting one `<Terminal>` per entry, each spawning a fresh PTY at its
  folder+agent). "Start fresh" clears the persisted file and leaves the rail empty except "+ New
  session".
- Every open session's `<Terminal>` **stays mounted** for as long as its tab exists — switching
  tabs must never unmount/remount, or scrollback and the live PTY connection are lost. The
  currently-inactive terminals are hidden via `visibility: hidden` + `position: absolute` (all
  terminal wrappers stacked in the same box), **not** `display: none` — a `display:none` ancestor
  collapses to zero size, and `Terminal.tsx`'s existing `ResizeObserver` would then `fit()` the
  hidden xterm instance to 0 cols/rows and resize its PTY to match, corrupting it for when the tab
  is shown again.
- Closing a tab removes its `SessionRecord` from the `sessions` array (and persists the new list).
  React unmounts that `<Terminal>`; its existing cleanup effect already calls
  `window.airport.dispose(sessionId)` — no new disposal path needed.
- `Terminal.tsx` gains two props: `folder: string` (→ `CreateSessionOptions.cwd`) and
  `command?: string` (→ `CreateSessionOptions.shellPath`). No other changes — the component's
  existing create/write/resize/dispose lifecycle is unaffected.
- Git branch is fetched once per session, when its tab is created or restored (not watched live —
  live updates on checkout are file-explorer/Step 7 territory, out of scope here).

## New components

- `src/renderer/src/SessionRail.tsx` — renders the list of `SessionTab`s (insertion order — no
  status sort in this plan), the "+ New session" button, and the resume banner when applicable.
- `src/renderer/src/SessionTab.tsx` — one rail row: folder name (bold), agent chip (colour from
  `AgentDefinition.colorVar`) + branch (or `—`), session name + elapsed time (computed from
  `createdAt`, ticking on an interval). No status glyph. A close (×) affordance.
- `src/renderer/src/NewSessionDialog.tsx` — modal: folder field with a "Browse…" button calling
  `window.airport.browseFolder()`, an agent grid built from `AGENTS`, and a Start button that
  constructs a `SessionRecord` (name defaults to `` `${agentId}-${id.slice(0, 4)}` ``) and appends
  it to `sessions`.

## Theme additions

`theme.css` gains fixed (non-theme-varying) agent chip tokens, ported verbatim from
`design/mockup.html`'s `.agent-*` rules — soft background + accent text pairs already verified
legible on both light and dark grounds there:

```css
--agent-claude: rgba(164, 128, 255, 0.14);
--agent-claude-ink: #a480ff;
--agent-codex: rgba(111, 168, 255, 0.14);
--agent-codex-ink: var(--accent);
--agent-gemini: rgba(79, 211, 152, 0.14);
--agent-gemini-ink: #1f9d6b; /* #4fd398 in dark, matching the mockup's dark-mode override */
--agent-devin: rgba(236, 72, 153, 0.14); /* pink — 5th hue, distinct from claude/codex/gemini and reserved red/yellow/green status semantics */
--agent-devin-ink: #db2777;
--agent-shell: var(--grey-soft); /* new neutral token, mirrors mockup's .agent-shell */
--agent-shell-ink: var(--text-faint);
```

## Explicitly out of scope (defer to later plans)

- Status glyphs, status-based sort, the pulsing red edge bar — Step 5.
- Real per-agent conversation resume (binding to Claude Code's actual session id, etc.) — Step 6.
- Live git-branch updates on checkout, file explorer — Step 7.
- Keyboard shortcuts (`Ctrl+1..9`, jump-to-next-red) — Step 8, and jump-to-next-red specifically
  needs status data that doesn't exist yet.
- Drag-to-reorder tabs.
