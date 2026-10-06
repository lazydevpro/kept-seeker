/**
 * The restricted list, as the site's /terms page states it.
 *
 * The source of truth is `backend/src/lib/terms.ts` — it is what the server enforces and what
 * the app's purchase sheet shows. This copy exists because the site is a separate static
 * build with no path into the backend workspace. Change both together, and raise
 * TERMS_VERSION there when the change is material.
 */
export const TERMS_VERSION = 3

/** Who may not buy crypto (SOL, cbBTC, SKR): U.S. embargoes and the United Kingdom. */
export const CRYPTO_RESTRICTED_JURISDICTIONS = [
  'the United Kingdom',
  'Cuba',
  'Iran',
  'North Korea',
  'Syria',
  'the Crimea, Donetsk and Luhansk regions',
] as const

/** Who may not buy tokenized stocks: the issuer's list. */
export const RESTRICTED_JURISDICTIONS = [
  'the United States',
  'Canada',
  'the United Kingdom',
  'Australia',
  'Cuba',
  'Iran',
  'North Korea',
  'Syria',
  'the Crimea, Donetsk and Luhansk regions',
] as const
