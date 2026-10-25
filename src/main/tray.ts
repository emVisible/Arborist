import { BrowserWindow, Menu, Tray, screen } from 'electron'
import { join } from 'node:path'
import { createPanelWindow } from './window'

export class TrayController {
  private tray: Tray | null = null
  private panel: BrowserWindow | null = null

  start(): void {
    this.tray = new Tray(join(__dirname, '../../resources/tray/iconTemplate.png'))
    this.tray.setToolTip('Arborist')
    this.panel = createPanelWindow()

    this.tray.on('click', () => this.togglePanel())
    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu(
        Menu.buildFromTemplate([{ label: '退出 Arborist', role: 'quit' }])
      )
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
