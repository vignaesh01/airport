# Airport — multi-agent terminal desktop app

## Context

You hold subscriptions to several coding agents (Claude Code, Gemini CLI, Codex, Devin) and drive
all of them from terminals. Today that means a pile of terminal windows or tabs with no way to tell,
at a glance, which agent is blocked on you, which is still grinding, and which finished ten minutes
ago. Attention is the scarce resource, and the terminal gives you no signal for it.

Airport is a cross-platform desktop app that runs each agent in its own PTY, lays the sessions out as
a **vertical tab rail** annotated with folder / agent / git branch / session, and gives every tab a
**traffic-light status** so the rail becomes a work queue: red tabs want you, yellow tabs don't, green
tabs have output to review. A file panel and diff viewer next to the terminal let you read what the
agent actually changed without leaving the app.

`C:\Projects\VS Code Workspaces\airport` is empty — this is greenfield, no existing code to follow.

**This pass delivers:** a clickable HTML mockup you can open and click through, plus the architecture
below as the build path. Plan mode blocks writing anything but this file, so the mockup gets built as
step 1 immediately after approval.

---

## The hard part: status detection

Vertical tabs, folder names, git branches and a file tree are ordinary work. The red/yellow/green
indicator is the only feature that cannot be solved by a UI decision, and it drives the architecture.
Everything else is arranged around it.

**Semantics (confirmed):**

| State | Meaning | Glyph |
|---|---|---|
| 🔴 Red — *needs you* | Agent is blocked on human input: a question, **or** a tool-permission prompt | `▲` + pulsing left edge bar |
| 🟡 Yellow — *working* | Agent is thinking or running tools; no action available to you | `◐` (animated) |
| 🟢 Green — *done* | Agent finished its turn and is idle, awaiting a new instruction | `✓` |
| ⚪ Grey — *exited* | Process terminated; shell is dead or back at a bare prompt | `○` |

Colour is never the only encoding — each state carries a distinct glyph and the red state also
animates its edge bar, so the rail stays readable for colourblind users and in a screenshot.

### Two-tier detection

A per-session `StatusEngine` consumes events from two sources and takes the higher-confidence one:

**Tier 1 — heuristic floor (works for *any* command, including plain shells).**
Every adapter inherits this; it alone yields a usable app on day one.

- output written in the last ~400 ms → **yellow**
- quiet ≥ ~800 ms **and** the trailing line has no newline and matches a prompt shape
  (`>`, `❯`, `?`, `(y/n)`, `[1] Yes`, a boxed input caret) → **red**
- quiet ≥ ~1.5 s otherwise → **green**
- PTY exit → **grey**

Caveat to handle explicitly: most of these agents paint a full-screen TUI (alternate screen buffer),
so raw-byte heuristics get noisy. The analyzer strips ANSI, tracks alt-screen enter/leave (`?1049h/l`),
and matches against the *rendered last line* from the xterm.js buffer rather than the raw stream.

**Tier 2 — high-fidelity agent signals (per-agent, opt-in, verified not assumed).**
Airport runs a loopback HTTP listener on `127.0.0.1:<random>` and injects
`AIRPORT_URL` + `AIRPORT_TOKEN` + `AIRPORT_TAB` into each PTY's environment. An agent that can call
out reports state transitions directly, which beats any regex.

- **Claude Code** ships a hooks system that looks like an exact fit — a `Notification`-class event when
  it needs input/permission (→ red), a `Stop`-class event at end of turn (→ green), and prompt/tool
  events (→ yellow). **Verify the current event names and payloads with the `claude-code-guide` agent
  during implementation** rather than trusting this from memory; wire the hooks into a generated
  settings block Airport manages.
- **Gemini CLI / Codex / Devin:** check each for an equivalent hook, event-stream, or non-interactive
  JSON mode. Where none exists, that adapter simply runs on the Tier 1 floor. No parity assumed.

Adapters are **config-driven** (`agents.json`: display name, launch command, colour, icon, prompt
regexes, hook strategy), so adding a fifth agent is a config edit, not a code change.

### How Airport knows which agent a tab is running

The app launches it. "New tab" opens a picker — folder + agent + optional session to resume — and that
selection binds the adapter. Sniffing the foreground process is flaky and is used only as a fallback
label for tabs opened as a generic shell.

---

## UI design

### Layout — three columns

```
┌────────────────────┬──────────────────────────────────────────┬──────────────────────┐
│ SESSIONS      2 ▲  │  airport · claude · main                 │ EXPLORER      ⟳      │
│ ─────────────────  │ ──────────────────────────────────────── │ ──────────────────── │
│ ▲ airport          │                                          │ ▾ airport            │
│   claude ⑂ main    │   ● Analysing the PTY layer…             │   ▾ src              │
│   refactor-auth 2m │                                          │     main.ts        M │
│ ─────────────────  │   Allow  Bash(npm test)?                 │     tabs.tsx       + │
│ ◐ api-service      │   ❯ 1. Yes   2. No                       │     status.ts        │
│   codex ⑂ feat/pay │                                          │   ▾ design           │
│   thread-8fa2  14s │                                          │     mockup.html    + │
│ ─────────────────  │                                          │   package.json     M │
│ ✓ web-ui           │                                          │ ──────────────────── │
│   gemini ⑂ main    │                                          │  3 changed · 2m ago  │
│   sess-11c9    6m  │                                          │                      │
│ ─────────────────  │                                          │                      │
│ ○ scratch          │                                          │                      │
│   zsh   ⑂ —        │                                          │                      │
│                    │                                          │                      │
│ ＋ New session      │                                          │                      │
└────────────────────┴──────────────────────────────────────────┴──────────────────────┘
```

