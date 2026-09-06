# Multi-session Rail & New-session Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single static terminal and placeholder rail/explorer text with a real
multi-session vertical tab rail, a native-folder-dialog "+ New session" picker, and
`userData/sessions.json` persistence with a resume-on-launch confirmation banner.

**Architecture:** Main process gains a small `sessions-store` (JSON persistence), `dialog`
(native folder picker), and `git` (branch lookup via `simple-git`) module, wired into IPC
alongside the existing PTY handlers. The renderer holds the session list as ordinary React state
in `App.tsx` (the working source of truth while the app runs) and persists it to disk on every
change once initial load has resolved. Every open session's `<Terminal>` stays mounted for its
tab's whole lifetime — switching tabs toggles CSS `visibility`, never unmounts — so scrollback and
the live PTY connection survive tab switches; closing a tab is the only thing that unmounts a
`<Terminal>`, which reuses its existing PTY-disposal cleanup unchanged.

**Tech Stack:** Same as the existing app (Electron, React, TypeScript, node-pty, xterm.js), plus
`simple-git` (new dependency) for branch lookups.

**Spec:** `docs/superpowers/specs/2026-09-06-multi-session-rail-design.md`

## Global Constraints

- **Scope boundary:** no status glyphs, no status-based sort, no OS notifications, no keyboard
  shortcuts — those are Steps 5 and 8 in `docs/design.md`'s build order. Tabs render in insertion
  order.
- **"Resume" means relaunch, not reconnect:** restoring a persisted session spawns a fresh PTY at
  the same folder + agent. It does not reconnect to the agent's actual prior conversation (that
  needs Step 6's hook/session-id plumbing).
- Git branch is fetched once per session (on creation or restore), never live-watched in this plan.
- The renderer never touches `node-pty`, `simple-git`, `fs`, or `electron.dialog` directly — only
  through `window.airport`, per the existing IPC layering established in the prior plan.
- Persisted file: `path.join(app.getPath('userData'), 'sessions.json')`, shape
  `{ version: 1, activeId: string | null, sessions: SessionRecord[] }`. Never persist the live
  `node-pty` session id — only `SessionRecord` fields.
- Typefaces and token structure (three-state theme) must stay consistent with the existing
  `theme.css` — new tokens follow the same bare-`:root`-first pattern already established there.

---

## File Structure

```
src/
├── shared/
│   ├── session.ts                    # SessionRecord, SessionsFile types (new)
│   ├── agents.ts                     # AgentDefinition, AGENTS list (new)
│   └── ipc.ts                        # + SESSION_CHANNELS, AirportApi additions (modified)
├── main/
│   ├── sessions-store.ts             # parseSessionsFile, load/saveSessionsFile (new)
│   ├── sessions-store.test.ts        # (new)
│   ├── dialog.ts                     # browseForFolder (new)
│   ├── git.ts                        # getBranch (new)
│   ├── session-handlers.ts           # registerSessionHandlers, wires the 4 new IPC channels (new)
│   └── index.ts                      # + call registerSessionHandlers() (modified)
├── preload/
│   └── index.ts                      # + 4 new airportApi methods (modified)
└── renderer/src/
    ├── format-elapsed.ts             # pure formatting helper (new)
    ├── format-elapsed.test.ts        # (new)
    ├── SessionTab.tsx                # one rail row (new)
    ├── SessionRail.tsx               # rail list + new-session button + resume banner (new)
    ├── NewSessionDialog.tsx          # folder/agent picker modal (new)
    ├── Terminal.tsx                  # + folder/command props (modified)
    ├── theme.css                     # + agent chip tokens, rail/tab/picker/terminal-stack CSS (modified)
    └── App.tsx                       # full rewrite: session state, persistence, wiring (modified)
```

---

## Task 1: Shared data model & IPC contract

**Files:**
- Create: `src/shared/session.ts`
- Create: `src/shared/agents.ts`
- Modify: `src/shared/ipc.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SessionRecord`, `SessionsFile`, `EMPTY_SESSIONS_FILE` (from `session.ts`);
  `AgentDefinition`, `AGENTS` (from `agents.ts`); `SESSION_CHANNELS` and the 4 new `AirportApi`
  methods (from `ipc.ts`). Every later task in this plan imports from these three files.

No test — pure type/constant declarations, same as the precedent set by the existing
`src/shared/ipc.ts`.

- [ ] **Step 1: Write `src/shared/session.ts`**

