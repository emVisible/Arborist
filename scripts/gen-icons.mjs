// Generates tray template icons (black + alpha) and the app icon.
// Zero dependencies: PNGs are written via zlib-deflated scanlines.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function png(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// coverage of a shape edge with ~1px antialiasing
function cover(dist) {
  return Math.max(0, Math.min(1, dist + 0.5))
}

function trayGlyph(size) {
  const px = new Uint8Array(size * size * 4)
  const s = size / 16
  const canopy = { cx: 8 * s, cy: 6.1 * s, r: 4.6 * s }
  const trunk = { x0: 7.1 * s, x1: 8.9 * s, y0: 9.4 * s, y1: 15 * s }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dCanopy = canopy.r - Math.hypot(x + 0.5 - canopy.cx, y + 0.5 - canopy.cy)
      const dTrunk = Math.min(
        x + 0.5 - trunk.x0,
        trunk.x1 - x - 0.5,
        y + 0.5 - trunk.y0,
        trunk.y1 - y - 0.5
      )
      const a = Math.round(cover(Math.max(dCanopy, dTrunk)) * 255)
      const i = (y * size + x) * 4
      px[i] = 0
      px[i + 1] = 0
      px[i + 2] = 0
      px[i + 3] = a
    }
  }
  return png(size, px)
}

function appIcon(size) {
  const px = new Uint8Array(size * size * 4)
  const r = size * 0.225
  const inRound = (x, y) => {
    const dx = Math.min(x, size - x)
    const dy = Math.min(y, size - y)
    const m = Math.min(dx, dy)
    if (m > r) return cover(Math.min(x, size - x, y, size - y))
    const cx = dx === m ? (x < size / 2 ? r : size - r) : x
    const cy = dy === m ? (y < size / 2 ? r : size - r) : y
    return cover(r - Math.hypot(x - cx, y - cy))
  }
  const set = (i, hex, a) => {
    px[i] = parseInt(hex.slice(0, 2), 16)
    px[i + 1] = parseInt(hex.slice(2, 4), 16)
    px[i + 2] = parseInt(hex.slice(4, 6), 16)
    px[i + 3] = Math.round(a * 255)
  }
  const bgC = { x: size / 2, y: size * 0.42, r: size * 0.29 }
  const trunk = {
    x0: size * 0.462,
    x1: size * 0.538,
    y0: size * 0.58,
    y1: size * 0.84
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const bgA = inRound(x + 0.5, y + 0.5)
      if (bgA <= 0) continue
      set(i, '1d232e', bgA)
      const dCanopy = bgC.r - Math.hypot(x + 0.5 - bgC.x, y + 0.5 - bgC.y)
      const dTrunk = Math.min(
        x + 0.5 - trunk.x0,
        trunk.x1 - x - 0.5,
        y + 0.5 - trunk.y0,
        trunk.y1 - y - 0.5
      )
      const treeA = cover(Math.max(dCanopy, dTrunk))
      if (treeA > 0) {
        const isCanopy = dCanopy >= dTrunk
        set(i, isCanopy ? '46c07a' : 'a97e5b', treeA)
      }
    }
  }
  return png(size, px)
}

// 告警托盘图标：黑树 + 右上红点（非 template，macOS 不再单色渲染）
function alertGlyph(size) {
  const px = new Uint8Array(size * size * 4)
  const s = size / 16
  const canopy = { cx: 7.2 * s, cy: 6.6 * s, r: 4.4 * s }
  const trunk = { x0: 6.3 * s, x1: 8.1 * s, y0: 10 * s, y1: 15 * s }
  const dot = { cx: 13.2 * s, cy: 3.6 * s, r: 2.5 * s }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dCanopy = canopy.r - Math.hypot(x + 0.5 - canopy.cx, y + 0.5 - canopy.cy)
      const dTrunk = Math.min(
        x + 0.5 - trunk.x0,
        trunk.x1 - x - 0.5,
        y + 0.5 - trunk.y0,
        trunk.y1 - y - 0.5
      )
      const treeA = cover(Math.max(dCanopy, dTrunk))
      const dotA = cover(dot.r - Math.hypot(x + 0.5 - dot.cx, y + 0.5 - dot.cy))
      const i = (y * size + x) * 4
      if (dotA > 0) {
        px[i] = 248
        px[i + 1] = 81
        px[i + 2] = 73
        px[i + 3] = Math.round(dotA * 255)
      } else {
        px[i] = 0
        px[i + 1] = 0
        px[i + 2] = 0
        px[i + 3] = Math.round(treeA * 255)
      }
    }
  }
  return png(size, px)
}

mkdirSync(join(root, 'resources/tray'), { recursive: true })
writeFileSync(join(root, 'resources/tray/iconTemplate.png'), trayGlyph(16))
writeFileSync(join(root, 'resources/tray/iconTemplate@2x.png'), trayGlyph(32))
writeFileSync(join(root, 'resources/tray/iconAlert.png'), alertGlyph(16))
writeFileSync(join(root, 'resources/tray/iconAlert@2x.png'), alertGlyph(32))
writeFileSync(join(root, 'resources/icon.png'), appIcon(1024))
console.log('icons written to resources/')
