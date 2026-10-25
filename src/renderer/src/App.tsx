import { useEffect, useState } from 'react'
import type { ListResult } from '../../shared/types'

export default function App() {
  const [data, setData] = useState<ListResult>({ apps: [], errors: [] })

  useEffect(() => {
    void window.arbor.list().then(setData)
  }, [])

  return (
    <div className="panel">
      <header className="head">
        <span className="title">Arborist</span>
        <span className="count">{data.apps.length}</span>
      </header>
      <main className="empty">
        <p className="empty-title">没有注册的 app</p>
        <p className="hint">在 ~/.arborist/config.toml 配置 roots</p>
        <p className="hint">各 repo 根目录放一个 app.toml 即可注册</p>
      </main>
    </div>
  )
}
