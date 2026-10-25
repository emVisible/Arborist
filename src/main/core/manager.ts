import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { loadConfig, ConfigError, CONFIG_PATH, type ArborConfig } from './config'
import { discoverApps, type Manifest } from './registry'
import type { AppView, LightState, ListResult } from '../../shared/types'

export interface ManagerOptions {
  configPath?: string
  baseDir?: string
  pollIntervalMs?: number
  startTimeoutMs?: number
}

export interface AppEntry {
  m: Manifest
  state: LightState
  line?: string
}

export class AppManager extends EventEmitter {
  private config: ArborConfig = { roots: [], pollIntervalMs: 10000 }
  private entries = new Map<string, AppEntry>()
  private errors: { repoDir: string; message: string }[] = []
  private configError: string | undefined
  private iconCache = new Map<string, string>()

  constructor(readonly opts: ManagerOptions = {}) {
    super()
  }

  async init(): Promise<void> {
    await this.rescan()
  }

  async rescan(): Promise<ListResult> {
    try {
      this.config = loadConfig(this.opts.configPath)
      this.configError = undefined
    } catch (e) {
      if (e instanceof ConfigError) {
        this.configError = e.message
      } else {
        throw e
      }
    }

    const { apps, errors } = discoverApps(this.config.roots)
    const next = new Map<string, AppEntry>()
    for (const m of apps) {
      const prev = this.entries.get(m.name)
      next.set(m.name, prev ? { ...prev, m } : { m, state: 'stopped' })
    }
    this.entries = next
    this.errors = errors

    this.emit('refresh')
    return this.list()
  }

  list(): ListResult {
    return {
      apps: [...this.entries.values()].map((e) => this.viewOf(e)),
      errors: this.errors,
      configError: this.configError
    }
  }

  viewOf(e: AppEntry): AppView {
    return {
      name: e.m.name,
      title: e.m.title,
      type: e.m.type,
      state: e.state,
      line: e.line,
      icon: this.iconOf(e.m)
    }
  }

  openConfig(): void {
    try {
      loadConfig(this.opts.configPath)
    } catch {
      // 模板创建失败时仍尝试打开已有文件
    }
    execFile('open', ['-t', this.opts.configPath ?? CONFIG_PATH])
  }

  private iconOf(m: Manifest): string | undefined {
    if (!m.iconPath) return undefined
    const cached = this.iconCache.get(m.iconPath)
    if (cached) return cached
    try {
      const buf = readFileSync(m.iconPath)
      const mime =
        m.iconPath.endsWith('.jpg') || m.iconPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
      const url = `data:${mime};base64,${buf.toString('base64')}`
      this.iconCache.set(m.iconPath, url)
      return url
    } catch {
      return undefined
    }
  }
}
