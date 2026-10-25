import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { AppType, ManifestError } from '../../shared/types'
import { expandTilde } from './config'

export interface Manifest {
  name: string
  title: string
  type: AppType
  repoDir: string
  start?: string
  url?: string
  ready?: string
  branch?: string
  open?: string
  login?: boolean
  iconPath?: string
  notes?: string
}

export interface DiscoveryResult {
  apps: Manifest[]
  errors: ManifestError[]
  unregistered: number
}

const TYPES: AppType[] = ['web', 'app', 'menubar']
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/

export function discoverApps(roots: string[]): DiscoveryResult {
  const apps: Manifest[] = []
  const errors: ManifestError[] = []
  const seen = new Set<string>()
  let unregistered = 0

  for (const root of roots.map(expandTilde)) {
    let entries
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch {
      errors.push({ repoDir: root, message: 'root 目录不存在或不可读' })
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue
      }
      const repoDir = join(root, entry.name)
      const file = join(repoDir, 'app.toml')
      if (!existsSync(file)) {
        unregistered++
        continue
      }

      const result = parseManifest(file, repoDir)
      if ('error' in result) {
        errors.push({ repoDir, message: result.error })
        continue
      }
      if (seen.has(result.manifest.name)) {
        errors.push({ repoDir, message: `与已有 app 重名：${result.manifest.name}` })
        continue
      }
      seen.add(result.manifest.name)
      apps.push(result.manifest)
    }
  }

  apps.sort((a, b) => a.name.localeCompare(b.name))
  return { apps, errors, unregistered }
}

export function parseManifest(
  file: string,
  repoDir: string
): { manifest: Manifest } | { error: string } {
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { error: `TOML 语法错误：${(e as Error).message}` }
  }
  if (typeof raw !== 'object' || raw === null) return { error: 'app.toml 顶层必须是键值表' }
  const t = raw as Record<string, unknown>

  const name = t.name
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    return { error: 'name 必填：小写字母/数字/连字符，如 "ametrine"' }
  }
  const type = t.type
  if (typeof type !== 'string' || !TYPES.includes(type as AppType)) {
    return { error: `type 必须是 ${TYPES.join(' / ')} 之一` }
  }
  const appType = type as AppType

  let start: string | undefined
  let url: string | undefined
  let open: string | undefined
  if (type === 'web') {
    if (typeof t.start !== 'string' || !t.start) return { error: 'web 类需要 start 启动命令' }
    if (typeof t.url !== 'string' || !/^https?:\/\//.test(t.url)) {
      return { error: 'web 类需要 url（http:// 或 https:// 开头）' }
    }
    start = t.start
    url = t.url
  } else {
    if (typeof t.open !== 'string' || !t.open) {
      return { error: `${type} 类需要 open（应用名或 bundle id）` }
    }
    open = t.open
  }

  const ready = t.ready === undefined ? undefined : normalizeReady(t.ready)
  if (ready === null) {
    return { error: 'ready 只接受 "http:/path"、绝对 URL 或 "tcp"' }
  }

  let iconPath: string | undefined
  if (typeof t.icon === 'string' && t.icon) {
    const p = join(repoDir, t.icon)
    if (existsSync(p)) iconPath = p
  }

  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

  return {
    manifest: {
      name,
      title: str(t.title) ?? name,
      type: appType,
      repoDir,
      start,
      url,
      ready: ready ?? (appType === 'web' ? 'http:/' : undefined),
      branch: str(t.branch),
      open,
      login: t.login === true,
      iconPath,
      notes: str(t.notes)
    }
  }
}

function normalizeReady(v: unknown): string | null {
  if (typeof v !== 'string') return null
  if (v === 'tcp') return v
  if (/^http:\/(?!\/)/.test(v)) return v // 相对路径形式：http:/healthz
  if (/^https?:\/\//.test(v)) return v
  return null
}
