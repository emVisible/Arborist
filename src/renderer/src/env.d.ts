/// <reference types="vite/client" />
import type { ListResult, UpdateEvent } from '../../shared/types'

declare global {
  interface Window {
    arbor: {
      list(): Promise<ListResult>
      rescan(): Promise<ListResult>
      start(name: string): Promise<void>
      stop(name: string): Promise<void>
      open(name: string): Promise<void>
      reveal(name: string): Promise<void>
      tail(name: string, lines: number): Promise<string>
      openLogs(name: string): Promise<void>
      loginGet(name: string): Promise<boolean | null>
      loginSet(name: string, on: boolean): Promise<{ ok: boolean; reason?: string }>
      selfLoginGet(): Promise<boolean>
      selfLoginSet(on: boolean): Promise<void>
      openConfig(): Promise<void>
      openLoginSettings(): Promise<void>
      contextMenu(name: string, extras?: { loginChecked?: boolean }): void
      hidePanel(): void
      onEvent(cb: (e: UpdateEvent) => void): () => void
      onRefresh(cb: () => void): () => void
    }
  }
}

export {}
