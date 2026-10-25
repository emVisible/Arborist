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
    if (process.platform === 'darwin') app.dock?.hide()

    const manager = new AppManager({ openExternal: (url) => void shell.openExternal(url) })
    void manager.init().then(() => {
      registerIpc(manager)
      const tray = new TrayController(manager)
      tray.start()

      startApiServer(manager, manager.apiPort, join(__dirname, '../../resources/portal/index.html'))
        .then((api) => console.log(`[arborist] api + portal: http://127.0.0.1:${api.port}`))
        .catch((e) => console.warn(`[arborist] api/门户已禁用（端口不可用）：${(e as Error).message}`))
    })
  })

  // resident menu-bar app: windows closing never quits
  app.on('window-all-closed', () => {})
}
