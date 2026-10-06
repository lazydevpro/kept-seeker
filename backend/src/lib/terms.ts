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
 */
export const TERMS_VERSION = 2;

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
