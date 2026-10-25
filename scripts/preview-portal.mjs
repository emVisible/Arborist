// 门户预览：不起 Electron，用假数据服务 resources/portal/index.html（pnpm preview:portal）
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(root, 'resources/portal/index.html'), 'utf8')

const apps = [
  { name: 'ametrine', title: 'Ametrine', type: 'web', state: 'running', line: '3 docs indexed · 2 sessions', url: 'http://127.0.0.1:8710' },
  { name: 'hertz', title: 'Hertz', type: 'app', state: 'stopped' },
  { name: 'axiforge', title: 'Axiforge', type: 'app', state: 'running' },
  { name: 'thistelles', title: 'Thistelles', type: 'menubar', state: 'stopped' },
  { name: 'ginko', title: 'Ginko', type: 'web', state: 'error', line: '探测失败：服务无响应', url: 'http://127.0.0.1:8711' }
]

createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html)
  } else if (req.url === '/api/apps') {
    if (req.headers['x-arbor'] !== '1') { res.writeHead(403).end(); return }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ apps, errors: [] }))
  } else {
    res.writeHead(404).end()
  }
}).listen(5178, '127.0.0.1', () => console.log('portal preview: http://127.0.0.1:5178/'))
