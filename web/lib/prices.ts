/**
 * The market data behind §5.
 *
 * ── Two sources, deliberately treated differently ──
 *
 * **xStocks and crypto tick.** Jupiter's Price v3 is keyless and CORS-open — verified from the
 * browser — so those nine are fetched live on the client and the page shows a real price and a real 24h
 * move. Mints below were resolved from Jupiter's token search, not typed from memory: the
 * first draft of this file had `XsDoVfqe…` labelled SPYx when it is in fact Tesla.
 *
 * **Tessera does not tick.** Its API has no CORS headers, so a browser cannot reach it — but
 * more to the point, its numbers are *mark* prices on loan participation rights, not a traded
 * quote. Refreshing them every fifteen seconds would imply a liquidity that does not exist.
 * They are captured here with an as-of date and labelled as marks, which is both the honest
 * presentation and the more interesting one: the contrast between a ticking public market and
 * a quarterly-marked private one is the point of having both on the shelf.
 *
 * ── Why this bypasses our own Worker ──
 *
 * docs/plans/landing-page.md §7 called for proxying through the Worker so the mint list lives
 * in one place. Still the better shape, still blocked: `/v1/trades/*` sits behind
 * `app.use("/v1/*", authenticated)` and there is no Cloudflare account to deploy a public
 * route group to. Cost of going direct: this duplicates a list `backend/src/routes/trades.ts`
 * already owns, and rate limiting is Jupiter's rather than ours. When the Worker is live,
 * change `JUPITER_PRICE_URL` and nothing else in this file moves.
 *
 * ── Failure ──
 *
 * §9 criterion 7: a failed fetch shows the captured price and says it is stale. It never
 * shows a spinner or an error to a first-time reader.
 */

/*
 * Keyless, from the reader's browser, at Jupiter's keyless rate (0.5 req/s) — one page load
 * makes one request, so that is plenty. This was `lite-api.jup.ag`, which Jupiter is
 * retiring by cutting its limit until it is gone; keyless requests go to `api.jup.ag` now.
 */
const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v3'

/** Captured 2026-10-06. Also the resting state before the fetch lands. */
export const CAPTURED_ON = '6 October 2026'

export type Listing = {
  symbol: string
  name: string
  mint: string
  capturedPrice: number
  kind: 'stock' | 'crypto'
}

export const EQUITIES: Listing[] = [
  {
    symbol: 'SPYx',
    name: 'S&P 500',
    mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W',
    capturedPrice: 780.67,
    kind: 'stock',
  },
  {
    symbol: 'QQQx',
    name: 'Nasdaq 100',
    mint: 'Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ',
    capturedPrice: 762.73,
    kind: 'stock',
  },
  {
    symbol: 'NVDAx',
    name: 'NVIDIA',
    mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
    capturedPrice: 242.43,
    kind: 'stock',
  },
  {
    symbol: 'TSLAx',
    name: 'Tesla',
    mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    capturedPrice: 380.54,
    kind: 'stock',
  },
  {
    symbol: 'GLDx',
    name: 'Gold',
    mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re',
    capturedPrice: 381.38,
    kind: 'stock',
  },
  {
    symbol: 'COINx',
    name: 'Coinbase',
    mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu',
    capturedPrice: 191.94,
    kind: 'stock',
  },
]

/**
 * The crypto shelf, as the app has it (backend/src/routes/trades.ts): SOL under wrapped SOL's
 * mint, Coinbase's cbBTC, and SKR. Mints checked against Jupiter's token search.
 */
export const CRYPTO: Listing[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    capturedPrice: 121.71,
    kind: 'crypto',
  },
  {
    symbol: 'cbBTC',
    name: 'Bitcoin',
    mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',
    capturedPrice: 86580.65,
    kind: 'crypto',
  },
  {
    symbol: 'SKR',
    name: 'Seeker',
    mint: 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
    capturedPrice: 0.0175,
    kind: 'crypto',
  },
]

/** Everything the page quotes live, in the order the ticker lists it. */
export const LISTINGS: Listing[] = [...CRYPTO, ...EQUITIES]

export type Quote = {
  symbol: string
  name: string
  kind: Listing['kind']
  price: number
  change24h: number | null
  stale: boolean
}

type JupiterRecord = { usdPrice?: number; priceChange24h?: number }

export async function fetchQuotes(signal?: AbortSignal): Promise<Quote[]> {
  const stale = (listing: Listing): Quote => ({
    symbol: listing.symbol,
    name: listing.name,
    kind: listing.kind,
    price: listing.capturedPrice,
    change24h: null,
    stale: true,
  })

  try {
    const ids = LISTINGS.map((l) => l.mint).join(',')
    const response = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`, { signal })
    if (!response.ok) return LISTINGS.map(stale)
    const body = (await response.json()) as Record<string, JupiterRecord>

    return LISTINGS.map((listing) => {
      const record = body[listing.mint]
      if (!record || typeof record.usdPrice !== 'number') return stale(listing)
      return {
        symbol: listing.symbol,
        name: listing.name,
        kind: listing.kind,
        price: record.usdPrice,
        change24h: typeof record.priceChange24h === 'number' ? record.priceChange24h : null,
        stale: false,
      }
    })
  } catch {
    return LISTINGS.map(stale)
  }
}

/** Cheap tokens keep four places: SKR reads "0.0175", not a rounded "0.02". */
export const money = (value: number) => {
  const digits = value >= 1 ? 2 : 4
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Four significant figures is enough to see the amount move without implying false precision. */
export const units = (value: number) =>
  value < 1 ? value.toFixed(4) : value.toLocaleString('en-US', { maximumFractionDigits: 3 })
