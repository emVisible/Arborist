// 浏览器预览支持：无 preload（非 Electron）环境注入假数据，
// 使 `pnpm preview:ui` 可以在浏览器里直接调 dropdown UI。
// Electron 中 preload 先于页面脚本执行，window.arbor 已存在，此文件自动失效。
import type { AppView, ListResult, UpdateEvent } from '../../shared/types'

if (typeof window !== 'undefined' && !window.arbor) {
  const apps: AppView[] = [
    {
      name: 'ametrine',
      title: 'Ametrine',
      type: 'web',
      state: 'running',
      line: '3 docs indexed · 2 sessions'
    },
    { name: 'hertz', title: 'Hertz', type: 'app', state: 'stopped' },
    { name: 'thistelles', title: 'Thistelles', type: 'menubar', state: 'stopped' },
    { name: 'ginko', title: 'Ginko', type: 'web', state: 'error', line: '探测失败：服务无响应' }
  ]
  const eventListeners: Array<(e: UpdateEvent) => void> = []
  const notify = (): void => {
    for (const l of eventListeners) l({ name: 'ametrine', state: 'running', line: 'mock' })
  }
  window.arbor = {
    list: () => Promise.resolve({ apps, errors: [] } as ListResult),
    rescan: () => Promise.resolve({ apps, errors: [] } as ListResult),
    start: (name) => {
      const a = apps.find((x) => x.name === name)
      if (a) a.state = 'starting'
      notify()
      return Promise.resolve()
    },
    stop: (name) => {
      const a = apps.find((x) => x.name === name)
      if (a) {
        a.state = 'stopped'
        a.line = undefined
      }
      notify()
      return Promise.resolve()
    },
    open: () => Promise.resolve(),
    reveal: () => Promise.resolve(),
    tail: () =>
      Promise.resolve(
        Array.from({ length: 40 }, (_, i) => `[mock] log line ${i + 1}`).join('\n')
      ),
    openLogs: () => Promise.resolve(),
    loginGet: () => Promise.resolve(false),
    loginSet: () => Promise.resolve({ ok: true }),
    selfLoginGet: () => Promise.resolve(false),
    selfLoginSet: () => Promise.resolve(),
    openConfig: () => Promise.resolve(),
    openLoginSettings: () => Promise.resolve(),
    contextMenu: () => {},
    hidePanel: () => {},
    onEvent: (cb) => {
      eventListeners.push(cb)
      return () => {
        const i = eventListeners.indexOf(cb)
        if (i >= 0) eventListeners.splice(i, 1)
      }
    },
    onRefresh: () => () => {}
  }
}
