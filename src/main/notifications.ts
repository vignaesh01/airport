import { BrowserWindow, Notification, ipcMain } from 'electron'
import { NOTIFICATION_CHANNELS, type NotifyOptions } from '../shared/ipc'

export function registerNotificationHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.on(NOTIFICATION_CHANNELS.show, (_event, options: NotifyOptions) => {
    if (!Notification.isSupported()) return

    const notification = new Notification({ title: options.title, body: options.body })
    notification.on('click', () => {
      const win = getWindow()
      if (!win || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send(NOTIFICATION_CHANNELS.clicked, options.sessionId)
    })
    notification.show()
  })
}
