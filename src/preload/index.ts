import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { PTY_CHANNELS, SESSION_CHANNELS, type AirportApi } from '../shared/ipc'

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
  },
  loadSessions: () => ipcRenderer.invoke(SESSION_CHANNELS.load),
  saveSessions: (file) => ipcRenderer.send(SESSION_CHANNELS.save, file),
  browseFolder: () => ipcRenderer.invoke(SESSION_CHANNELS.browseFolder),
  gitBranch: (folder) => ipcRenderer.invoke(SESSION_CHANNELS.gitBranch, folder)
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
