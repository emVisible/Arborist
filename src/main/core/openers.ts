import { spawn } from 'node:child_process'

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
