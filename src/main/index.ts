import { app } from 'electron'
import { TrayController } from './tray'
import { registerIpc } from './ipc'
import { AppManager } from './core/manager'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide()

    const manager = new AppManager()
    void manager.init().then(() => {
      registerIpc(manager)
      const tray = new TrayController(manager)
      tray.start()
    })
  })

  // resident menu-bar app: windows closing never quits
  app.on('window-all-closed', () => {})
}
