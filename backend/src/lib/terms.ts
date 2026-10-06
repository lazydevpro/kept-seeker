/**
 * The terms a buyer agrees to, and who may not buy.
 *
 * One place, because three surfaces have to say the same thing: the purchase
 * sheet's attestation, the site's /terms page, and this server's refusal. If
 * they drifted, the app would ask someone to confirm one list while the terms
 * they agreed to named another.
 *
 * The jurisdictions follow the issuer's restrictions on xStocks as publicly
 * documented (U.S. persons excluded; not offered in Canada, the United Kingdom or
 * Australia) plus comprehensively sanctioned countries. The authoritative list is
 * the issuer's own, at https://assets.backed.fi/legal-documentation — review it
 * before launch, and again whenever it changes.
 *
 * Raising TERMS_VERSION asks everyone to agree again on their next purchase.
 * 2 (7 Oct 2026): crypto added to the shelf and to §3–§5 of the terms.
 * 3 (7 Oct 2026): crypto has its own, shorter list; the full one is for
 * tokenized stocks only (private markets are off in the Seeker build).
 */
export const TERMS_VERSION = 3;

/**
 * Who may not buy crypto (SOL, cbBTC, SKR). No issuer restricts these the way
 * xStocks and Tessera do, so only two things apply: U.S. embargoes — the same
 * regions the Solana dApp Store's own terms exclude (§4.2.5) — and the United
 * Kingdom, whose rules on promoting crypto to consumers KEPT does not meet.
 */
export const CRYPTO_RESTRICTED_JURISDICTIONS = [
  "the United Kingdom",
  "Cuba",
  "Iran",
  "North Korea",
  "Syria",
  "the Crimea, Donetsk and Luhansk regions",
] as const;

/** Who may not buy tokenized stocks: the issuer's list. */
export const RESTRICTED_JURISDICTIONS = [
  "the United States",
  "Canada",
  "the United Kingdom",
  "Australia",
  "Cuba",
  "Iran",
  "North Korea",
  "Syria",
  "the Crimea, Donetsk and Luhansk regions",
] as const;
