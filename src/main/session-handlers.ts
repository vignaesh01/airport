import { ipcMain, BrowserWindow } from 'electron'
import { SESSION_CHANNELS, EXPLORER_CHANNELS, SHELL_CHANNELS } from '../shared/ipc'
import type { SessionsFile } from '../shared/session'
import { loadSessionsFile, saveSessionsFile } from './sessions-store'
import { browseForFolder } from './dialog'
import { getBranch } from './git'
import { readExplorerTree, readFileDiff, readFileContent, readImageDataUrl, writeFileContent } from './explorer'
import { listShells } from './shells'

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

  ipcMain.handle(EXPLORER_CHANNELS.tree, (_event, folder: string) => {
    return readExplorerTree(folder)
  })

  ipcMain.handle(EXPLORER_CHANNELS.diff, (_event, folder: string, relPath: string) => {
    return readFileDiff(folder, relPath)
  })

  ipcMain.handle(EXPLORER_CHANNELS.readFile, (_event, folder: string, relPath: string) => {
    return readFileContent(folder, relPath)
  })

  ipcMain.handle(EXPLORER_CHANNELS.readImage, (_event, folder: string, relPath: string) => {
    return readImageDataUrl(folder, relPath)
  })

  ipcMain.handle(EXPLORER_CHANNELS.writeFile, (_event, folder: string, relPath: string, content: string) => {
    return writeFileContent(folder, relPath, content)
  })

  ipcMain.handle(SHELL_CHANNELS.list, () => listShells())
}
