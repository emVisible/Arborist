import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse } from 'smol-toml'

export interface ArborConfig {
  roots: string[]
  pollIntervalMs: number
}

export const ARBOR_DIR = join(homedir(), '.arborist')
export const CONFIG_PATH = join(ARBOR_DIR, 'config.toml')
export const PIDS_DIR = join(ARBOR_DIR, 'pids')
export const LOGS_DIR = join(ARBOR_DIR, 'logs')

export class ConfigError extends Error {}

const TEMPLATE = `# Arborist 配置
# roots: 在这些目录的第一层子目录里寻找 app.toml
# poll_interval_ms: web 类 app 的状态轮询间隔
roots = ["~/Code"]
poll_interval_ms = 10000
`

export function expandTilde(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return p
}

export function loadConfig(configPath = CONFIG_PATH): ArborConfig {
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, TEMPLATE)
    return { roots: [expandTilde('~/Code')], pollIntervalMs: 10000 }
  }

  let raw: unknown
  try {
    raw = parse(readFileSync(configPath, 'utf8'))
  } catch (e) {
    throw new ConfigError(`config.toml 解析失败：${(e as Error).message}`)
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ConfigError('config.toml 顶层必须是键值表')
  }

  const t = raw as Record<string, unknown>
  let roots: string[]
  if (t.roots === undefined) {
    roots = []
  } else if (Array.isArray(t.roots) && t.roots.every((r) => typeof r === 'string')) {
    roots = t.roots as string[]
  } else {
    throw new ConfigError('roots 必须是字符串数组')
  }

  const poll = t.poll_interval_ms ?? 10000
  if (typeof poll !== 'number' || !Number.isFinite(poll) || poll < 500) {
    throw new ConfigError('poll_interval_ms 必须是不小于 500 的数字')
  }

  return { roots: roots.map(expandTilde), pollIntervalMs: poll }
}
