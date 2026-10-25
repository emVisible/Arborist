import { execFile, spawn } from 'node:child_process'

const BUNDLE_RE = /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/i

// open 字段：bundle id（含点，如 com.emvisible.arborist）走 -b，应用名走 -a
export function isOpenBundleId(target: string): boolean {
  return BUNDLE_RE.test(target)
}

export function openApp(target: string): void {
  const args = isOpenBundleId(target) ? ['-b', target] : ['-a', target]
  const child = spawn('open', args, { detached: true, stdio: 'ignore' })
  child.unref()
}

// 运行态检测：进程名 pgrep（无权限要求）；bundle id 走 lsappinfo
export function appRunning(target: string): Promise<boolean> {
  if (isOpenBundleId(target)) {
    return new Promise((resolve) => {
      execFile(
        'sh',
        ['-c', `lsappinfo list | grep -c '"${target}"'`],
        { timeout: 3000 },
        (err, stdout) => resolve(!err && stdout.trim() !== '0')
      )
    })
  }
  return new Promise((resolve) => {
    execFile('pgrep', ['-x', target], { timeout: 2000 }, (err, stdout) =>
      resolve(!err && !!stdout.trim())
    )
  })
}
