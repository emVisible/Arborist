import { execFile, spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import type { Manifest } from './registry'

export interface StartResult {
  pgid: number
  logFile: string
}

export type StopResult = 'stopped' | 'forced' | 'not-running'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// web 类服务以独立进程组（pgid）detach 运行：Arborist 退出不影响服务，
// 停止时整组击杀，npm run dev → vite → node 的子树一并收掉。
export function startWeb(m: Manifest, baseDir: string): StartResult {
  const pidsDir = join(baseDir, 'pids')
  const logsDir = join(baseDir, 'logs')
  mkdirSync(pidsDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })
  const logFile = join(logsDir, `${m.name}.log`)
  if (existsSync(logFile) && statSync(logFile).size > 5 * 1024 * 1024) truncateSync(logFile)

  const fd = openSync(logFile, 'a')
  try {
    const child = spawn(m.start!, {
      shell: '/bin/sh',
      detached: true,
      cwd: m.repoDir,
      stdio: ['ignore', fd, fd]
    })
    child.unref()
    writeFileSync(join(pidsDir, `${m.name}.pid`), String(child.pid))
    return { pgid: child.pid!, logFile }
  } finally {
    closeSync(fd)
  }
}

export function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0)
  } catch {
    return false
  }
  return true
}

export async function stopWeb(m: Manifest, baseDir: string): Promise<StopResult> {
  const pidFile = join(baseDir, 'pids', `${m.name}.pid`)
  let pgid: number | null = null
  if (existsSync(pidFile)) {
    const n = Number(readFileSync(pidFile, 'utf8').trim())
    if (Number.isInteger(n) && n > 1) pgid = n
  }
  if (pgid === null || !groupAlive(pgid)) {
    if (existsSync(pidFile)) unlinkSync(pidFile)
    return 'not-running'
  }

  process.kill(-pgid, 'SIGTERM')
  for (let i = 0; i < 25 && groupAlive(pgid); i++) await sleep(200)
  const forced = groupAlive(pgid)
  if (forced) process.kill(-pgid, 'SIGKILL')
  unlinkSync(pidFile)
  return forced ? 'forced' : 'stopped'
}

// 非 Arborist 启动的服务：按端口兜底击杀
export function pidsOnPort(port: number): Promise<number[]> {
  return new Promise((resolve) => {
    execFile(
      'lsof',
      ['-t', '-i', `tcp:${port}`, '-sTCP:LISTEN'],
      { timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve([])
        resolve(
          stdout
            .trim()
            .split('\n')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0)
        )
      }
    )
  })
}

export async function killPids(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* already gone */
    }
  }
  for (let i = 0; i < 15; i++) {
    await sleep(200)
    const allGone = pids.every((pid) => {
      try {
        process.kill(pid, 0)
        return false
      } catch {
        return true
      }
    })
    if (allGone) return
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
  }
}

export function currentBranch(repoDir: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: 3000 },
      (err, stdout) => {
        resolve(err ? null : stdout.trim())
      }
    )
  })
}

export function tailFile(path: string, lines: number): string {
  try {
    const all = readFileSync(path, 'utf8').split('\n')
    if (all[all.length - 1] === '') all.pop()
    return all.slice(-lines).join('\n')
  } catch {
    return ''
  }
}
