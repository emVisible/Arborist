// 浏览器预览渲染层（不启动 Electron）：pnpm preview:ui
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  server: { port: 5177 }
})
