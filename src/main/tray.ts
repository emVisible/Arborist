import { BrowserWindow, Menu, Tray, nativeImage, screen, shell } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'node:path'
import { createPanelWindow } from './window'
import type { AppManager } from './core/manager'

function loadTrayImage(base: string, template: boolean): NativeImage {
  const dir = join(__dirname, '../../resources/tray')
  const img = nativeImage.createFromPath(join(dir, `${base}.png`))
  const img2 = nativeImage.createFromPath(join(dir, `${base}@2x.png`))
  if (!img2.isEmpty()) {
    const size = img2.getSize()
    img.addRepresentation({ scaleFactor: 2, buffer: img2.toPNG(), width: size.width, height: size.height })
  }
  img.setTemplateImage(template)
  return img
}

export class TrayController {
  private tray: Tray | null = null
  private panel: BrowserWindow | null = null
  private portalUrl: string | null = null
  private normalIcon: NativeImage | null = null
  private alertIcon: NativeImage | null = null
  private alertShown = false

  constructor(private manager: AppManager) {}

  setPortalUrl(url: string | null): void {
    this.portalUrl = url
  }

  start(): void {
    this.normalIcon = loadTrayImage('iconTemplate', true)
    this.alertIcon = loadTrayImage('iconAlert', false)
    this.tray = new Tray(this.normalIcon)
    this.tray.setToolTip('Arborist')
    this.panel = createPanelWindow()

    this.manager.on('update', () => this.refreshAlert())
    this.manager.on('refresh', () => this.refreshAlert())
    this.refreshAlert()

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

  // 任一 app 进入 error 时托盘切红点告警，恢复后切回
  private refreshAlert(): void {
    if (!this.tray) return
    const hasError = this.manager.list().apps.some((a) => a.state === 'error')
    if (hasError === this.alertShown) return
    this.alertShown = hasError
    this.tray.setImage(hasError ? this.alertIcon! : this.normalIcon!)
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
