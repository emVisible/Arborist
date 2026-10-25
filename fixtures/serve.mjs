// HTTP fixture：/healthz 返回 200，/api/arbor/status 自报契约状态。
import http from 'node:http'

const port = Number(process.argv[2] ?? 8765)

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200).end('ok')
  } else if (req.url === '/api/arbor/status') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ state: 'ok', line: 'fixture ok' }))
  } else {
    res.writeHead(404).end()
  }
})

server.listen(port, '127.0.0.1', () => console.log(`listening ${port}`))
