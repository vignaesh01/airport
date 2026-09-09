import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { classifyStatus, type SessionStatus } from './status-engine'

const STATUS_POLL_MS = 200

function currentLine(term: XTerm): string {
  const buf = term.buffer.active
  const line = buf.getLine(buf.cursorY + buf.baseY)
  return line ? line.translateToString(true) : ''
}

interface TerminalProps {
  folder: string
  command?: string
  shell?: string
  /** Called when the running process sets the terminal title (OSC 0/2), e.g. via `/rename` in Claude Code. */
  onTitleChange?: (title: string) => void
  /** Tier 1 heuristic status (red/yellow/green/grey), re-evaluated on a timer. */
  onStatusChange?: (status: SessionStatus) => void
  /** Terminal font size in px. Changing this resizes the existing xterm instance rather than remounting it. */
  fontSize?: number
}

export function Terminal({ folder, command, shell, onTitleChange, onStatusChange, fontSize = 13 }: TerminalProps) {
  // FitAddon only ever subtracts padding it finds on xterm's own element, never
  // on its parent — so the padding lives on this outer wrapper (purely visual,
  // never measured for sizing) while xterm mounts into the zero-padding inner
  // div, which is what FitAddon and the resize observer actually measure.
  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const onTitleChangeRef = useRef(onTitleChange)
  onTitleChangeRef.current = onTitleChange
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const outer = outerRef.current
    const container = containerRef.current
    if (!outer || !container) return

    const term = new XTerm({
      fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
      fontSize,
      theme: {
        background: '#12141b',
        foreground: '#d7dbe6'
      },
      cursorBlink: true
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    termRef.current = term
    fitAddonRef.current = fitAddon

    // Electron's default Edit-menu paste accelerator doesn't reliably reach
    // xterm's hidden textarea, so Ctrl/Cmd+V is handled explicitly via the
    // main process clipboard instead of relying on a native paste event.
    term.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown' && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        window.airport.readClipboardText().then((text) => {
          if (text) term.paste(text)
        })
        return false
      }
      return true
    })

    term.open(container)
    fitAddon.fit()

    let disposeData: (() => void) | undefined
    let disposeExit: (() => void) | undefined
    let cancelled = false

    let lastOutputAt: number | null = null
    let exited = false
    let lastReportedStatus: SessionStatus | null = null

    const reportStatus = (): void => {
      const status = classifyStatus({
        exited,
        now: Date.now(),
        lastOutputAt,
        lastLine: currentLine(term)
      })
      if (status !== lastReportedStatus) {
        lastReportedStatus = status
        onStatusChangeRef.current?.(status)
      }
    }

    term.onData((data) => {
      if (sessionIdRef.current) window.airport.write(sessionIdRef.current, data)
    })

    const titleDisposable = term.onTitleChange((title) => {
      if (title.trim()) onTitleChangeRef.current?.(title)
    })

    window.airport
      .createSession({ cols: term.cols, rows: term.rows, cwd: folder, shellPath: command, shell })
      .then(({ sessionId }) => {
        if (cancelled) {
          window.airport.dispose(sessionId)
          return
        }
        sessionIdRef.current = sessionId
        disposeData = window.airport.onData(sessionId, (chunk) => {
          lastOutputAt = Date.now()
          term.write(chunk)
          reportStatus()
        })
        disposeExit = window.airport.onExit(sessionId, (code) => {
          exited = true
          term.write(`\r\n\x1b[2m[process exited: ${code}]\x1b[0m\r\n`)
          reportStatus()
        })
      })
      .catch((err) => {
        term.write(
          `\r\n\x1b[31m[failed to start session: ${err instanceof Error ? err.message : String(err)}]\x1b[0m\r\n`
        )
      })

    const statusInterval = setInterval(reportStatus, STATUS_POLL_MS)

    document.fonts.ready.then(() => {
      fitAddon.fit()
      if (sessionIdRef.current) {
        window.airport.resize(sessionIdRef.current, term.cols, term.rows)
      }
    })

    const handleResize = (): void => {
      fitAddon.fit()
      if (sessionIdRef.current) {
        window.airport.resize(sessionIdRef.current, term.cols, term.rows)
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(outer)

    return () => {
      cancelled = true
      clearInterval(statusInterval)
      resizeObserver.disconnect()
      disposeData?.()
      disposeExit?.()
      titleDisposable.dispose()
      if (sessionIdRef.current) window.airport.dispose(sessionIdRef.current)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
    // fontSize intentionally omitted: it's only the initial value here, live
    // changes are applied by the effect below without remounting the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, command, shell])

  useEffect(() => {
    const term = termRef.current
    const fitAddon = fitAddonRef.current
    if (!term || !fitAddon) return
    if (term.options.fontSize === fontSize) return
    term.options.fontSize = fontSize
    fitAddon.fit()
    if (sessionIdRef.current) {
      window.airport.resize(sessionIdRef.current, term.cols, term.rows)
    }
  }, [fontSize])

  return (
    <div
      ref={outerRef}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '16px 20px 24px',
        background: '#12141b'
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
