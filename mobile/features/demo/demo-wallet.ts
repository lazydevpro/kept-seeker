import { useSyncExternalStore } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { createKeyPairFromPrivateKeyBytes, getAddressFromPublicKey, signBytes } from '@solana/kit'
import { DEMO, walletPause } from './demo'

/**
 * The wallet the app talks to: Mobile Wallet Adapter, or in demo mode a stand-in.
 *
 * The stand-in is a real Ed25519 key, kept in this browser's storage so the same
 * wallet comes back after a reload. Connecting and signing a challenge work exactly
 * as they would with a wallet app — the server verifies the signature — so linking,
 * restoring and the purchase gate are the real code paths. It does not sign
 * transactions: demo purchases never produce one (see `demo.ts`).
 */

const SEED = 'kept:demo-wallet-seed'
const CONNECTED = 'kept:demo-wallet-address'

type DemoAccount = { address: string }

function seed() {
  const saved = window.localStorage.getItem(SEED)
  if (saved) return Uint8Array.from(JSON.parse(saved) as number[])
  const fresh = crypto.getRandomValues(new Uint8Array(32))
  window.localStorage.setItem(SEED, JSON.stringify(Array.from(fresh)))
  return fresh
}

let keys: Promise<CryptoKeyPair> | null = null
const keyPair = () => (keys ??= createKeyPairFromPrivateKeyBytes(seed()))

let account: DemoAccount | null = null
if (DEMO) {
  const address = window.localStorage.getItem(CONNECTED)
  account = address ? { address } : null
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const set = (next: DemoAccount | null) => {
  account = next
  if (next) window.localStorage.setItem(CONNECTED, next.address)
  else window.localStorage.removeItem(CONNECTED)
  listeners.forEach((listener) => listener())
}

function useDemoWallet() {
  const current = useSyncExternalStore(
    subscribe,
    () => account,
    () => null,
  )
  return {
    account: current,
    connect: async () => {
      await walletPause(700)
      const next = { address: String(await getAddressFromPublicKey((await keyPair()).publicKey)) }
      set(next)
      return next
    },
    disconnect: async () => set(null),
    signMessages: async (message: Uint8Array) => {
      await walletPause()
      return new Uint8Array(await signBytes((await keyPair()).privateKey, message))
    },
    signTransactions: async (): Promise<never> => {
      throw new Error('Demo mode does not sign transactions.')
    },
  }
}

export const useWallet: typeof useMobileWallet = DEMO
  ? (useDemoWallet as unknown as typeof useMobileWallet)
  : useMobileWallet
