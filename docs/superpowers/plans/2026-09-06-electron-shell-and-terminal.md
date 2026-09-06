# Electron Shell & Real Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Electron + React + TypeScript app shell and get one real terminal (node-pty + xterm.js) running inside it, so you can hold an actual `claude` conversation in the app.

**Architecture:** `electron-vite` scaffolds three build targets — main, preload, renderer. PTYs are owned entirely by the Electron main process (`src/main/pty-manager.ts`); the renderer never touches `node-pty` directly, only a typed `window.airport` API exposed through a `contextBridge` preload script, talking over IPC channels defined once in `src/shared/ipc.ts` so main/preload/renderer can't drift out of sync. The renderer is a three-column shell (session rail / terminal / explorer) matching `design/mockup.html`, with the rail and explorer as placeholders for later plans and the center column holding a real `xterm.js` terminal wired to the IPC layer.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, node-pty, `@xterm/xterm` + `@xterm/addon-fit`, Vitest.

**Spec:** `docs/design.md` (Technology, Process model, and Build order sections)

## Global Constraints

- Target platforms: Windows 11 (primary dev machine), macOS, Linux — ConPTY must behave correctly on Windows (`docs/design.md` → Technology).
- Stack is Electron + React + TypeScript + Vite via `electron-vite`, `node-pty`, `@xterm/xterm` (`docs/design.md` → Technology table).
- PTYs live only in the Electron main process; the renderer talks to them exclusively over typed IPC via a `contextBridge` preload — never direct `node-pty` access from the renderer (`docs/design.md` → Process model).
- `node-pty` is a native module and must be rebuilt against Electron's Node ABI, not the system Node's, via `@electron/rebuild`.
- UI typefaces: `Manrope` for chrome/labels, `IBM Plex Mono` for terminal and any tabular/data text — match `design/mockup.html` exactly.
- Theme has three states: system (root has no `data-theme`), explicit light (`data-theme="light"`), explicit dark (`data-theme="dark"`) — token structure must match the approved mockup.

---

## File Structure

```
airport/
├── package.json
├── tsconfig.json                    # project-reference root
├── tsconfig.node.json               # main + preload (node types)
├── tsconfig.web.json                # renderer (DOM types)
├── vitest.config.ts
├── electron.vite.config.ts
├── .gitignore
├── src/
│   ├── shared/
│   │   └── ipc.ts                   # IPC channel names + shared types (main/preload/renderer all import this)
│   ├── main/
│   │   ├── index.ts                 # Electron entry, creates BrowserWindow
│   │   ├── pty-manager.ts           # owns node-pty sessions, registers ipcMain handlers
│   │   └── pty-manager.test.ts
│   ├── preload/
│   │   └── index.ts                 # contextBridge: exposes window.airport
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx             # React entry
│           ├── App.tsx              # three-column shell
│           ├── Terminal.tsx         # xterm.js wired to window.airport
│           ├── theme.ts             # theme cycle logic
│           ├── theme.test.ts
│           ├── theme.css            # design tokens, ported from design/mockup.html
│           └── env.d.ts             # declares window.airport for TS
```

Each file has one job: `shared/ipc.ts` is the single source of truth both processes compile against, so a channel name typo or type mismatch is a compile error, not a runtime surprise.

---

## Task 1: Repo & build scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `electron.vite.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx` (placeholder content, replaced in later tasks)

**Interfaces:**
- Produces: a working `npm run dev` that opens an Electron window, and `npm run test` that runs Vitest. Later tasks build on this.

- [ ] **Step 1: Initialize git and add `.gitignore`**

```bash
git init
```

```gitignore
node_modules/
out/
dist/
*.log
.DS_Store
```

- [ ] **Step 2: `npm init` and install dependencies**

```bash
npm init -y
npm install react react-dom
npm install -D electron electron-vite vite @vitejs/plugin-react typescript \
  @types/react @types/react-dom @electron-toolkit/tsconfig @electron-toolkit/utils \
  @electron-toolkit/preload vitest
npm install node-pty
npm install -D @electron/rebuild
```

- [ ] **Step 3: Add npm scripts to `package.json`**

