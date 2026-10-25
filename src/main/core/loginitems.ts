import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const sh = promisify(execFile)

// System Events 自动化需要一次性授权；被拒时抛 AutomationError，调用方降级处理
export class AutomationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AutomationError'
  }
}

function assertSafe(value: string): void {
  if (value.includes('"') || value.includes('\\')) {
    throw new Error(`login item 值包含非法字符：${value}`)
  }
}

function rethrow(e: unknown): never {
  const err = e as { stderr?: string; message?: string }
  const msg = String(err?.stderr ?? err?.message ?? e)
  if (msg.includes('-1743') || /not authorized/i.test(msg)) {
    throw new AutomationError('缺少「系统事件」自动化权限，请在系统设置中授权 Arborist')
  }
  throw new Error(msg)
}

const osa = (script: string): Promise<{ stdout: string }> =>
  sh('osascript', ['-e', script])

export async function listLoginItems(): Promise<string[]> {
  try {
    const { stdout } = await osa(
      'tell application "System Events" to get the name of every login item'
    )
    return stdout
      .trim()
      .split(', ')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch (e) {
    rethrow(e)
  }
}

export async function appPathOf(target: string): Promise<string> {
  assertSafe(target)
  try {
    const { stdout } = await osa(
      `tell application "Finder" to get POSIX path of (application file id "${target}" as alias)`
    )
    return stdout.trim()
  } catch (e) {
    rethrow(e)
  }
}

export async function addLoginItem(appPath: string): Promise<void> {
  assertSafe(appPath)
  try {
    await osa(
      `tell application "System Events" to make login item at end with properties {path:"${appPath}", hidden:false}`
    )
  } catch (e) {
    rethrow(e)
  }
}

export async function removeLoginItem(name: string): Promise<void> {
  assertSafe(name)
  try {
    await osa(`tell application "System Events" to delete login item "${name}"`)
  } catch (e) {
    rethrow(e)
  }
}

export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/\.app$/, '')
}
