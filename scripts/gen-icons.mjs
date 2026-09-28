// PWA のアイコン（PNG）を生成する。外部のツールや画像は使わない。
// 使い方: npm run icons
// 図柄：母（ローズ）・父（ブルー）・子（グリーン）の3つの丸。
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const OUT = resolve(import.meta.dirname, '..', 'public', 'icons')
const BG = [23, 23, 23] // #171717
const ROSE = [251, 113, 133]
const BLUE = [96, 165, 250]
const GREEN = [74, 222, 128]
const SS = 4 // アンチエイリアス用の倍率

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // ビット深度
  header[9] = 6 // RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * @param size 出力の一辺（px）
 * @param scale 図柄の大きさ（1＝通常、maskable は安全領域に収めるため小さくする）
 */
function draw(size, scale) {
  const n = size * SS
  const circles = [
    { x: 0.37, y: 0.4, r: 0.2, color: ROSE },
    { x: 0.63, y: 0.4, r: 0.2, color: BLUE },
    { x: 0.5, y: 0.68, r: 0.13, color: GREEN },
  ].map((c) => ({
    x: (0.5 + (c.x - 0.5) * scale) * n,
    y: (0.5 + (c.y - 0.5) * scale) * n,
    r: c.r * scale * n,
    color: c.color,
  }))

  const out = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px * SS + sx + 0.5
          const y = py * SS + sy + 0.5
          let color = BG
          for (const c of circles) {
            if ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r ** 2) color = c.color
          }
          r += color[0]
          g += color[1]
          b += color[2]
        }
      }
      const i = (py * size + px) * 4
      const samples = SS * SS
      out[i] = Math.round(r / samples)
      out[i + 1] = Math.round(g / samples)
      out[i + 2] = Math.round(b / samples)
      out[i + 3] = 255
    }
  }
  return out
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#171717"/>
  <circle cx="37" cy="40" r="20" fill="#fb7185"/>
  <circle cx="63" cy="40" r="20" fill="#60a5fa"/>
  <circle cx="50" cy="68" r="13" fill="#4ade80"/>
</svg>
`

mkdirSync(OUT, { recursive: true })
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.9 },
]
for (const t of targets) {
  writeFileSync(resolve(OUT, t.file), encodePng(t.size, draw(t.size, t.scale)))
  console.log(`${t.file} (${t.size}x${t.size})`)
}
writeFileSync(resolve(OUT, 'favicon.svg'), FAVICON, 'utf8')
console.log('favicon.svg')
