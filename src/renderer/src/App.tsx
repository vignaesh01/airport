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
