import { BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { AppManager } from './core/manager'
import type { UpdateEvent } from '../shared/types'
import { createLogWindow, logWindows } from './window'

function openLog(name: string): void {
  const existing = logWindows.get(name)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }
  createLogWindow(name)
}

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
  ipcMain.handle('arbor:logs:tail', (_e, name: string, lines: number) =>
    manager.tail(name, lines)
  )
  ipcMain.handle('arbor:logs:open', (_e, name: string) => openLog(name))

  ipcMain.on('arbor:panel:hide', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })

  ipcMain.on('arbor:contextmenu', (event, name: string) => {
    const m = manager.get(name)
    if (!m) return
    const state = manager.list().apps.find((a) => a.name === name)?.state ?? 'stopped'

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '启动',
        enabled: m.type === 'web' && ['stopped', 'error', 'blocked'].includes(state),
        click: () => void manager.start(name)
      },
      {
        label: '停止',
        enabled: m.type === 'web' && ['running', 'degraded', 'error', 'starting'].includes(state),
        click: () => void manager.stop(name)
      },
      { label: '打开', click: () => manager.open(name) },
      {
        label: '日志',
        enabled: m.type === 'web',
        click: () => openLog(name)
      },
      { type: 'separator' },
      {
        label: '在 Finder 中显示',
        click: () => shell.showItemInFolder(join(m.repoDir, 'app.toml'))
      }
    ]
    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(event.sender) ?? undefined
    })
  })
}
