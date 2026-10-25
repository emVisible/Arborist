import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appRunning } from '../src/main/core/openers'
import { waitFor } from './helpers'

const dirs: string[] = []
const children: ReturnType<typeof spawn>[] = []
// 唯一进程名夹具（≤15 字符，避开 p_comm 截断）：symlink 到 /bin/sleep。
// 不能 copy：拷贝出的 Apple 签名二进制在被 SIGKILL 后可能卡在 UE（exiting）状态
// 不被回收，pgrep 永远可见；symlink 执行原始 inode，死亡干净。
const NAME = `aprobe-${process.pid}`

afterEach(() => {
  for (const c of children.splice(0)) c.kill('SIGKILL')
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('openers 运行态检测', () => {
  it('pgrep：进程在 → true，杀死 → exit → false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'arborist-openers-'))
    dirs.push(dir)
    const bin = join(dir, NAME)
    symlinkSync('/bin/sleep', bin)

    const child = spawn(bin, ['30'], { stdio: 'ignore' })
    children.push(child)

    await waitFor(() => appRunning(NAME), 5000)
    expect(await appRunning(NAME)).toBe(true)

    const exited = new Promise<void>((r) => child.once('exit', r))
    child.kill('SIGKILL')
    await exited
    await waitFor(async () => !(await appRunning(NAME)), 5000)
    expect(await appRunning(NAME)).toBe(false)
  })

  it('不存在的进程名 → false', async () => {
    expect(await appRunning('arborist-definitely-not-running-xyz')).toBe(false)
  })
})