- **Left rail (~280 px, resizable):** the vertical tab strip. Sorted by status by default — red first,
  then yellow, green, grey — so the top of the rail is always "what needs me". Manual-order mode
  available via drag. Header shows a live count of red tabs; that count also drives the app badge.
- **Centre:** the active terminal (xterm.js), with a breadcrumb header repeating folder · agent · branch.
- **Right (~300 px, collapsible):** file explorer for that tab's workspace folder, with git status
  letters (`M`/`+`/`?`) and files the agent touched this session pushed to a pinned "Recently changed"
  group at the top — that's the fast path to reviewing an agent's work.

### Tab anatomy

Three lines, dense but scannable:

```
▲ airport                     ← status glyph + workspace folder name (bold, primary)
  claude  ⑂ main              ← agent badge (agent-coloured) + git branch
  refactor-auth          2m   ← session name + time in current state
```

- Red tabs get a 3 px pulsing left edge bar and float to the top of the rail.
- Yellow tabs animate their `◐` glyph only — no bar, no motion elsewhere; working tabs must not
  compete for attention with blocked ones.
- The whole rail is keyboard-navigable: `Ctrl+1..9` to jump, `Ctrl+↓/↑` to cycle, and one binding
  worth having — **jump to next red tab** — which is the app's core loop in a single keystroke.

### Session name

Bound to the agent's own resumable handle (Claude Code session id, Codex thread, etc.), captured at
launch or scraped from the agent's session store, and displayed shortened. Airport persists it, so
relaunching the app offers **"Resume 4 sessions"** and restores each tab by re-invoking the agent with
its resume flag rather than starting cold.

### Diff viewing

Clicking a file in the explorer opens it in the centre column as a tab beside the terminal — read-only
by default, side-by-side diff against `HEAD` when the file is modified, with a toggle for unified view.
The terminal stays mounted (never unmounted, or you lose scrollback and the PTY resize state).

### Other behaviour worth designing in

- **OS notification** when a tab goes red while the app is unfocused or that tab isn't active. This is
  the payoff of the whole status system — you stop babysitting terminals.
- **Dark and light themes**, both first-class; terminal colours from a shared token set.

---

## Technology

**Electron + React + TypeScript + Vite**, with:

| Concern | Choice | Why |
|---|---|---|
| PTY | `node-pty` | The trodden path for real ConPTY support on Windows 11 + POSIX elsewhere |
| Terminal | `xterm.js` + `fit` and `webgl` addons | Standard, fast, gives a rendered-buffer API the status heuristic needs |
| File watching | `chokidar` | Cross-platform, handles Windows quirks |
| Git | `simple-git` (shell out) | Branch, status, and diff without reimplementing git |
| Diff render | `diff2html` or Monaco's diff editor | Monaco if syntax highlighting matters more than bundle size |

Tauri is lighter but would mean wiring a Rust PTY crate by hand — the project's novelty budget belongs
in status detection, not in the terminal substrate.

**Process model:** PTYs live in the Electron main process (node-pty is native and must). Renderer talks
to them over typed IPC channels. One `SessionManager` in main owns the PTY, the `StatusEngine`, the git
watcher and the file watcher per session; the renderer is a view over serialisable session state.

---

## Build order

**Step 1 — the mockup (immediately after approval).**
`design/mockup.html`, published as an Artifact so you can click it in a browser. Fully static —
no Electron, no PTY — but interactive: switchable tabs, a scripted terminal transcript per tab that
advances on a timer so you can watch statuses move through yellow → red → green, a working file tree,
and a diff view. Includes the new-session picker and both themes. Load the `artifact-design` skill
before writing it, and check the result against `web-design-guidelines`.

Once you've clicked through it and the layout is settled:

**Step 2 — Electron shell.** Vite + React + TS scaffold, main/renderer split, typed IPC, dark/light
tokens lifted from the approved mockup.

**Step 3 — one real terminal.** node-pty + xterm.js, resize wiring, scrollback, correct ConPTY
behaviour on Windows. Verify: run `claude` in it and hold a real conversation.

**Step 4 — sessions and the rail.** Multiple PTYs, the vertical tab component, folder/agent/branch
metadata, persistence to `userData/sessions.json`, restore-on-launch.

**Step 5 — status, tier 1.** `StatusEngine` + the heuristic analyzer over the rendered xterm buffer,
alt-screen aware. This is where the app starts being worth using.

**Step 6 — status, tier 2.** Loopback listener, env injection, Claude Code hook adapter (event names
verified via `claude-code-guide` first), then evaluate Gemini/Codex/Devin for equivalent signals.

**Step 7 — explorer and diffs.** chokidar tree, git status decoration, recently-changed group, diff view.

**Step 8 — polish.** OS notifications, keyboard shortcuts incl. jump-to-next-red, sort modes.

---

## Verification

- **Mockup:** open the published Artifact; confirm the rail reads correctly at a glance, statuses
  animate, tabs switch, the diff opens, and both themes hold up. Colourblind check: statuses must stay
  distinguishable in greyscale.
- **Terminal fidelity (step 3):** run a real `claude` session end to end in the app — full TUI, resize
  mid-turn, Ctrl+C, scrollback intact. If ConPTY is wrong, everything downstream is wrong.
- **Status accuracy (steps 5–6):** run a scripted agent session that deliberately asks a question, runs
  a long tool, and finishes. Assert the tab passes yellow → red → green with the right timing, on both
  Windows and one POSIX platform. Unit-test the analyzer against captured PTY byte streams — record real
  output from each agent once and replay it, so this is testable without launching agents in CI.
- **Multi-session:** four tabs on four folders, four different agents, simultaneously. Watch for PTY
  starvation, renderer jank, and stale git branch data after a checkout.
