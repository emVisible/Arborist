import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { AppManager } from './core/manager'
import type { UpdateEvent } from '../shared/types'

export function registerIpc(manager: AppManager): void {
  const broadcast = (channel: string, payload?: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
  }

  manager.on('update', (e: UpdateEvent) => broadcast('arbor:event', e))
  manager.on('refresh', () => broadcast('arbor:refresh'))

  ipcMain.handle('arbor:list', () => manager.list())
  ipcMain.handle('arbor:rescan', () => manager.rescan())
  ipcMain.handle('arbor:config:open', () => manager.openConfig())
  ipcMain.handle('arbor:start', (_e, name: string) => manager.start(name))
  ipcMain.handle('arbor:stop', (_e, name: string) => manager.stop(name))
  ipcMain.handle('arbor:open', (_e, name: string) => manager.open(name))
  ipcMain.handle('arbor:reveal', (_e, name: string) => {
    const m = manager.get(name)
    if (m) shell.showItemInFolder(join(m.repoDir, 'app.toml'))
  })

  ipcMain.on('arbor:panel:hide', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })

  ipcMain.on('arbor:contextmenu', () => {})
}
