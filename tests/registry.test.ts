import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverApps, parseManifest } from '../src/main/core/registry'

const dirs: string[] = []

function tmpRoot(): string {
  const d = mkdtempSync(join(tmpdir(), 'arborist-roots-'))
  dirs.push(d)
  return d
}

function repo(root: string, name: string, toml?: string): string {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  if (toml !== undefined) writeFileSync(join(dir, 'app.toml'), toml)
  return dir
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs.length = 0
})

const WEB = `
name = "good-web"
title = "Good Web"
type = "web"
start = "./dev.sh"
url = "http://127.0.0.1:8710"
`

const APP = `
name = "good-app"
type = "app"
open = "Hertz"
`

describe('discoverApps', () => {
  it('发现合法 app，跳过无 manifest 和隐藏目录，统计未注册', () => {
    const root = tmpRoot()
    repo(root, 'good-web', WEB)
    repo(root, 'good-app', APP)
    repo(root, 'no-manifest')
    repo(root, 'no-manifest-either')
    repo(root, '.hidden', WEB)
    repo(root, 'node_modules', WEB)

    const { apps, errors, unregistered } = discoverApps([root])
    expect(errors).toEqual([])
    expect(apps.map((a) => a.name)).toEqual(['good-app', 'good-web'])
    expect(unregistered).toBe(2)
  })

  it('坏 manifest 进 errors 且带 repo 路径', () => {
    const root = tmpRoot()
    repo(root, 'bad-type', 'name = "x"\ntype = "daemon"\n')
    repo(root, 'no-name', 'type = "app"\nopen = "A"\n')

    const { apps, errors } = discoverApps([root])
    expect(apps).toEqual([])
    expect(errors).toHaveLength(2)
    for (const e of errors) {
      expect(e.repoDir).toContain('bad-type' === e.repoDir.split('/').pop() ? 'bad-type' : 'no-name')
      expect(e.message).toBeTruthy()
    }
  })

  it('重名报错', () => {
    const root = tmpRoot()
    repo(root, 'a', WEB)
    repo(root, 'b', WEB)

    const { apps, errors } = discoverApps([root])
    expect(apps).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('重名')
  })

  it('root 不存在报错', () => {
    const { apps, errors } = discoverApps(['/nonexistent-arborist-root'])
    expect(apps).toEqual([])
    expect(errors[0].message).toContain('不存在')
  })
})

describe('parseManifest', () => {
  const root = () => tmpRoot()

  it('web 默认 ready 为 http:/，字段齐全', () => {
    const dir = repo(root(), 'r', WEB)
    const r = parseManifest(join(dir, 'app.toml'), dir)
    expect('manifest' in r).toBe(true)
    if ('manifest' in r) {
      expect(r.manifest.ready).toBe('http:/')
      expect(r.manifest.title).toBe('Good Web')
      expect(r.manifest.login).toBe(false)
    }
  })

  it('web 缺 url 报错', () => {
    const dir = repo(root(), 'r', 'name = "x"\ntype = "web"\nstart = "./s"\n')
    const r = parseManifest(join(dir, 'app.toml'), dir)
    expect('error' in r && r.error).toContain('url')
  })

  it('app 缺 open 报错', () => {
    const dir = repo(root(), 'r', 'name = "x"\ntype = "app"\n')
    const r = parseManifest(join(dir, 'app.toml'), dir)
    expect('error' in r && r.error).toContain('open')
  })

  it('name 大写报错', () => {
    const dir = repo(root(), 'r', 'name = "BadName"\ntype = "app"\nopen = "A"\n')
    const r = parseManifest(join(dir, 'app.toml'), dir)
    expect('error' in r && r.error).toContain('name')
  })

  it('ready 非法形式报错，合法形式通过', () => {
    const base = 'name = "x"\ntype = "web"\nstart = "s"\nurl = "http://127.0.0.1:1"\n'

    const bad = repo(root(), 'r', base + 'ready = "wait-for-it"\n')
    expect('error' in parseManifest(join(bad, 'app.toml'), bad)).toBe(true)

    for (const ready of ['http:/healthz', 'http://127.0.0.1:2/ready', 'tcp']) {
      const dir = repo(root(), 'r', base + `ready = "${ready}"\n`)
      const r = parseManifest(join(dir, 'app.toml'), dir)
      expect('manifest' in r ? r.manifest.ready : null).toBe(ready)
    }
  })

  it('icon 存在时解析为绝对路径，不存在时忽略', () => {
    const withIcon = repo(root(), 'r', APP + 'icon = "docs/icon.png"\n')
    mkdirSync(join(withIcon, 'docs'))
    writeFileSync(join(withIcon, 'docs/icon.png'), '')

    const ok = parseManifest(join(withIcon, 'app.toml'), withIcon)
    expect('manifest' in ok && ok.manifest.iconPath).toBe(join(withIcon, 'docs/icon.png'))

    const withoutFile = repo(root(), 'r2', APP + 'icon = "docs/missing.png"\n')
    const miss = parseManifest(join(withoutFile, 'app.toml'), withoutFile)
    expect('manifest' in miss && miss.manifest.iconPath).toBeUndefined()
  })

  it('login 解析为 true', () => {
    const dir = repo(root(), 'r', APP + 'login = true\n')
    const r = parseManifest(join(dir, 'app.toml'), dir)
    expect('manifest' in r && r.manifest.login).toBe(true)
  })
})
