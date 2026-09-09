interface PanelResizerProps {
  ariaLabel: string
  /** Called with the pixel delta since the previous move/keypress. Positive = right. */
  onDrag: (deltaX: number) => void
}

const KEY_STEP = 16

export function PanelResizer({ ariaLabel, onDrag }: PanelResizerProps) {
  const onMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    let lastX = e.clientX
    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - lastX
      lastX = ev.clientX
      if (delta !== 0) onDrag(delta)
    }
    const handleUp = (): void => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowLeft') onDrag(-KEY_STEP)
    else if (e.key === 'ArrowRight') onDrag(KEY_STEP)
  }

  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    />
  )
}
