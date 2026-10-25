import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { ARBOR_DIR, loadConfig, ConfigError, CONFIG_PATH, type ArborConfig } from './config'
import { join } from 'node:path'
import { discoverApps, type Manifest } from './registry'
import { probeApp, type Probe } from './prober'
import {
  currentBranch,
  killPids,
  pidsOnPort,
  startWeb,
  stopWeb,
  tailFile
} from './supervisor'
import type { AppView, LightState, ListResult } from '../../shared/types'

export interface ManagerOptions {
  configPath?: string
  baseDir?: string
  pollIntervalMs?: number
  startTimeoutMs?: number
  probeTimeoutMs?: number
  openExternal?: (url: string) => void
}

export interface AppEntry {
  m: Manifest
  state: LightState
  line?: string
  startedByUs: boolean
  browserOpened: boolean
  failStreak: number
  timer?: NodeJS.Timeout
  timeoutTimer?: NodeJS.Timeout
  emittedState?: LightState
  emittedLine?: string
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
      const entry: AppEntry = prev ?? {
        m,
        state: 'stopped',
        startedByUs: false,
        browserOpened: false,
        failStreak: 0
      }
      entry.m = m
      next.set(m.name, entry)
    }
    for (const [name, entry] of this.entries) {
      if (!next.has(name)) {
        clearTimeout(entry.timer)
        clearTimeout(entry.timeoutTimer)
      }
    }
    this.entries = next
    this.errors = errors

    for (const entry of this.entries.values()) {
      if (entry.m.type === 'web' && entry.state !== 'stopping') {
        this.schedulePoll(entry, entry.timer ? this.intervalMs() : 300)
      }
    }

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

  get(name: string): Manifest | undefined {
    return this.entries.get(name)?.m
  }

  async start(name: string): Promise<void> {
    const entry = this.entries.get(name)
    if (!entry) return
    const m = entry.m

    if (m.type !== 'web') return // app / menubar：M4

    if (entry.state === 'running' || entry.state === 'degraded') {
      this.open(name)
      return
    }
    if (entry.state === 'starting' || entry.state === 'stopping') return

    if (m.branch) {
      const br = await currentBranch(m.repoDir)
      if (br && br !== m.branch) {
        this.transition(entry, 'blocked')
        entry.line = `分支 ${br} ≠ ${m.branch}，拒绝启动`
        this.emitChange(entry)
        return
      }
    }

    try {
      startWeb(m, this.opts.baseDir ?? ARBOR_DIR)
    } catch (e) {
      this.transition(entry, 'error')
      entry.line = `spawn 失败：${(e as Error).message}`
      this.emitChange(entry)
      return
    }

    entry.startedByUs = true
    entry.browserOpened = false
    entry.failStreak = 0
    this.transition(entry, 'starting')
    entry.line = undefined

    const timeoutMs = this.opts.startTimeoutMs ?? 60_000
    clearTimeout(entry.timeoutTimer)
    entry.timeoutTimer = setTimeout(() => {
      if (entry.state === 'starting') {
        this.transition(entry, 'error')
        entry.line = `启动超时（${Math.round(timeoutMs / 1000)}s 未就绪）`
        this.emitChange(entry)
      }
    }, timeoutMs)

    this.emitChange(entry)
    this.schedulePoll(entry, 400)
  }

  async stop(name: string): Promise<void> {
    const entry = this.entries.get(name)
    if (!entry || entry.m.type !== 'web') return
    if (entry.state === 'stopped') return

    clearTimeout(entry.timer)
    clearTimeout(entry.timeoutTimer)
    this.transition(entry, 'stopping')
    entry.line = undefined
    this.emitChange(entry)

    const result = await stopWeb(entry.m, this.opts.baseDir ?? ARBOR_DIR)
    if (result === 'not-running' && entry.m.url) {
      const port = Number(new URL(entry.m.url).port) || 80
      const pids = await pidsOnPort(port)
      if (pids.length > 0) await killPids(pids)
    }

    entry.startedByUs = false
    entry.browserOpened = false
    entry.failStreak = 0
    this.transition(entry, 'stopped')
    entry.line = undefined
    this.emitChange(entry)
    this.schedulePoll(entry, 1500)
  }

  open(name: string): void {
    const entry = this.entries.get(name)
    if (!entry) return
    if (entry.m.type === 'web' && entry.m.url) this.opts.openExternal?.(entry.m.url)
    // app / menubar：M4
  }

  tail(name: string, lines: number): string {
    const m = this.get(name)
    if (!m || m.type !== 'web') return ''
    return tailFile(join(this.opts.baseDir ?? ARBOR_DIR, 'logs', `${m.name}.log`), lines)
  }

  openConfig(): void {
    try {
      loadConfig(this.opts.configPath)
    } catch {
      // 模板创建失败时仍尝试打开已有文件
    }
    execFile('open', ['-t', this.opts.configPath ?? CONFIG_PATH])
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      clearTimeout(entry.timer)
      clearTimeout(entry.timeoutTimer)
    }
  }

  private intervalMs(): number {
    return this.opts.pollIntervalMs ?? this.config.pollIntervalMs
  }

  private schedulePoll(entry: AppEntry, delayMs: number): void {
    clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      void this.poll(entry)
    }, delayMs)
  }

  private async poll(entry: AppEntry): Promise<void> {
    try {
      const probe = await probeApp(entry.m, this.opts.probeTimeoutMs ?? 1500)
      this.applyProbe(entry, probe)
    } catch {
      /* probe 自身永不抛；防御 */
    }
    if (entry.state === 'starting') this.schedulePoll(entry, 1000)
    else if (entry.state !== 'stopping') this.schedulePoll(entry, this.intervalMs())
  }

  private applyProbe(entry: AppEntry, p: Probe): void {
    if (entry.state === 'stopping') return
    const prev = entry.state

    if (p.reachable && (p.state === undefined || p.state === 'ok')) {
      entry.failStreak = 0
      this.transition(entry, 'running')
      entry.line = p.line
      if (prev === 'starting' && entry.startedByUs && !entry.browserOpened) {
        entry.browserOpened = true
        this.opts.openExternal?.(p.url ?? entry.m.url!)
      }
    } else if (p.reachable && p.state === 'degraded') {
      entry.failStreak = 0
      this.transition(entry, 'degraded')
      entry.line = p.line
    } else if (p.reachable && p.state === 'error') {
      this.transition(entry, 'error')
      entry.line = p.line ?? '服务自报不可用'
    } else if (p.reachable && p.state === 'starting') {
      // 服务自报仍在启动，watchdog 继续计时
    } else {
      if (prev === 'starting') {
        // watchdog 负责超时判定
      } else if (prev === 'running' || prev === 'degraded') {
        entry.failStreak++
        if (entry.failStreak >= 2) {
          this.transition(entry, 'error')
          entry.line = '探测失败：服务无响应'
        }
      }
    }

    this.emitChange(entry)
  }

  private transition(entry: AppEntry, state: LightState): void {
    if (entry.state === state) return
    if (entry.state === 'starting' && state !== 'starting') clearTimeout(entry.timeoutTimer)
    entry.state = state
  }

  private emitChange(entry: AppEntry): void {
    if (entry.emittedState === entry.state && entry.emittedLine === entry.line) return
    entry.emittedState = entry.state
    entry.emittedLine = entry.line
    this.emit('update', { name: entry.m.name, state: entry.state, line: entry.line })
  }

  private viewOf(e: AppEntry): AppView {
    return {
      name: e.m.name,
      title: e.m.title,
      type: e.m.type,
      state: e.state,
      line: e.line,
      icon: this.iconOf(e.m)
    }
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
