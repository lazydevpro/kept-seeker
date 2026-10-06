/**
 * Exports the deck (app/deck) to a PDF, one 16:9 page per slide, plus a PNG of each slide.
 *
 *   npm run build && node scripts/deck-export.mjs
 *
 * Serves the static export itself and prints it with the headless Chrome that the video
 * workspace already installs (`cd ../video && npm install` if it is missing). Writes
 * ../docs/kept-deck.pdf and out/deck-slides/NN.png.
 */

import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const ROOT = path.resolve('out')
const PDF = path.resolve('..', 'docs', 'kept-deck.pdf')
const PNGS = path.join(ROOT, 'deck-slides')
const CHROME = path.resolve(
  '../video/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell',
)
const PORT = 8097
const DEBUG = 9334

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

if (!existsSync(path.join(ROOT, 'deck.html'))) throw new Error('No out/deck.html — run `npm run build` first.')
if (!existsSync(CHROME)) throw new Error('No headless Chrome — run `npm install` in ../video first.')

const server = createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  // `deck.html` before the `deck/` folder: the folder only holds the deck's images.
  if (existsSync(`${file}.html`)) file = `${file}.html`
  else if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
  if (!existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}).listen(PORT)

const profile = '/tmp/kept-deck-export'
rmSync(profile, { recursive: true, force: true })
const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--hide-scrollbars'],
  {
    stdio: 'ignore',
  },
)

try {
  let ready = false
  for (let i = 0; i < 50 && !ready; i++) {
    await sleep(200)
    ready = await fetch(`http://127.0.0.1:${DEBUG}/json/version`).then(
      () => true,
      () => false,
    )
  }
  const target = await fetch(`http://127.0.0.1:${DEBUG}/json/new?about:blank`, { method: 'PUT' }).then((r) =>
    r.json(),
  )
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value

  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: `http://localhost:${PORT}/deck` })
  await sleep(1500)
  await evaluate(
    `Promise.all([document.fonts.ready, ...[...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))])`,
  )
  await sleep(500)

  // The on-screen "n / N" counter follows the deck's own state, not the slide this script
  // shows, so it read "1 / N" on every PNG. Print already hides it.
  await evaluate(`document.querySelectorAll('[class*="counter"]').forEach((el) => el.remove())`)
  const count = await evaluate(`document.querySelectorAll('[data-active]').length`)
  mkdirSync(PNGS, { recursive: true })
  for (let slide = 0; slide < count; slide++) {
    await evaluate(
      `document.querySelectorAll('[data-active]').forEach((el, i) => el.setAttribute('data-active', String(i === ${slide})))`,
    )
    await sleep(300)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(PNGS, `${String(slide + 1).padStart(2, '0')}.png`), Buffer.from(data, 'base64'))
  }

  const { data } = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  })
  writeFileSync(PDF, Buffer.from(data, 'base64'))
  console.log(
    `${count} slides → ${path.relative(process.cwd(), PDF)} and ${path.relative(process.cwd(), PNGS)}/`,
  )
  ws.close()
} finally {
  chrome.kill()
  server.close()
}