```ts
export interface SessionRecord {
  /** Stable tab id, client-generated. Persists across relaunches. */
  id: string
  /** Absolute path to the session's working directory. */
  folder: string
  /** AgentDefinition.id this session was launched with. */
  agentId: string
  /** Display label shown in the rail. */
  name: string
  /** epoch ms, used to compute elapsed time in the rail. */
  createdAt: number
}

export interface SessionsFile {
  version: 1
  activeId: string | null
  sessions: SessionRecord[]
}

export const EMPTY_SESSIONS_FILE: SessionsFile = { version: 1, activeId: null, sessions: [] }
```

- [ ] **Step 2: Write `src/shared/agents.ts`**

```ts
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
  { id: 'gemini', label: 'Gemini', chipVar: '--agent-gemini', inkVar: '--agent-gemini-ink', command: 'gemini' },
  { id: 'devin', label: 'Devin', chipVar: '--agent-devin', inkVar: '--agent-devin-ink', command: 'devin' },
  { id: 'shell', label: 'Shell', chipVar: '--agent-shell', inkVar: '--agent-shell-ink' }
]
```

- [ ] **Step 3: Extend `src/shared/ipc.ts`**

Add the import at the top (alongside no existing shared imports — this file currently has none):

```ts
import type { SessionsFile } from './session'
```

Add after the existing `PTY_CHANNELS` constant:

```ts
export const SESSION_CHANNELS = {
  load: 'sessions:load',
  save: 'sessions:save',
  browseFolder: 'dialog:browse-folder',
  gitBranch: 'git:branch'
} as const
```

Extend the existing `AirportApi` interface (add these four members alongside the existing six):

```ts
export interface AirportApi {
  createSession(options: CreateSessionOptions): Promise<CreateSessionResult>
  write(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void
  dispose(sessionId: string): void
  onData(sessionId: string, callback: (chunk: string) => void): () => void
  onExit(sessionId: string, callback: (exitCode: number) => void): () => void
  loadSessions(): Promise<SessionsFile>
  saveSessions(file: SessionsFile): void
  browseFolder(): Promise<string | null>
  gitBranch(folder: string): Promise<string | null>
}
```

- [ ] **Step 4: Type-check**

```bash
npm run typecheck
```

Expected: errors about `Terminal.tsx` NOT calling `createSession` with the new shape are NOT
expected yet (that's unaffected — `CreateSessionOptions` didn't change). Expected: no errors at
all, since nothing yet implements the four new `AirportApi` methods but TypeScript doesn't check
that an *interface* has implementers — only assignments to it. If you see an error, it must be a
syntax mistake in this task's own new code — fix it before moving on.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session/agent shared types and extend IPC contract

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 2: Main process — sessions persistence

**Files:**
- Create: `src/main/sessions-store.ts`
- Test: `src/main/sessions-store.test.ts`

**Interfaces:**
- Consumes: `SessionsFile`, `EMPTY_SESSIONS_FILE` from `src/shared/session.ts` (Task 1).
- Produces: `parseSessionsFile(raw: string): SessionsFile` (pure, tested below),
  `loadSessionsFile(): SessionsFile`, `saveSessionsFile(file: SessionsFile): void`. Task 3's
  `session-handlers.ts` calls the latter two.

- [ ] **Step 1: Write the failing tests for `parseSessionsFile`**

`src/main/sessions-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/main/sessions-store.test.ts
```

Expected: FAIL — `Cannot find module './sessions-store'`.

- [ ] **Step 3: Write `src/main/sessions-store.ts`**

```ts
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMPTY_SESSIONS_FILE, type SessionsFile } from '../shared/session'

export function parseSessionsFile(raw: string): SessionsFile {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).version === 1 &&
      Array.isArray((parsed as Record<string, unknown>).sessions)
    ) {
      const obj = parsed as Record<string, unknown>
      return {
        version: 1,
        activeId: typeof obj.activeId === 'string' ? obj.activeId : null,
        sessions: obj.sessions as SessionsFile['sessions']
      }
    }
  } catch {
    // fall through to default
  }
  return EMPTY_SESSIONS_FILE
}

function sessionsFilePath(): string {
  return join(app.getPath('userData'), 'sessions.json')
}

export function loadSessionsFile(): SessionsFile {
  try {
    const raw = readFileSync(sessionsFilePath(), 'utf-8')
    return parseSessionsFile(raw)
  } catch {
    return EMPTY_SESSIONS_FILE
  }
}

export function saveSessionsFile(file: SessionsFile): void {
  writeFileSync(sessionsFilePath(), JSON.stringify(file, null, 2), 'utf-8')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/main/sessions-store.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add sessions.json persistence in main process

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 3: Main process — folder dialog, git branch, IPC wiring

**Files:**
- Create: `src/main/dialog.ts`
- Create: `src/main/git.ts`
- Create: `src/main/session-handlers.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `SESSION_CHANNELS` from `src/shared/ipc.ts` (Task 1); `loadSessionsFile`,
  `saveSessionsFile` from `src/main/sessions-store.ts` (Task 2).
