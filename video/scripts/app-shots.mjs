/**
 * Screenshots of the real app for the pitch deck — phone-sized, @3x, from the demo build.
 *
 *   # the local API (backend: npx wrangler dev --port 8787) and the web build
 *   # (mobile: EXPO_PUBLIC_SOLANA_CLUSTER=mainnet-beta npx expo start --web --port 8098)
 *   # must both be running first
 *   node scripts/app-shots.mjs
 *
 * Drives Remotion's headless Chrome over the DevTools protocol, with its own browser
 * profile, so it signs in as its own account and never touches one you are using. It
 * walks onboarding as a new person, fills that account with the demo seed's history,
 * then photographs the lived-in app and a demo purchase (see mobile/features/demo).
 *
 * Writes web/public/deck/shots/*.jpg.
 */

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const APP = 'http://localhost:8098'
const API = 'http://localhost:8787'
const OUT = path.resolve('..', 'web', 'public', 'deck', 'shots')
const CHROME = path.resolve(
  'node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell',
)
const PORT = 9333
const PROFILE = '/tmp/kept-app-shots'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

rmSync(PROFILE, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars'],
  {
    stdio: 'ignore',
  },
)

let version
for (let i = 0; i < 50 && !version; i++) {
  await sleep(200)
  version = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    .then((r) => r.json())
    .catch(() => undefined)
}
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then(
  (r) => r.json(),
)
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))

let nextId = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  mobile: true,
})
await send('Emulation.setTouchEmulationEnabled', { enabled: false })

const go = async (url) => {
  await send('Page.navigate', { url })
  await sleep(1500)
}

const waitForText = async (text, timeout = 30000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (await evaluate(`document.body?.innerText.includes(${JSON.stringify(text)})`)) return
    await sleep(300)
  }
  throw new Error(`Timed out waiting for "${text}"`)
}

const waitForPattern = async (pattern, timeout = 60000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (
      await evaluate(`new RegExp(${JSON.stringify(pattern)}).test(document.body?.innerText ?? '')`)
    )
      return
    await sleep(400)
  }
  throw new Error(`Timed out waiting for /${pattern}/`)
}

/** Click the smallest visible element whose text is exactly `text` (or starts with it). */
const click = async (text, { exact = false } = {}) => {
  const box = await evaluate(`(() => {
    const want = ${JSON.stringify(text)}
    const match = (t) => ${exact ? 't === want' : 't === want || t.startsWith(want)'}
    const els = [...document.querySelectorAll('body *')].filter((el) => {
      const t = (el.innerText || el.getAttribute('aria-label') || '').trim()
      if (!match(t)) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight
    })
    els.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)
    const el = els[0]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (!box) throw new Error(`Nothing to click: "${text}"`)
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1,
    })
  await sleep(900)
}

const typeInto = async (placeholder, text) => {
  await evaluate(
    `document.querySelector('input[placeholder=${JSON.stringify(placeholder)}]').focus()`,
  )
  await send('Input.insertText', { text })
  await sleep(400)
}

const shot = async (name, settle = 1200) => {
  await sleep(settle)
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 })
  writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(data, 'base64'))
  console.log(`  ${name}.jpg`)
}

try {
  // ── A new person: onboarding ─────────────────────────────────────────────────────
  await go(`${APP}/?demo=reset`)
  await waitForText('Get started')
  await shot('onboarding-welcome', 3500)
  await click('Get started')
  await waitForText('What are you growing toward?')
  await click('Build a habit')
  await waitForText('Pick a promise you can keep.')
  await click('$25', { exact: true })
  await shot('onboarding-promise')
  await click('$25 every')
  await waitForText('Keep week one')
  await click('Keep week one')
  await click('Continue')
  await waitForText('What should your circle call you?')
  await typeInto('Your first name', 'Asha')
  await shot('onboarding-name')
  await click('Continue')
  await waitForText('Better with someone.')
  await click('Start solo')
  await waitForText('See my week')
  await shot('onboarding-ready')
  await click('See my week')
  await waitForText('Keep this week')

  // ── Weeks later: the same account, with history ─────────────────────────────────
  const me = await evaluate(
    `fetch('${API}/v1/me', { credentials: 'include' }).then((r) => r.json())`,
  )
  execFileSync('npm', ['run', 'db:seed:demo', '--', '--name', 'Asha', me.profile.id], {
    cwd: path.resolve('..', 'backend'),
    stdio: 'ignore',
  })
  await go(`${APP}/`)
  await waitForText('weeks kept in a row')
  await shot('home', 2500)

  await go(`${APP}/circle`)
  await waitForText('Encouragement')
  await shot('circle', 1800)

  await go(`${APP}/awards`)
  await sleep(2500)
  await shot('awards', 1500)

  await go(`${APP}/invest`)
  await waitForText('Public markets')
  // The shelf is only worth photographing — and tapping — once live prices are on it.
  await waitForPattern('SPYx[\\s\\S]{0,40}\\$\\d')
  await shot('invest', 1500)

  // ── A purchase ───────────────────────────────────────────────────────────────────
  await click('S&P 500')
  await waitForText('Past month')
  await shot('asset', 2500)
  await click('Buy SPYx')
  await waitForText('Connect wallet')
  await click('Connect wallet')
  await waitForText('Sign to verify wallet')
  await click('Sign to verify wallet')
  await waitForText('I am not a U.S. person', 15000)
  await click('I am not a U.S. person')
  await waitForText('You receive')
  // The quote is live and the sheet asks once. If that first ask met a slow price feed,
  // stepping the amount away and back asks again.
  for (let attempt = 0; attempt < 4; attempt++) {
    const quoted = await waitForText('≈', 12000).then(
      () => true,
      () => false,
    )
    if (quoted) break
    await click('$50', { exact: true })
    await click('$25', { exact: true })
  }
  await waitForText('≈', 5000)
  await shot('purchase', 800)
  await click('Buy $25')
  await waitForText('Approve in wallet')
  await click('Approve in wallet')
  await waitForText('That’s in.', 20000)
  await shot('kept', 1500)
  await waitForText('Week kept', 30000)
  await shot('kept-verified', 800)

  await go(`${APP}/`)
  await waitForText('weeks kept in a row')
  await shot('home-kept', 2500)

  await go(`${APP}/circle`)
  await waitForText('Kept this week’s promise')
  await shot('circle-kept', 1800)
} finally {
  ws.close()
  chrome.kill()
}
