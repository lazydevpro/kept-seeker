/**
 * Where things live. One file, so moving to a custom domain or publishing the app is a
 * one-line change rather than a search.
 */

/** The site's own origin. Absolute URLs in metadata, the sitemap and the OG image need it. */
export const SITE_URL = 'https://kept-seeker.pages.dev'

/** The production Worker. Only the public invite preview is called from here. */
export const API_URL = 'https://kept-seeker-api.keptseeker.workers.dev'

export const SOURCE_URL = 'https://github.com/lazydevpro/kept-seeker'

/**
 * The Solana dApp Store listing, once there is one. While it is null, every "get the app"
 * call to action offers the beta APK below instead — behind a notice that says what a beta
 * on mainnet means. Setting this one constant turns them all into store links.
 */
export const DAPP_STORE_URL: string | null = null

/**
 * The current beta, straight from its GitHub release.
 *
 * The tag is spelled out rather than using `/releases/latest/`: GitHub's "latest" skips
 * pre-releases, and the beta is one, so `latest` would 404. Bump all three together when a
 * new APK is published (`mobile/npm run release:apk`, then `gh release create`).
 */
export const BETA = {
  version: '1.1.0',
  apkUrl: 'https://github.com/lazydevpro/kept-seeker/releases/download/v1.1.0/kept-1.1.0.apk',
  releaseUrl: 'https://github.com/lazydevpro/kept-seeker/releases/tag/v1.1.0',
  sizeMb: 81,
  minAndroid: '7.0',
} as const

/** The app's custom scheme, for "Open in KEPT" on the invite page. */
export const APP_SCHEME = 'keptseeker'