- Produces: `browseForFolder(window): Promise<string | null>`, `getBranch(folder): Promise<string | null>`,
  `registerSessionHandlers(): void` — called once from `app.whenReady()`, mirroring
  `registerPtyHandlers()`.

No unit tests: both `dialog.ts` and `git.ts` are thin wrappers around Electron's `dialog` module
and the `simple-git` subprocess-driving library — there's no pure logic to extract and test in
isolation (this mirrors the existing `registerPtyHandlers` in `src/main/pty-manager.ts`, which is
also untested IPC-wiring code). Verified via the manual end-to-end check in Task 8.

- [ ] **Step 1: Install `simple-git`**

```bash
npm install simple-git
```

- [ ] **Step 2: Write `src/main/dialog.ts`**

```ts
import { dialog, type BrowserWindow } from 'electron'

export async function browseForFolder(window: BrowserWindow | null): Promise<string | null> {
  const result = window
    ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
```

- [ ] **Step 3: Write `src/main/git.ts`**

```ts
import simpleGit from 'simple-git'

export async function getBranch(folder: string): Promise<string | null> {
  try {
    const git = simpleGit(folder)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return null
    const status = await git.status()
    return status.current ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Write `src/main/session-handlers.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { SESSION_CHANNELS } from '../shared/ipc'
import type { SessionsFile } from '../shared/session'
import { loadSessionsFile, saveSessionsFile } from './sessions-store'
import { browseForFolder } from './dialog'
import { getBranch } from './git'

export function registerSessionHandlers(): void {
  ipcMain.handle(SESSION_CHANNELS.load, () => loadSessionsFile())

  ipcMain.on(SESSION_CHANNELS.save, (_event, file: SessionsFile) => {
    saveSessionsFile(file)
  })

  ipcMain.handle(SESSION_CHANNELS.browseFolder, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return browseForFolder(window)
  })

  ipcMain.handle(SESSION_CHANNELS.gitBranch, (_event, folder: string) => {
    return getBranch(folder)
  })
}
```

- [ ] **Step 5: Wire `registerSessionHandlers` into `src/main/index.ts`**

Add the import:

```ts
import { registerSessionHandlers } from './session-handlers'
```

In `app.whenReady().then(...)`, call it alongside `registerPtyHandlers()`:

```ts
  registerPtyHandlers()
  registerSessionHandlers()
```

- [ ] **Step 6: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add folder dialog, git branch lookup, and session IPC wiring

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 4: Preload bridge extension

**Files:**
- Modify: `src/preload/index.ts`

**Interfaces:**
- Consumes: `SESSION_CHANNELS`, `AirportApi` from `src/shared/ipc.ts` (Task 1).
- Produces: the four new methods on `window.airport`, consumed by `App.tsx` (Task 8) and
  `NewSessionDialog.tsx` (Task 7).

No test — this is IPC glue, same precedent as the existing preload file.

- [ ] **Step 1: Extend `src/preload/index.ts`**

Change the import line from:

```ts
import { PTY_CHANNELS, type AirportApi } from '../shared/ipc'
```

to:

```ts
import { PTY_CHANNELS, SESSION_CHANNELS, type AirportApi } from '../shared/ipc'
```

Add these four members to the `airportApi` object literal (after the existing `onExit` member):

```ts
  loadSessions: () => ipcRenderer.invoke(SESSION_CHANNELS.load),
  saveSessions: (file) => ipcRenderer.send(SESSION_CHANNELS.save, file),
  browseFolder: () => ipcRenderer.invoke(SESSION_CHANNELS.browseFolder),
  gitBranch: (folder) => ipcRenderer.invoke(SESSION_CHANNELS.gitBranch, folder)
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors — `airportApi` is declared `: AirportApi`, so this only compiles once all ten
methods are present with matching signatures.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: expose session persistence and folder/git APIs from preload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 5: `Terminal.tsx` — folder & command props

**Files:**
- Modify: `src/renderer/src/Terminal.tsx`

