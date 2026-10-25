import { BrowserWindow, ipcMain } from 'electron'
import type { ListResult } from '../shared/types'

export function registerIpc(): void {
  ipcMain.handle('arbor:list', (): ListResult => ({ apps: [], errors: [] }))

  ipcMain.on('arbor:panel:hide', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })

  ipcMain.on('arbor:contextmenu', () => {})
}
