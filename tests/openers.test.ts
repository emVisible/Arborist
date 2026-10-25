import { spawn } from 'node:child_process'
import { chmodSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appRunning } from '../src/main/core/openers'
import { waitFor } from './helpers'

const dirs: string[] = []
const children: ReturnType<typeof spawn>[] = []
// 唯一进程名夹具：拷贝 /bin/sleep 改名，保证 pgrep -x 不会误伤其它进程
const NAME = 'arborist-probe-x7'

afterEach(() => {
  for (const c of children.splice(0)) c.kill('SIGKILL')
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('openers 运行态检测', () => {
  it('pgrep：进程在 → true，退出 → false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arborist-openers-'))
    dirs.push(dir)
    const bin = join(dir, NAME)
    copyFileSync('/bin/sleep', bin)
    chmodSync(bin, 0o755)

    const child = spawn(bin, ['30'], { stdio: 'ignore' })
    children.push(child)

    await waitFor(() => appRunning(NAME), 5000)
    expect(await appRunning(NAME)).toBe(true)

    child.kill('SIGKILL')
    await waitFor(async () => !(await appRunning(NAME)), 5000)
    expect(await appRunning(NAME)).toBe(false)
  })

  it('不存在的进程名 → false', async () => {
    expect(await appRunning('arborist-definitely-not-running-xyz')).toBe(false)
  })
})