**Interfaces:**
- Consumes: nothing new (uses the existing `CreateSessionOptions.cwd`/`shellPath` fields, already
  present in `src/shared/ipc.ts` from the prior plan).
- Produces: `<Terminal folder={string} command={string | undefined} />`, consumed by `App.tsx`
  (Task 8).

No test — this is the same DOM/IPC glue component from the prior plan, just parameterised. Verified
manually in Task 8.

- [ ] **Step 1: Add a props interface and thread `folder`/`command` through**

Change the function signature from:

```ts
export function Terminal() {
```

to:

```ts
interface TerminalProps {
  folder: string
  command?: string
}

export function Terminal({ folder, command }: TerminalProps) {
```

Change the `createSession` call from:

```ts
    window.airport.createSession({ cols: term.cols, rows: term.rows }).then(({ sessionId }) => {
```

to:

```ts
    window.airport
      .createSession({ cols: term.cols, rows: term.rows, cwd: folder, shellPath: command })
      .then(({ sessionId }) => {
```

(Keep the rest of the `.then(...)` body exactly as-is — only the call itself changes; adjust
indentation of the body to match, since it's now nested one level deeper under the added
`.createSession(...)` line break.)

Change the effect's dependency array from `[]` to `[folder, command]` (the effect now reads both,
and while neither changes for a given mounted session in this plan, listing them keeps the
dependency array honest):

```ts
  }, [folder, command])
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: an error at the moment, since nothing calls `<Terminal>` with the new required `folder`
prop yet — `App.tsx` still renders `<Terminal />` with no props. **This is expected and will be
fixed by Task 8.** Confirm the error is exactly about the missing `folder` prop on `<Terminal>` in
`App.tsx` and nothing else; if there's any other error, fix it before moving on.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: parameterize Terminal with folder and command props

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

Note in your report that `npm run typecheck` fails with the expected, single, already-explained
error about `App.tsx`'s `<Terminal />` call — this is intentional and Task 8 fixes it. Do not try
to fix `App.tsx` in this task.

---

## Task 6: `SessionTab` / `SessionRail` components + rail CSS

**Files:**
- Create: `src/renderer/src/format-elapsed.ts`
- Test: `src/renderer/src/format-elapsed.test.ts`
- Create: `src/renderer/src/SessionTab.tsx`
- Create: `src/renderer/src/SessionRail.tsx`
- Modify: `src/renderer/src/theme.css`

**Interfaces:**
- Consumes: `SessionRecord` from `src/shared/session.ts`, `AgentDefinition`/`AGENTS` from
  `src/shared/agents.ts` (both Task 1).
- Produces: `formatElapsed(ms: number): string` (pure, tested below); `<SessionTab>` and
  `<SessionRail>` components, consumed by `App.tsx` (Task 8). `SessionRail`'s props:
  `{ sessions: SessionRecord[]; branches: Record<string, string | null>; activeId: string | null;
  onSelect(id): void; onClose(id): void; onNewSession(): void; resumeCount: number;
  onResume(): void; onDiscardResume(): void }`.

- [ ] **Step 1: Write the failing test for `formatElapsed`**

`src/renderer/src/format-elapsed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatElapsed } from './format-elapsed'

