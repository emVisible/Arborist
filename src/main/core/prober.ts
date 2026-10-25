import { connect } from 'node:net'
import type { Manifest } from './registry'

export type ContractState = 'ok' | 'starting' | 'degraded' | 'error'

export interface Probe {
  reachable: boolean
  state?: ContractState
  line?: string
  url?: string
  source: 'contract' | 'ready' | 'tcp' | 'none'
}

// 降级链：/api/arbor/status 契约 → manifest.ready 探测 → tcp
export async function probeApp(m: Manifest, timeoutMs = 1500): Promise<Probe> {
  if (!m.url) return { reachable: false, source: 'none' }
  const origin = m.url.replace(/\/+$/, '')

  const contract = await tryContract(`${origin}/api/arbor/status`, timeoutMs)
  if (contract) return contract

  if (m.ready === 'tcp') return tryTcp(origin, timeoutMs)

  const readyUrl = (() => {
    if (!m.ready) return `${origin}/`
    if (/^https?:\/\//.test(m.ready)) return m.ready // 绝对 URL
    // 相对形式：http:/healthz → origin + /healthz
    return origin + m.ready.slice('http:'.length)
  })()
  return tryHttp(readyUrl, timeoutMs)
}

async function tryContract(url: string, timeoutMs: number): Promise<Probe | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const body = (await res.json()) as { state?: unknown; line?: unknown; url?: unknown }
    const states: ContractState[] = ['ok', 'starting', 'degraded', 'error']
    if (typeof body.state !== 'string' || !states.includes(body.state as ContractState)) {
      return null
    }
    return {
      reachable: true,
      state: body.state as ContractState,
      line: typeof body.line === 'string' ? body.line : undefined,
      url: typeof body.url === 'string' ? body.url : undefined,
      source: 'contract'
    }
  } catch {
    return null
  }
}

async function tryHttp(url: string, timeoutMs: number): Promise<Probe> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' })
    return { reachable: res.ok, state: res.ok ? 'ok' : undefined, source: 'ready' }
  } catch {
    return { reachable: false, source: 'ready' }
  }
}

function tryTcp(origin: string, timeoutMs: number): Promise<Probe> {
  const { hostname, port } = new URL(origin)
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port) || 80 })
    const done = (reachable: boolean): void => {
      socket.destroy()
      resolve({ reachable, state: reachable ? 'ok' : undefined, source: 'tcp' })
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}
