import {
  AppIdentity,
  createSolanaDevnet,
  createSolanaMainnet,
  createSolanaTestnet,
  SolanaCluster,
} from '@wallet-ui/react-native-kit'
import { Platform } from 'react-native'

/** The public site: invites land here, and it hosts the terms and privacy policy. */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://kept-seeker.pages.dev'

export class AppConfig {
  static siteUrl = SITE_URL
  /**
   * What the wallet shows when it asks the reader to approve KEPT. It used to be the
   * staging web build's workers.dev hostname — the first thing anyone saw when
   * connecting a wallet. `icon` is resolved against `uri`.
   */
  static identity: AppIdentity = { name: 'KEPT', uri: SITE_URL, icon: 'icon.png' }
  static termsUrl = `${SITE_URL}/terms`
  static privacyUrl = `${SITE_URL}/privacy`
  static apiUrl = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? devApiUrl() : missingApiUrl())
  static networks: SolanaCluster[] =
    process.env.EXPO_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta'
      ? [createSolanaMainnet({ url: process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com' })]
      : [
          createSolanaDevnet({ url: 'https://api.devnet.solana.com' }),
          createSolanaTestnet({ url: 'https://api.testnet.solana.com' }),
        ]
}

function devApiUrl() {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787'
  // On web the session cookie has to be same-site, and cookies ignore the port but not the
  // host — so the API must share the page's hostname. Pointing web at 127.0.0.1 while the
  // dev server serves localhost makes every authenticated request anonymous.
  if (Platform.OS === 'web') return `http://${globalThis.location?.hostname ?? 'localhost'}:8787`
  return 'http://127.0.0.1:8787'
}

function missingApiUrl(): never {
  throw new Error('EXPO_PUBLIC_API_URL is required for release builds.')
}
