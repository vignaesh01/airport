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
