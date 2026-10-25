import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { groupAlive, startWeb, stopWeb, tailFile } from '../src/main/core/supervisor'
import type { Manifest } from '../src/main/core/registry'

const sh = promisify(execFile)
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const dirs: string[] = []
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'arborist-sup-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
  dirs.length = 0
})

function treeManifest(): Manifest {
  return {
    name: 'fixture-tree',
    title: 'fixture-tree',
    type: 'web',
    repoDir: join(repoRoot, 'fixtures'),
    start: 'sh spawn-tree.sh',
    url: 'http://127.0.0.1:1/',
    ready: 'tcp'
  }
}

describe('supervisor 进程组', () => {
  it('spawn 建立进程组并整组击杀无残留', async () => {
    const baseDir = tmp()
    const { pgid, logFile } = startWeb(treeManifest(), baseDir)
    expect(pgid).toBeGreaterThan(1)
    expect(logFile).toContain('fixture-tree.log')

    await new Promise((r) => setTimeout(r, 700))
    const { stdout } = await sh('pgrep', ['-g', String(pgid)])
    const count = stdout.trim().split('\n').filter(Boolean).length
    expect(count).toBeGreaterThanOrEqual(3)

    const result = await stopWeb(treeManifest(), baseDir)
    expect(['stopped', 'forced']).toContain(result)

    await new Promise((r) => setTimeout(r, 300))
    const alive = await sh('pgrep', ['-g', String(pgid)])
      .then((o) => o.stdout.trim())
      .catch(() => '')
    expect(alive).toBe('')
    expect(groupAlive(pgid)).toBe(false)
  })

  it('停止未启动的服务返回 not-running', async () => {
    const baseDir = tmp()
    const r = await stopWeb(treeManifest(), baseDir)
    expect(r).toBe('not-running')
  })

  it('tailFile 返回尾部行', () => {
    const dir = tmp()
    const file = join(dir, 'x.log')
    writeFileSync(file, 'l1\nl2\nl3\nl4\n')
    expect(tailFile(file, 2)).toBe('l3\nl4')
    expect(tailFile(join(dir, 'missing.log'), 5)).toBe('')
  })
})