describe('formatElapsed', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(45_000)).toBe('45s')
  })

  it('formats sub-hour durations in minutes', () => {
    expect(formatElapsed(60_000)).toBe('1m')
    expect(formatElapsed(125_000)).toBe('2m')
  })

  it('formats hour-plus durations in hours', () => {
    expect(formatElapsed(3_600_000)).toBe('1h')
    expect(formatElapsed(7_200_000)).toBe('2h')
  })

  it('clamps negative durations to 0s', () => {
    expect(formatElapsed(-500)).toBe('0s')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/renderer/src/format-elapsed.test.ts
```

Expected: FAIL — `Cannot find module './format-elapsed'`.

- [ ] **Step 3: Write `src/renderer/src/format-elapsed.ts`**

```ts
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = Math.floor(totalMinutes / 60)
  return `${totalHours}h`
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/renderer/src/format-elapsed.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Write `src/renderer/src/SessionTab.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { SessionRecord } from '../../shared/session'
import { AGENTS } from '../../shared/agents'
import { formatElapsed } from './format-elapsed'

interface SessionTabProps {
  session: SessionRecord
  branch: string | null
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

export function SessionTab({ session, branch, isActive, onSelect, onClose }: SessionTabProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const agent = AGENTS.find((a) => a.id === session.agentId)
  const folderName = session.folder.split(/[\\/]/).filter(Boolean).pop() ?? session.folder

  return (
    <div
      className={`tab${isActive ? ' active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="tab-body">
        <div className="tab-folder">{folderName}</div>
        <div className="tab-meta">
          <span
            className="agent-chip"
            style={{
              background: `var(${agent?.chipVar ?? '--agent-shell'})`,
              color: `var(${agent?.inkVar ?? '--agent-shell-ink'})`
            }}
          >
            {agent?.label ?? session.agentId}
          </span>
          <span className="tab-branch">{branch ? `⑂ ${branch}` : '—'}</span>
        </div>
        <div className="tab-sess">
          <span>{session.name}</span>
          <span className="tab-time">{formatElapsed(now - session.createdAt)}</span>
        </div>
      </div>
      <button
        type="button"
        className="tab-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label={`Close ${folderName}`}
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/renderer/src/SessionRail.tsx`**

```tsx
import type { SessionRecord } from '../../shared/session'
import { SessionTab } from './SessionTab'

interface SessionRailProps {
  sessions: SessionRecord[]
  branches: Record<string, string | null>
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewSession: () => void
  resumeCount: number
  onResume: () => void
  onDiscardResume: () => void
}

export function SessionRail({
  sessions,
  branches,
  activeId,
  onSelect,
  onClose,
  onNewSession,
  resumeCount,
  onResume,
  onDiscardResume
}: SessionRailProps) {
  return (
    <div className="rail">
      <div className="rail-head">
        <span>Sessions</span>
        <span>{sessions.length}</span>
      </div>
      {resumeCount > 0 && (
        <div className="resume-banner">
          <span>
            Resume {resumeCount} session{resumeCount === 1 ? '' : 's'}?
          </span>
          <div className="resume-actions">
            <button type="button" onClick={onResume}>
              Resume
            </button>
            <button type="button" onClick={onDiscardResume}>
              Start fresh
            </button>
          </div>
        </div>
      )}
      <div className="rail-list">
        {sessions.map((s) => (
          <SessionTab
            key={s.id}
            session={s}
            branch={branches[s.id] ?? null}
            isActive={s.id === activeId}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)}
          />
        ))}
      </div>
      <div className="rail-foot">
        <button type="button" className="new-session" onClick={onNewSession}>
          ＋ New session
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Replace the placeholder rail/explorer CSS in `src/renderer/src/theme.css`**

Find this existing block:

```css
.rail,
.explorer {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-faint);
  background: var(--surface);
}

.rail {
  border-right: 1px solid var(--border);
}

.explorer {
  border-left: 1px solid var(--border);
}
```

Replace it with (the `.explorer` placeholder rule stays as it was — only `.rail` becomes a real
layout; a new `.rail-head` through `.new-session` block follows):

```css
.explorer {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-faint);
  background: var(--surface);
  border-left: 1px solid var(--border);
}

.rail {
  border-right: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.resume-banner {
  margin: 0 10px 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--accent-soft);
  font-size: 12px;
  color: var(--text);
}

.resume-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.resume-actions button {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.resume-actions button:first-child {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.rail-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px;
}

.tab {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 2px;
}

.tab:hover {
  background: var(--surface-2);
}

.tab.active {
  background: var(--surface-2);
  border-color: var(--border);
}

.tab-body {
  min-width: 0;
  flex: 1;
}

.tab-folder {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.agent-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.tab-branch {
  opacity: 0.85;
}

.tab-sess {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.tab-time {
  font-variant-numeric: tabular-nums;
}

.tab-close {
  flex: none;
  background: transparent;
  border: none;
  color: var(--text-faint);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.tab-close:hover {
  color: var(--text);
  background: var(--surface);
}

.rail-foot {
  padding: 8px;
  border-top: 1px solid var(--border);
}

.new-session {
  width: 100%;
  padding: 9px;
  border-radius: 9px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.new-session:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.tab:focus-visible,
.tab-close:focus-visible,
.new-session:focus-visible,
.resume-actions button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 8: Add the agent chip tokens to the bare `:root` block**

These are deliberately fixed (non-theme-varying) — ported from `design/mockup.html`'s `.agent-*`
rules, already verified legible on both light and dark grounds. Add them inside the existing bare
`:root { ... }` block (the first one in the file, alongside `--font-mono`) — **not** inside either
dark-mode block:

```css
  --agent-claude: rgba(164, 128, 255, 0.14);
  --agent-claude-ink: #a480ff;
  --agent-codex: rgba(111, 168, 255, 0.14);
  --agent-codex-ink: var(--accent);
  --agent-gemini: rgba(79, 211, 152, 0.14);
  --agent-gemini-ink: #1f9d6b;
  --agent-devin: rgba(236, 72, 153, 0.14);
  --agent-devin-ink: #db2777;
  --agent-shell: rgba(137, 145, 163, 0.14);
  --agent-shell-ink: var(--text-faint);
```

- [ ] **Step 9: Run tests and type-check**

```bash
npm run test
npm run typecheck
```

Expected: `npm run test` passes (the 7 existing tests plus this task's 4 new `formatElapsed`
tests = 11 total). `npm run typecheck` still shows the one expected `Terminal`/`App.tsx` error
from Task 5 — nothing new. `SessionTab`/`SessionRail` aren't consumed by `App.tsx` yet (Task 8),
so no new type errors should appear from this task's own files.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add SessionTab/SessionRail components and rail CSS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 7: `NewSessionDialog` component + picker CSS

**Files:**
- Create: `src/renderer/src/NewSessionDialog.tsx`
- Modify: `src/renderer/src/theme.css`

**Interfaces:**
- Consumes: `AGENTS` from `src/shared/agents.ts` (Task 1); `window.airport.browseFolder()`
  (Task 4).
- Produces: `<NewSessionDialog onCancel={() => void} onCreate={(folder, agentId) => void} />`,
  consumed by `App.tsx` (Task 8).

No test — form component with no pure logic to extract; verified manually in Task 8.

- [ ] **Step 1: Write `src/renderer/src/NewSessionDialog.tsx`**

```tsx
import { useState } from 'react'
import { AGENTS } from '../../shared/agents'

interface NewSessionDialogProps {
  onCancel: () => void
  onCreate: (folder: string, agentId: string) => void
}

export function NewSessionDialog({ onCancel, onCreate }: NewSessionDialogProps) {
  const [folder, setFolder] = useState('')
  const [agentId, setAgentId] = useState(AGENTS[0].id)

  const browse = async (): Promise<void> => {
    const picked = await window.airport.browseFolder()
    if (picked) setFolder(picked)
  }

  const start = (): void => {
    if (!folder) return
    onCreate(folder, agentId)
  }

  return (
    <div
      className="picker-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="picker">
        <h3>New session</h3>
        <div className="sub">Pick a folder and an agent.</div>
        <div className="field">
          <label>Folder</label>
          <div className="folder-row">
            <input type="text" value={folder} placeholder="No folder chosen" readOnly />
            <button type="button" onClick={browse}>
              Browse…
            </button>
          </div>
        </div>
        <div className="field">
          <label>Agent</label>
          <div className="agentgrid">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`agentopt${a.id === agentId ? ' sel' : ''}`}
                onClick={() => setAgentId(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="picker-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={start} disabled={!folder}>
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Append picker CSS to `src/renderer/src/theme.css`**

Add at the end of the file:

```css
.picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 18, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
  z-index: 20;
}

.picker {
  width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  padding: 18px;
}

.picker h3 {
  font-size: 14px;
  font-weight: 800;
  margin: 0 0 3px;
  color: var(--text);
}

.picker .sub {
  font-size: 12px;
  color: var(--text-faint);
  margin-bottom: 14px;
}

.field {
  margin-bottom: 12px;
}

.field label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.folder-row {
  display: flex;
  gap: 6px;
}

.folder-row input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
}

.folder-row button {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.agentgrid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.agentopt {
  padding: 8px 4px;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.agentopt.sel {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-dim);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.folder-row button:focus-visible,
.agentopt:focus-visible,
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Expected: same single pre-existing `Terminal`/`App.tsx` error from Task 5 — nothing new from this
task's own files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add NewSessionDialog component and picker CSS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 8: `App.tsx` integration — state, persistence, wiring

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/theme.css`

**Interfaces:**
- Consumes: `<SessionRail>` (Task 6), `<NewSessionDialog>` (Task 7), `<Terminal>` (Task 5),
  `window.airport.loadSessions/saveSessions/gitBranch` (Task 4), `AGENTS` (Task 1).
- Produces: the finished feature — nothing downstream in this plan consumes `App.tsx`.

This task has the one genuinely subtle piece of logic in the whole plan: **when must the app
persist the session list, and when must it not?** Read the whole step before writing code — get
this wrong and either a fast user action before initial load resolves silently fails to persist,
or the persisted file gets wiped out from under an unanswered "Resume N sessions?" banner before
the user has chosen.

No automated test for this task: it's React effect/IPC integration with no pure logic left to
extract (the pure pieces — `parseSessionsFile`, `formatElapsed` — are already tested in Tasks 2
and 6). Follow the step-by-step logic exactly; it's worked out below to close both races described
above. Verified via the manual end-to-end walkthrough in Step 4.

- [ ] **Step 1: Rewrite `src/renderer/src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Terminal } from './Terminal'
import { SessionRail } from './SessionRail'
import { NewSessionDialog } from './NewSessionDialog'
import { applyTheme, nextTheme, type ThemeMode } from './theme'
import { AGENTS } from '../../shared/agents'
import type { SessionRecord, SessionsFile } from '../../shared/session'
import './theme.css'

function makeSession(folder: string, agentId: string): SessionRecord {
  const id = crypto.randomUUID()
  return { id, folder, agentId, name: `${agentId}-${id.slice(0, 4)}`, createdAt: Date.now() }
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [branches, setBranches] = useState<Record<string, string | null>>({})
  const [pendingResume, setPendingResume] = useState<SessionsFile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)

  // Load persisted state once. If it holds sessions, offer to resume rather
  // than auto-launching anything — `sessions`/`activeId` stay empty until
  // the user decides.
  useEffect(() => {
    window.airport.loadSessions().then((file) => {
      if (file.sessions.length > 0) {
        setPendingResume(file)
      }
      setLoaded(true)
    })
  }, [])

  // Persist on every session-list change, but only once initial load has
  // resolved (`loaded`) — a save before that would silently overwrite the
  // real file with an empty one — and never while a resume decision is
  // still pending (`pendingResume`) — a save then would erase the very
  // sessions being offered before the user has chosen). Including `loaded`
  // in the dependency array also closes a race: if the user acts fast
  // enough to create a session before `loadSessions()` resolves, that
  // create is skipped by the `pendingResume` check's sibling guard below
  // but IS captured once `loaded` flips true and this effect re-runs.
  useEffect(() => {
    if (!loaded) return
    if (pendingResume) return
    window.airport.saveSessions({ version: 1, activeId, sessions })
  }, [loaded, pendingResume, sessions, activeId])

  // Fetch each session's git branch once, the first time it's seen.
  useEffect(() => {
    sessions.forEach((s) => {
      if (s.id in branches) return
      window.airport.gitBranch(s.folder).then((branch) => {
        setBranches((prev) => ({ ...prev, [s.id]: branch }))
      })
    })
  }, [sessions, branches])

  const cycleTheme = (): void => {
    const mode = nextTheme(theme)
    setTheme(mode)
    applyTheme(mode)
  }

  const handleResume = (): void => {
    if (!pendingResume) return
    setSessions(pendingResume.sessions)
    setActiveId(pendingResume.activeId ?? pendingResume.sessions[0]?.id ?? null)
    setPendingResume(null)
  }

  const handleDiscardResume = (): void => {
    setPendingResume(null)
  }

  const handleCreate = (folder: string, agentId: string): void => {
    const session = makeSession(folder, agentId)
    setSessions((prev) => [...prev, session])
    setActiveId(session.id)
    setShowNewSession(false)
  }

  const handleClose = (id: string): void => {
    const next = sessions.filter((s) => s.id !== id)
    setSessions(next)
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null)
    }
    setBranches((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const label = theme === 'system' ? '🌗 System' : theme === 'light' ? '☀️ Light' : '🌙 Dark'

  return (
    <div className="app">
      <div className="titlebar">
        <span className="brand">▲ Airport</span>
        <div className="spacer" />
        <button className="themebtn" onClick={cycleTheme} type="button">
          {label}
        </button>
      </div>
      <div className="main">
        <SessionRail
          sessions={sessions}
          branches={branches}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={handleClose}
          onNewSession={() => setShowNewSession(true)}
          resumeCount={pendingResume?.sessions.length ?? 0}
          onResume={handleResume}
          onDiscardResume={handleDiscardResume}
        />
        <div className="center terminal-stack">
          {sessions.map((s) => {
            const agent = AGENTS.find((a) => a.id === s.agentId)
            return (
              <div
                key={s.id}
                className="terminal-slot"
                style={{
                  visibility: s.id === activeId ? 'visible' : 'hidden',
                  pointerEvents: s.id === activeId ? 'auto' : 'none'
                }}
              >
                <Terminal folder={s.folder} command={agent?.command} />
              </div>
            )
          })}
          {sessions.length === 0 && (
            <div className="empty-center">No session open — start one from the rail.</div>
          )}
        </div>
        <div className="explorer">Explorer (next plan)</div>
      </div>
      {showNewSession && <NewSessionDialog onCancel={() => setShowNewSession(false)} onCreate={handleCreate} />}
    </div>
  )
}

export default App
```

- [ ] **Step 2: Append terminal-stack/empty-state CSS to `src/renderer/src/theme.css`**

```css
.terminal-stack {
  position: relative;
}

.terminal-slot {
  position: absolute;
  inset: 0;
}

.empty-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 13px;
}
```

- [ ] **Step 3: Run tests and type-check**

```bash
npm run test
npm run typecheck
```

Expected: `npm run test` — 11/11 passing (unchanged from Task 6, this task adds no new automated
tests). `npm run typecheck` — **zero errors now** (this is what resolves the expected error noted
in Tasks 5, 6, and 7).

- [ ] **Step 4: Manual end-to-end verification**

```bash
npm run build
```

Then launch the built app (same approach as the prior plan's Task 5/6 verification — this
environment may lack GUI access; use whatever mechanism you used for those, or state precisely
what you could/couldn't observe if you cannot launch it at all):

Walk through, in order:
1. Cold start with no `sessions.json` yet (or an empty one) — rail shows only "+ New session",
   center shows "No session open — start one from the rail."
2. Click "+ New session" — dialog opens. Click "Browse…" — native folder dialog opens (if you
   cannot interact with a native OS dialog in your environment, note this precisely rather than
   guessing at the result). Pick a folder, pick an agent (use "Shell" if you don't have the other
   agent CLIs installed), click "Start".
3. Confirm: dialog closes, a new tab appears in the rail with the folder's basename, the agent
   chip, `—` or a real branch name (if the folder is a git repo), a generated session name, and
   `0s` ticking upward. The center pane shows a live terminal at that folder.
4. Create a second session in a different folder. Confirm both tabs exist, only the second (active)
   one's terminal is visible, and switching back to the first tab shows its terminal exactly as you
   left it (scrollback intact — type something in one tab, switch away, switch back, confirm it's
   still there).
5. Close a tab (✕). Confirm it disappears from the rail and, if it was active, another tab (or the
   empty state) takes over.
6. Quit the app (or close the window) and relaunch. Confirm the **"Resume N sessions?"** banner
   appears with the correct count, and that nothing has been auto-launched yet. Click "Resume" —
   confirm the tabs come back with fresh terminals at the same folders/agents. Relaunch again and
   click "Start fresh" instead — confirm the rail comes back empty and `sessions.json`'s next save
   reflects that.
7. Toggle the theme (as in the prior plan) and confirm the rail, tabs, and dialog all pick up the
   new theme's colors correctly — not just the titlebar/terminal.

Report exactly what you observed at each step, including anything you could not verify due to
environment limitations (native dialog interaction, git branch on a real repo, etc.) — do not
claim to have seen something you couldn't.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire multi-session rail, persistence, and new-session picker into App

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Verification (end of plan)

- `npm run test` — 13/13 tests pass: the prior plan's 5 (`resolveShell` ×4, `nextTheme` ×1) plus
  this plan's 8 (`parseSessionsFile` ×4, `formatElapsed` ×4). Confirm the actual count in the test
  runner's own output rather than trusting this arithmetic.
- `npm run typecheck` — zero errors.
- `npm run build` — succeeds, produces `out/`.
- Full manual walkthrough from Task 8 Step 4 passes: create multiple sessions, switch between them
  without losing scrollback/PTY state, close a tab, quit and relaunch to see the resume banner,
  resume successfully, and (on a second relaunch) discard successfully.
- Theme cycling still works correctly across the new rail/dialog components, not just the
  previously-existing titlebar/terminal.

## Out of scope for this plan (see `docs/design.md` build order, Steps 5–8)

- Status detection (Tier 1 heuristic + Tier 2 hook adapters) and any status glyph/sort/pulsing
  edge bar in the rail.
- Real per-agent conversation resume bound to the agent's own session id (Claude Code hooks, etc.).
- File explorer (chokidar), diff viewer.
- OS notifications, keyboard shortcuts (`Ctrl+1..9`, jump-to-next-red), drag-to-reorder tabs.
- Packaging (`electron-builder`) for distribution.
