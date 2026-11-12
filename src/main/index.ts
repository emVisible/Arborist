import { app, shell } from 'electron'
import { join } from 'node:path'
import { TrayController } from './tray'
import { registerIpc } from './ipc'
import { AppManager } from './core/manager'
import { startApiServer } from './core/httpapi'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      // 打包后是纯菜单栏应用；开发时保留 Dock 图标，否则启动看起来就是「闪一下消失」。
      if (app.isPackaged) app.dock?.hide()
      else app.dock?.setIcon(join(__dirname, '../../resources/icon.png'))
    }

    const manager = new AppManager({ openExternal: (url) => void shell.openExternal(url) })
    void manager.init().then(() => {
      registerIpc(manager)
      const tray = new TrayController(manager)
      tray.start()
      app.on('activate', () => tray.showPanel())
      if (!app.isPackaged) tray.showPanel()

      startApiServer(manager, manager.apiPort, join(__dirname, '../../resources/portal/index.html'))
        .then((api) => {
          const url = `http://127.0.0.1:${api.port}`
          console.log(`[arborist] api + portal: ${url}`)
          tray.setPortalUrl(url)
        })
        .catch((e) => {
          const message = `门户/API 未启动（端口 ${manager.apiPort} 不可用）：${(e as Error).message}`
          console.warn(`[arborist] ${message}`)
          manager.setApiError(message)
        })
    })
  })

  // resident menu-bar app: windows closing never quits
  app.on('window-all-closed', () => {})
}
