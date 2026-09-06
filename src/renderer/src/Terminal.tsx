import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  folder: string
  command?: string
}

export function Terminal({ folder, command }: TerminalProps) {
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
    let cancelled = false

    term.onData((data) => {
      if (sessionIdRef.current) window.airport.write(sessionIdRef.current, data)
    })

    window.airport
      .createSession({ cols: term.cols, rows: term.rows, cwd: folder, shellPath: command })
      .then(({ sessionId }) => {
        if (cancelled) {
          window.airport.dispose(sessionId)
          return
        }
        sessionIdRef.current = sessionId
        disposeData = window.airport.onData(sessionId, (chunk) => term.write(chunk))
        disposeExit = window.airport.onExit(sessionId, (code) => {
          term.write(`\r\n\x1b[2m[process exited: ${code}]\x1b[0m\r\n`)
        })
      })
      .catch((err) => {
        term.write(
          `\r\n\x1b[31m[failed to start session: ${err instanceof Error ? err.message : String(err)}]\x1b[0m\r\n`
        )
      })

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
    resizeObserver.observe(container)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      disposeData?.()
      disposeExit?.()
      if (sessionIdRef.current) window.airport.dispose(sessionIdRef.current)
      term.dispose()
    }
  }, [folder, command])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
