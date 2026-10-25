import { contextBridge, ipcRenderer } from 'electron'
import type { ListResult, UpdateEvent } from '../shared/types'

contextBridge.exposeInMainWorld('arbor', {
  list: (): Promise<ListResult> => ipcRenderer.invoke('arbor:list'),
  rescan: (): Promise<ListResult> => ipcRenderer.invoke('arbor:rescan'),
  start: (name: string): Promise<void> => ipcRenderer.invoke('arbor:start', name),
  stop: (name: string): Promise<void> => ipcRenderer.invoke('arbor:stop', name),
  open: (name: string): Promise<void> => ipcRenderer.invoke('arbor:open', name),
  reveal: (name: string): Promise<void> => ipcRenderer.invoke('arbor:reveal', name),
  tail: (name: string, lines: number): Promise<string> =>
    ipcRenderer.invoke('arbor:logs:tail', name, lines),
  openLogs: (name: string): Promise<void> => ipcRenderer.invoke('arbor:logs:open', name),
  loginGet: (name: string): Promise<boolean | null> =>
    ipcRenderer.invoke('arbor:login:get', name),
  loginSet: (name: string, on: boolean): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke('arbor:login:set', name, on),
  selfLoginGet: (): Promise<boolean> => ipcRenderer.invoke('arbor:self-login:get'),
  selfLoginSet: (on: boolean): Promise<void> => ipcRenderer.invoke('arbor:self-login:set', on),
  openConfig: (): Promise<void> => ipcRenderer.invoke('arbor:config:open'),
  openLoginSettings: (): Promise<void> => ipcRenderer.invoke('arbor:login:settings'),
  contextMenu: (name: string, extras?: { loginChecked?: boolean }): void =>
    ipcRenderer.send('arbor:contextmenu', name, extras),
  hidePanel: (): void => ipcRenderer.send('arbor:panel:hide'),
  onEvent: (cb: (e: UpdateEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: UpdateEvent): void => cb(payload)
    ipcRenderer.on('arbor:event', listener)
    return () => ipcRenderer.removeListener('arbor:event', listener)
  },
  onRefresh: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('arbor:refresh', listener)
    return () => ipcRenderer.removeListener('arbor:refresh', listener)
  }
})
