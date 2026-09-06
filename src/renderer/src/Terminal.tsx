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
