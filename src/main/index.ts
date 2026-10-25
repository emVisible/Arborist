import { app } from 'electron'
import { TrayController } from './tray'
import { registerIpc } from './ipc'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide()

    registerIpc()
    const tray = new TrayController()
    tray.start()
  })

  // resident menu-bar app: windows closing never quits
  app.on('window-all-closed', () => {})
}