Edit the generated `package.json`, set `"main": "./out/main/index.js"` and add:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "postinstall": "electron-rebuild -f -w node-pty"
  }
}
```

Run `npm run postinstall` once manually now (it won't have fired on the installs above since the script didn't exist yet):

```bash
npx electron-rebuild -f -w node-pty
```

Expected: completes without error, prints something like `Rebuild Complete`.

- [ ] **Step 4: Write `electron.vite.config.ts`**

```ts
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 5: Write the TypeScript project references**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.node.json",
  "include": [
    "electron.vite.config.ts",
    "src/main/**/*",
    "src/preload/**/*",
    "src/shared/**/*"
  ],
  "compilerOptions": {
    "composite": true,
    "types": ["electron-vite/node"]
  }
}
```

`tsconfig.web.json`:

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": ["src/renderer/src/**/*", "src/shared/**/*"],
  "compilerOptions": {
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

- [ ] **Step 6: Write placeholder main, preload, and renderer entry files**

`src/main/index.ts`:

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.airport.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

`src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
}
```

`src/renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Airport</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/renderer/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/App.tsx` (placeholder, replaced in Task 5):

```tsx
function App() {
  return <div>Airport</div>
}

export default App
```

- [ ] **Step 7: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
```

- [ ] **Step 8: Verify the dev window opens**

```bash
npm run dev
```

Expected: an Electron window opens showing "Airport" in the top-left. Close it and stop the process (`Ctrl+C`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + typescript shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 2: Shared IPC contract

**Files:**
- Create: `src/shared/ipc.ts`

**Interfaces:**
- Consumes: nothing (this is the shared contract everything else consumes).
- Produces: `PTY_CHANNELS` (channel name constants), `CreateSessionOptions`, `CreateSessionResult`, `AirportApi` — the preload (Task 3), main process (Task 4), and renderer (Task 5) all import these so a signature change anywhere is a compile error everywhere else.

This task has no independent unit to test — it's pure type/constant declarations with no logic. It's verified by Tasks 3–5 compiling against it.

- [ ] **Step 1: Write `src/shared/ipc.ts`**

```ts
export const PTY_CHANNELS = {
  create: 'pty:create',
  write: 'pty:write',
  resize: 'pty:resize',
  dispose: 'pty:dispose',
  data: 'pty:data',
  exit: 'pty:exit'
} as const

export interface CreateSessionOptions {
  /** Working directory for the shell. Defaults to the user's home directory when omitted. */
  cwd?: string
  /** Override the shell/agent command to launch. Defaults to the platform shell. */
  shellPath?: string
  cols: number
  rows: number
}

export interface CreateSessionResult {
  sessionId: string
}

export interface AirportApi {
  createSession(options: CreateSessionOptions): Promise<CreateSessionResult>
  write(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void
  dispose(sessionId: string): void
  onData(sessionId: string, callback: (chunk: string) => void): () => void
  onExit(sessionId: string, callback: (exitCode: number) => void): () => void
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: define shared IPC contract for pty sessions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 3: PTY session manager (main process)

**Files:**
- Create: `src/main/pty-manager.ts`
- Test: `src/main/pty-manager.test.ts`
- Modify: `src/main/index.ts` (call `registerPtyHandlers`)

**Interfaces:**
- Consumes: `PTY_CHANNELS`, `CreateSessionOptions` from `src/shared/ipc.ts` (Task 2).
- Produces: `resolveShell(platform, env)` (pure, unit-tested below) and `registerPtyHandlers(window: BrowserWindow): void`, called once from `src/main/index.ts`. Later plans (session rail) will extend this file to support multiple concurrent windows/sessions with per-session metadata — out of scope here, where there's exactly one implicit session at a time.

- [ ] **Step 1: Write the failing test for `resolveShell`**

`src/main/pty-manager.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveShell } from './pty-manager'

