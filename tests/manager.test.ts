import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppManager } from '../src/main/core/manager'
import { freePort, waitFor } from './helpers'

const sh = promisify(execFile)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const serveFixture = join(repoRoot, 'fixtures/serve.mjs')

const junk: { dirs: string[]; managers: AppManager[]; children: ReturnType<typeof spawn>[] } = {
  dirs: [],
  managers: [],
  children: []
}

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'arborist-mgr-'))
  junk.dirs.push(d)
  return d
}

function fixtureSetup(start: string, port: number, extra = ''): {
  home: string
  base: string
  root: string
  configPath: string
  url: string
} {
  const home = tmp()
  const base = tmp()
  const root = tmp()
  const repo = join(root, 'fixture-web')
  mkdirSync(repo, { recursive: true })
  writeFileSync(
    join(repo, 'app.toml'),
    `name = "fixture-web"\ntitle = "Fixture Web"\ntype = "web"\nstart = "${start}"\nurl = "http://127.0.0.1:${port}"\nready = "http:/healthz"\n${extra}`
  )
  const configPath = join(home, 'config.toml')
  mkdirSync(home, { recursive: true })
  writeFileSync(configPath, `roots = ["${root}"]\npoll_interval_ms = 500\n`)
  return { home, base, root, configPath, url: `http://127.0.0.1:${port}` }
}

function makeManager(
  configPath: string,
  base: string,
  overrides: Record<string, unknown> = {}
): { manager: AppManager; openExternal: ReturnType<typeof vi.fn> } {
  const openExternal = vi.fn()
  const manager = new AppManager({
    configPath,
    baseDir: base,
    pollIntervalMs: 200,
    startTimeoutMs: 6000,
    openExternal,
    ...overrides
  })
  junk.managers.push(manager)
  return { manager, openExternal }
}

function stateOf(m: AppManager): string | undefined {
  return m.list().apps.find((a) => a.name === 'fixture-web')?.state
}

afterEach(() => {
  for (const m of junk.managers.splice(0)) m.dispose()
  for (const c of junk.children.splice(0)) c.kill('SIGKILL')
  for (const d of junk.dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('manager web 生命周期', () => {
  it('start → running（契约 line）→ 自动开浏览器 → stop → stopped', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    expect(stateOf(manager)).toBe('stopped')

    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'running', 8000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toBe('fixture ok')
    expect(openExternal).toHaveBeenCalledWith(setup.url)

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })

  it('认领：外部启动的服务轮询后变 running，不开浏览器，stop 走端口兜底', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port)
    const child = spawn('node', [serveFixture, String(port)], { stdio: 'ignore' })
    junk.children.push(child)
    await waitFor(
      () => new Promise<boolean>((r) => fetch(setup.url).then(() => r(true), () => r(false))),
      5000
    )

    const { manager, openExternal } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await waitFor(() => stateOf(manager) === 'running', 8000)
    expect(openExternal).not.toHaveBeenCalled()

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 8000)
    await waitFor(
      () => new Promise<boolean>((r) => fetch(setup.url).then(() => r(false), () => r(true))),
      5000
    )
  })

  it('blocked：非 main 分支黄灯拒启', async () => {
    const port = await freePort()
    const setup = fixtureSetup(`node ${serveFixture} ${port}`, port, 'branch = "main"\n')
    const repo = join(setup.root, 'fixture-web')
    await sh('git', ['-C', repo, 'init', '-q', '-b', 'main'])
    await sh('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t.t', 'commit', '-q', '--allow-empty', '-m', 'x'])
    await sh('git', ['-C', repo, 'checkout', '-q', '-b', 'dev'])

    const { manager } = makeManager(setup.configPath, setup.base)
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'blocked', 5000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain('分支')
    expect(app?.line).toContain('main')
  })

  it('启动超时 → error', async () => {
    const port = await freePort()
    const setup = fixtureSetup('sleep 30', port)
    const { manager } = makeManager(setup.configPath, setup.base, { startTimeoutMs: 1200 })
    await manager.init()
    await manager.start('fixture-web')
    await waitFor(() => stateOf(manager) === 'error', 6000)
    const app = manager.list().apps.find((a) => a.name === 'fixture-web')
    expect(app?.line).toContain('超时')

    await manager.stop('fixture-web')
    await waitFor(() => stateOf(manager) === 'stopped', 5000)
  })
})
