import { Platform } from 'react-native'
import { AppConfig } from '@/constants/app-config'

/**
 * Demo mode — for screen-recording the app in a browser.
 *
 * On: a development build, on web, opened once with `?demo` (it then holds for the
 * tab, because the router drops the query on the first navigation). Off everywhere
 * else, and `__DEV__` is false in every release build, so none of this can reach a
 * phone.
 *
 * What changes: the wallet is a key kept in this browser (`demo-wallet.ts`) — it
 * connects and signs like one, and the server checks those signatures for real — and
 * a purchase is sent as a demo order, which only a local server accepts: priced with
 * a real quote, settled instantly, never sent to a chain. Everything after that — the
 * ring, the circle post, the portfolio — is the ordinary app reading ordinary data.
 */

const FLAG = 'kept:demo'

function readDemo() {
  if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).has('demo')) {
      window.sessionStorage.setItem(FLAG, '1')
      return true
    }
    return window.sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

export const DEMO = readDemo()

/*
 * Starting a fresh take. The account is deleted on the local server, this browser
 * forgets it (and the demo wallet), and the app reopens as a new person:
 *
 *   ?demo=reset       at the first onboarding screen
 *   ?demo=returning   past onboarding, on the home screen — for an account the demo seed
 *                     then fills with weeks of history (`npm run db:seed:demo`)
 */
const take = DEMO ? new URLSearchParams(window.location.search).get('demo') : null
if (take === 'reset' || take === 'returning') {
  void (async () => {
    await fetch(`${AppConfig.apiUrl}/v1/me`, { method: 'DELETE', credentials: 'include' }).catch(() => undefined)
    window.localStorage.clear()
    // Onboarding's own flag (`onboarding-state.ts`), so the app opens on the home screen.
    if (take === 'returning') window.localStorage.setItem('kept:onboarding:complete', 'true')
    window.sessionStorage.setItem(FLAG, '1')
    window.location.replace('/?demo')
  })()
}

/*
 * Development warnings draw a toast over the bottom of the screen — in the recording.
 * These three come from libraries rendering to the DOM and say nothing about the app;
 * they are dropped before the overlay sees them. Anything else still shows, so a real
 * error during a take is not hidden.
 */
const NOISE = ['non-boolean attribute', 'props.pointerEvents is deprecated', '"shadow*" style props are deprecated']
if (DEMO) {
  for (const level of ['error', 'warn'] as const) {
    const next = console[level]
    console[level] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && NOISE.some((noise) => (args[0] as string).includes(noise))) return
      next(...args)
    }
  }
}

/** How long a wallet takes to come back, so a recording has the beat a real approval has. */
export const walletPause = (ms = 900) => new Promise<void>((resolve) => setTimeout(resolve, ms))
