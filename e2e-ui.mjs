import { JSDOM } from 'jsdom'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// 1) 用 Vite 以客户端模式打包（Svelte 组件编译为 DOM 版）
execSync('npx vite build --config .uitest/vite.uitest.config.mjs --logLevel error', { stdio: 'inherit' })

// 2) 准备 jsdom
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
})
const { window } = dom
// 将 jsdom window 中全局需要的构造器与 API 注入 Node 全局
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue
  try { globalThis[key] = window[key] } catch {}
}
globalThis.self = window
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
window.requestAnimationFrame = cb => setTimeout(cb, 16)
window.cancelAnimationFrame = id => clearTimeout(id)
window.structuredClone = v => JSON.parse(JSON.stringify(v))
window.scrollTo = () => {}
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

// 3) 执行打包产物
const bundle = readFileSync('.uitest/dist/bundle.js', 'utf8')
window.eval(bundle)
const mod = window.__uitest

// 4) 跑用例
const results = await window.__uitest.run()
let failed = 0
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${!r.ok && r.detail ? ' — ' + r.detail : ''}`)
  if (!r.ok) failed++
}
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
