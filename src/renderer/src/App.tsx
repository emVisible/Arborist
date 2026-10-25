import { useCallback, useEffect, useState } from 'react'
import type { AppView, ListResult } from '../../shared/types'
import LogView from './Logs'

const stateLabel: Record<string, string> = {
  stopped: '已停止',
  starting: '启动中',
  running: '运行中',
  stopping: '停止中',
  error: '错误',
  blocked: '受阻',
  degraded: '降级'
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onHash = (): void => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const logMatch = hash.match(/^#\/logs\/(.+)$/)
  if (logMatch) return <LogView name={decodeURIComponent(logMatch[1])} />
  return <Panel />
}

function Panel() {
  const [data, setData] = useState<ListResult>({ apps: [], errors: [] })
  const [selfLogin, setSelfLogin] = useState(false)

  useEffect(() => {
    void window.arbor.selfLoginGet().then(setSelfLogin)
  }, [])

  const refresh = useCallback(() => {
    void window.arbor.list().then(setData)
  }, [])

  useEffect(() => {
    refresh()
    const off = window.arbor.onRefresh(refresh)
    const offEvent = window.arbor.onEvent((e) => {
      setData((d) => ({
        ...d,
        apps: d.apps.map((a) =>
          a.name === e.name ? { ...a, state: e.state, line: e.line } : a
        )
      }))
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.arbor.hidePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      off()
      offEvent()
      window.removeEventListener('keydown', onKey)
    }
  }, [refresh])

  return (
    <div className="panel">
      <header className="head">
        <span className="title">Arborist</span>
        <span className="count">{data.apps.length} apps</span>
      </header>

      {data.configError && <div className="banner error">{data.configError}</div>}

      {data.errors.length > 0 && (
        <div className="banner warn">
          {data.errors.map((e, i) => (
            <div key={i} className="banner-item" title={e.repoDir}>
              {e.repoDir.split('/').pop()}: {e.message}
            </div>
          ))}
        </div>
      )}

      <main className="list">
        {data.apps.length === 0 ? (
          <div className="empty">
            <p className="empty-title">没有注册的 app</p>
            <p className="hint">在 ~/.arborist/config.toml 配置 roots</p>
            <p className="hint">repo 根目录放一个 app.toml 即可注册</p>
          </div>
        ) : (
          data.apps.map((a) => <Row key={a.name} app={a} />)
        )}
      </main>

      <footer className="foot">
        {data.unregisteredCount ? (
          <span className="foot-hint" title="roots 下未放 app.toml 的 repo 数">
            {data.unregisteredCount} 未注册
          </span>
        ) : null}
        <label className="toggle" title="Arborist 随系统启动">
          <input
            type="checkbox"
            checked={selfLogin}
            onChange={(e) => {
              setSelfLogin(e.target.checked)
              void window.arbor.selfLoginSet(e.target.checked)
            }}
          />
          自启
        </label>
        <button className="ghost" onClick={() => window.arbor.openConfig()}>
          配置
        </button>
        <button className="ghost" onClick={() => void window.arbor.rescan().then(setData)}>
          重扫
        </button>
      </footer>
    </div>
  )
}

function Row({ app }: { app: AppView }) {
  const onClick = (): void => {
    if (app.type === 'web' && ['stopped', 'error', 'blocked'].includes(app.state)) {
      void window.arbor.start(app.name)
    } else {
      void window.arbor.open(app.name)
    }
  }
  const onContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    if (app.type === 'menubar') {
      void window.arbor.loginGet(app.name).then((checked) => {
        window.arbor.contextMenu(app.name, { loginChecked: checked ?? false })
      })
    } else {
      window.arbor.contextMenu(app.name)
    }
  }
  return (
    <div className="row" title={app.line ?? app.name} onClick={onClick} onContextMenu={onContextMenu}>
      {app.icon ? (
        <img className="icon" src={app.icon} alt="" />
      ) : (
        <span className="icon letter">{app.title[0]?.toUpperCase()}</span>
      )}
      <div className="meta">
        <div className="name">{app.title}</div>
        <div className="sub">{app.line ?? stateLabel[app.state]}</div>
      </div>
      <span className={`dot ${app.state}`} />
      <span className="tag">{app.type}</span>
    </div>
  )
}
