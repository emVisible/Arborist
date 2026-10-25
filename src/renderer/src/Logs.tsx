import { useEffect, useRef, useState } from 'react'

export default function LogView({ name }: { name: string }) {
  const [text, setText] = useState('')
  const [paused, setPaused] = useState(false)
  const boxRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const pull = (): void => {
      void window.arbor
        .tail(name, 400)
        .then((t) => {
          if (alive && !paused) setText(t)
        })
        .finally(() => {
          if (alive) timer = setTimeout(pull, 700)
        })
    }
    pull()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [name, paused])

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight)
  }, [text])

  return (
    <div className="logview">
      <header className="loghead">
        <span>日志 · {name}</span>
        <div className="logactions">
          <button className="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? '继续' : '暂停'}
          </button>
        </div>
      </header>
      <pre ref={boxRef} className="logbody">
        {text || '（暂无输出）'}
      </pre>
    </div>
  )
}
