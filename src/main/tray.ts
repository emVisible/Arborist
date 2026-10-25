import { BrowserWindow, Menu, Tray, screen, shell } from 'electron'
import { join } from 'node:path'
import { createPanelWindow } from './window'
import type { AppManager } from './core/manager'

export class TrayController {
  private tray: Tray | null = null
  private panel: BrowserWindow | null = null
  private portalUrl: string | null = null

  constructor(private manager: AppManager) {}

  setPortalUrl(url: string | null): void {
    this.portalUrl = url
  }

  start(): void {
    this.tray = new Tray(join(__dirname, '../../resources/tray/iconTemplate.png'))
    this.tray.setToolTip('Arborist')
    this.panel = createPanelWindow()

    this.tray.on('click', () => this.togglePanel())
    this.tray.on('right-click', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: '重扫注册表', click: () => void this.manager.rescan() }
      ]
      if (this.portalUrl) {
        template.push({
          label: '打开门户',
          click: () => void shell.openExternal(this.portalUrl!)
        })
      }
      template.push({ type: 'separator' }, { label: '退出 Arborist', role: 'quit' })
      this.tray?.popUpContextMenu(Menu.buildFromTemplate(template))
    })
  }

  private togglePanel(): void {
    const panel = this.panel
    const tray = this.tray
    if (!panel || !tray) return

    if (panel.isVisible()) {
      panel.hide()
      return
    }

    const trayBounds = tray.getBounds()
    const winBounds = panel.getBounds()
    const area = screen.getDisplayMatching(trayBounds).workArea
    let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
    x = Math.min(Math.max(x, area.x + 4), area.x + area.width - winBounds.width - 4)
    const below = trayBounds.y + trayBounds.height + 5
    const y =
      below + winBounds.height <= area.y + area.height
        ? below
        : trayBounds.y - winBounds.height - 5

    panel.setPosition(x, y, false)
    panel.show()
    panel.focus()
  }
}
