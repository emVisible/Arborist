import { createServer } from 'node:net'

export function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
  })
}

export async function waitFor(
  cond: () => boolean | Promise<boolean>,
  ms: number
): Promise<void> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (await cond()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('waitFor timeout')
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