describe('resolveShell', () => {
  it('uses COMSPEC on win32 when set', () => {
    expect(resolveShell('win32', { COMSPEC: 'C:\\Windows\\System32\\cmd.exe' })).toBe(
      'C:\\Windows\\System32\\cmd.exe'
    )
  })

  it('falls back to powershell.exe on win32 when COMSPEC is unset', () => {
    expect(resolveShell('win32', {})).toBe('powershell.exe')
  })

  it('uses SHELL on posix when set', () => {
    expect(resolveShell('darwin', { SHELL: '/bin/zsh' })).toBe('/bin/zsh')
  })

  it('falls back to /bin/bash on posix when SHELL is unset', () => {
    expect(resolveShell('linux', {})).toBe('/bin/bash')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/main/pty-manager.test.ts
```

Expected: FAIL — `Cannot find module './pty-manager'` (the file doesn't exist yet).

- [ ] **Step 3: Write `src/main/pty-manager.ts`**

```ts
import { ipcMain, type BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { PTY_CHANNELS, type CreateSessionOptions } from '../shared/ipc'

export function resolveShell(
  platform: NodeJS.Platform,
  env: Partial<NodeJS.ProcessEnv>
): string {
  if (platform === 'win32') {
    return env.COMSPEC || 'powershell.exe'
  }
  return env.SHELL || '/bin/bash'
}

const sessions = new Map<string, pty.IPty>()

export function registerPtyHandlers(window: BrowserWindow): void {
  ipcMain.handle(PTY_CHANNELS.create, (_event, options: CreateSessionOptions) => {
    const sessionId = randomUUID()
    const shellPath = options.shellPath ?? resolveShell(process.platform, process.env)

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd || homedir(),
      env: process.env as Record<string, string>
    })

    ptyProcess.onData((chunk) => {
      window.webContents.send(PTY_CHANNELS.data, sessionId, chunk)
    })

    ptyProcess.onExit(({ exitCode }) => {
      window.webContents.send(PTY_CHANNELS.exit, sessionId, exitCode)
      sessions.delete(sessionId)
    })

    sessions.set(sessionId, ptyProcess)
    return { sessionId }
  })

  ipcMain.on(PTY_CHANNELS.write, (_event, sessionId: string, data: string) => {
    sessions.get(sessionId)?.write(data)
  })

  ipcMain.on(PTY_CHANNELS.resize, (_event, sessionId: string, cols: number, rows: number) => {
    sessions.get(sessionId)?.resize(cols, rows)
  })

  ipcMain.on(PTY_CHANNELS.dispose, (_event, sessionId: string) => {
    sessions.get(sessionId)?.kill()
    sessions.delete(sessionId)
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/main/pty-manager.test.ts
```

Expected: PASS — all 4 assertions green.

- [ ] **Step 5: Wire `registerPtyHandlers` into `src/main/index.ts`**

Add the import and call it after the window is created:

```ts
import { registerPtyHandlers } from './pty-manager'
```

Inside `createWindow()`, after `mainWindow.loadFile(...)` / `mainWindow.loadURL(...)` block:

```ts
  registerPtyHandlers(mainWindow)
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add pty session manager in main process

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 4: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/env.d.ts`

**Interfaces:**
- Consumes: `AirportApi`, `PTY_CHANNELS` from `src/shared/ipc.ts` (Task 2).
- Produces: `window.airport` in the renderer, typed via `AirportApi`. Task 5's `Terminal.tsx` is the consumer.

This task is IPC glue with no meaningful unit boundary to test in isolation — the real verification is Task 5's manual end-to-end check (typing into the terminal and seeing shell output). No test step here.

- [ ] **Step 1: Rewrite `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { PTY_CHANNELS, type AirportApi } from '../shared/ipc'

const airportApi: AirportApi = {
  createSession: (options) => ipcRenderer.invoke(PTY_CHANNELS.create, options),
  write: (sessionId, data) => ipcRenderer.send(PTY_CHANNELS.write, sessionId, data),
  resize: (sessionId, cols, rows) => ipcRenderer.send(PTY_CHANNELS.resize, sessionId, cols, rows),
  dispose: (sessionId) => ipcRenderer.send(PTY_CHANNELS.dispose, sessionId),
  onData: (sessionId, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string, chunk: string): void => {
      if (id === sessionId) callback(chunk)
    }
    ipcRenderer.on(PTY_CHANNELS.data, listener)
    return () => ipcRenderer.removeListener(PTY_CHANNELS.data, listener)
  },
  onExit: (sessionId, callback) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string, exitCode: number): void => {
      if (id === sessionId) callback(exitCode)
    }
    ipcRenderer.on(PTY_CHANNELS.exit, listener)
    return () => ipcRenderer.removeListener(PTY_CHANNELS.exit, listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('airport', airportApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.airport = airportApi
}
```

- [ ] **Step 2: Declare `window.airport` for the renderer's TypeScript**

`src/renderer/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
import type { AirportApi } from '../../shared/ipc'

declare global {
  interface Window {
    airport: AirportApi
  }
}

export {}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: expose typed airport API from preload via contextBridge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 5: xterm.js terminal wired end-to-end

**Files:**
- Create: `src/renderer/src/Terminal.tsx`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `window.airport` (Task 4).
- Produces: `<Terminal />` component, mounted once in `App.tsx`'s center column. Later plans mount one `<Terminal>` per session tab instead of a single static one.

No automated test — this task's correctness is "a real shell/agent runs and echoes input," which is what the manual verification step checks directly; a DOM/IPC integration test here would just re-assert what Tasks 3–4's tests and this step already cover, with far more setup.

- [ ] **Step 1: Install xterm packages**

```bash
npm install @xterm/xterm @xterm/addon-fit
```

- [ ] **Step 2: Write `src/renderer/src/Terminal.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm({
      fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
      fontSize: 13,
      theme: {
        background: '#12141b',
        foreground: '#d7dbe6'
      },
      cursorBlink: true
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()

    let disposeData: (() => void) | undefined
    let disposeExit: (() => void) | undefined

    window.airport.createSession({ cols: term.cols, rows: term.rows }).then(({ sessionId }) => {
      sessionIdRef.current = sessionId
      disposeData = window.airport.onData(sessionId, (chunk) => term.write(chunk))
      disposeExit = window.airport.onExit(sessionId, (code) => {
        term.write(`\r\n\x1b[2m[process exited: ${code}]\x1b[0m\r\n`)
      })
      term.onData((data) => window.airport.write(sessionId, data))
    })

    const handleResize = (): void => {
      fitAddon.fit()
      if (sessionIdRef.current) {
        window.airport.resize(sessionIdRef.current, term.cols, term.rows)
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      disposeData?.()
      disposeExit?.()
      if (sessionIdRef.current) window.airport.dispose(sessionIdRef.current)
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
```

- [ ] **Step 3: Mount it in `App.tsx`**

```tsx
import { Terminal } from './Terminal'

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <Terminal />
    </div>
  )
}

export default App
```

(Task 6 replaces this with the full three-column shell and theme tokens.)

- [ ] **Step 4: Manual verification — run a real agent in the app**

```bash
npm run dev
```

In the window that opens: the terminal should show your default shell prompt. Type `claude` and press Enter — hold a short real conversation with it. Resize the window and confirm the terminal reflows without garbling. Close the window and confirm the process exits (check Task Manager / Activity Monitor — no orphaned shell or `node-pty` helper process left running).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire xterm.js terminal to pty session over IPC

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Task 6: Design tokens & three-column shell

**Files:**
- Create: `src/renderer/src/theme.ts`
- Test: `src/renderer/src/theme.test.ts`
- Create: `src/renderer/src/theme.css`
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `<Terminal />` (Task 5).
- Produces: `nextTheme(current: ThemeMode): ThemeMode`, `applyTheme(mode: ThemeMode): void`, and the `.app` / `.titlebar` / `.main` / `.rail` / `.center` / `.explorer` CSS classes that later plans (session rail, file explorer) fill in — this task only lays out the grid and leaves `.rail` / `.explorer` as labeled placeholders.

- [ ] **Step 1: Write the failing test for the theme cycle**

`src/renderer/src/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextTheme } from './theme'

describe('nextTheme', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/renderer/src/theme.test.ts
```

Expected: FAIL — `Cannot find module './theme'`.

- [ ] **Step 3: Write `src/renderer/src/theme.ts`**

```ts
export type ThemeMode = 'system' | 'light' | 'dark'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

export function nextTheme(current: ThemeMode): ThemeMode {
  const idx = ORDER.indexOf(current)
  return ORDER[(idx + 1) % ORDER.length]
}

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/renderer/src/theme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write `src/renderer/src/theme.css`**

Ported from the approved `design/mockup.html` — same token names and values, trimmed to what the shell needs right now (titlebar, three-column grid, rail/explorer placeholders; the terminal keeps its own fixed dark palette set inline in `Terminal.tsx`, matching the mockup's `--term-*` tokens).

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #f3f4f7;
  --surface: #ffffff;
  --surface-2: #eceef3;
  --border: #d7dbe4;
  --text: #1a1e2b;
  --text-dim: #5a6274;
  --text-faint: #8991a3;
  --accent: #2f68d6;
  --accent-ink: #ffffff;
  --accent-soft: #e6edfc;
  --font-ui: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #0e1016;
    --surface: #161922;
    --surface-2: #1c2028;
    --border: #2b303c;
    --text: #e7e9f0;
    --text-dim: #9aa1b5;
    --text-faint: #666c80;
    --accent: #6fa8ff;
    --accent-ink: #0e1016;
    --accent-soft: rgba(111, 168, 255, 0.14);
  }
}

:root[data-theme='dark'] {
  --bg: #0e1016;
  --surface: #161922;
  --surface-2: #1c2028;
  --border: #2b303c;
  --text: #e7e9f0;
  --text-dim: #9aa1b5;
  --text-faint: #666c80;
  --accent: #6fa8ff;
  --accent-ink: #0e1016;
  --accent-soft: rgba(111, 168, 255, 0.14);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
}

.app {
  display: grid;
  grid-template-rows: 44px 1fr;
  height: 100vh;
}

.titlebar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.brand {
  font-weight: 800;
  font-size: 14px;
  color: var(--text);
}

.spacer {
  flex: 1;
}

.themebtn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 7px;
  cursor: pointer;
}

.themebtn:hover {
  color: var(--text);
  border-color: var(--text-faint);
}

.themebtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.main {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  min-height: 0;
}

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

.center {
  min-width: 0;
  min-height: 0;
}
```

- [ ] **Step 6: Rewrite `App.tsx` as the three-column shell**

```tsx
import { useState } from 'react'
import { Terminal } from './Terminal'
import { applyTheme, nextTheme, type ThemeMode } from './theme'
import './theme.css'

function App() {
  const [theme, setTheme] = useState<ThemeMode>('system')

  const cycleTheme = (): void => {
    const mode = nextTheme(theme)
    setTheme(mode)
    applyTheme(mode)
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
        <div className="rail">Sessions (next plan)</div>
        <div className="center">
          <Terminal />
        </div>
        <div className="explorer">Explorer (next plan)</div>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

Confirm: the window shows the titlebar with "▲ Airport" and a theme button, a real terminal fills the center column, and "Sessions (next plan)" / "Explorer (next plan)" placeholders sit either side. Click the theme button three times and confirm it cycles 🌗 → ☀️ → 🌙 → 🌗 and the background/text colors actually change on each click.

- [ ] **Step 8: Run the full test suite and type-check**

```bash
npm run test
npm run typecheck
```

Expected: both pass with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add design tokens and three-column app shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01W1ScUwjQ8u5Zk8AGBoAKix"
```

---

## Verification (end of plan)

- `npm run test` — all Vitest suites pass (`resolveShell`, `nextTheme`).
- `npm run typecheck` — no TypeScript errors across main/preload/renderer.
- `npm run dev` — window opens with the three-column shell; the center terminal runs a real shell; running `claude` in it holds a real conversation; resizing the window reflows the terminal without garbling; closing the window leaves no orphaned PTY process.
- Theme button cycles through all three states and each one visibly changes the shell's colors.

## Out of scope for this plan (see `docs/design.md` build order, Steps 4–8)

- Multiple concurrent sessions / the real vertical tab rail with folder, agent, branch, and status metadata.
- Status detection (Tier 1 heuristic + Tier 2 hook adapters).
- File explorer (chokidar) and diff viewer.
- Session persistence / resume-on-launch.
- Packaging (`electron-builder`) for distribution.
