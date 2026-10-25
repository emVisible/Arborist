import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

export function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 348,
    height: 468,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    vibrancy: 'under-window',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  win.on('blur', () => win.hide())
  loadRenderer(win)
  return win
}

export function createLogWindow(name: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 760,
    height: 480,
    title: `Arborist · 日志 · ${name}`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })
  win.on('closed', () => logWindows.delete(name))
  logWindows.set(name, win)
  loadRenderer(win, `logs/${name}`)
  return win
}

export const logWindows = new Map<string, BrowserWindow>()

function loadRenderer(win: BrowserWindow, hash?: string): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  const base = process.env['ELECTRON_RENDERER_URL']
  if (base) {
    void win.loadURL(hash ? `${base}#/${hash}` : base)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}
