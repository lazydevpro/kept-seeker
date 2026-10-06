import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/lib/api'
import { DEMO } from '@/features/demo/demo'

export interface InvestableAsset {
  name: string
  symbol: string
  logo: string
  description: string
  mint: string
  available: boolean
  supportsAtomicSwaps: boolean
  provider: 'xstocks' | 'tessera' | 'crypto'
  instrument: 'tokenized_stock' | 'loan_participation' | 'crypto'
  transferFeeBps: number
  /** Null when the asset has no quote — illiquid mints often don't. Never zero. */
  priceUsd?: number | null
  priceChange24h?: number | null
}

export interface TradeOrder {
  transaction: string
  requestId: string
  inAmount: string
  outAmount: string
  inUsdValue?: number
  outUsdValue?: number
  priceImpact?: number
  router: string
  mode: 'sandbox' | 'live'
  feeBps: number
  expireAt?: string
}

export function useInvestableAssets() {
  return useQuery({
    queryKey: ['investable-assets'],
    queryFn: () => apiRequest<{ assets: InvestableAsset[] }>('/v1/trades/assets?symbols=SOL,cbBTC,SKR,SPYx,QQQx,TSLAx'),
    staleTime: 60 * 60_000,
    retry: 1,
  })
}

/**
 * What the buy ticket shows above the amount field: the price, which way it has
 * moved, and how deep the market is. Every field is nullable — an illiquid mint
 * genuinely has no 24h volume, and a blank is honest where a zero would not be.
 */
export interface AssetDetail {
  mint: string
  symbol: string
  name: string
  logo: string
  provider: 'xstocks' | 'tessera' | 'crypto' | null
  instrument: 'tokenized_stock' | 'loan_participation' | 'crypto' | null
  transferFeeBps: number
  available: boolean
  decimals: number | null
  priceUsd: number | null
  change5m: number | null
  change1h: number | null
  change6h: number | null
  change24h: number | null
  liquidityUsd: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  holders: number | null
  verified: boolean | null
}

export function useAssetDetail(mint: string | null) {
  return useQuery({
    queryKey: ['asset-detail', mint],
    queryFn: () => apiRequest<{ asset: AssetDetail }>(`/v1/trades/asset?mint=${encodeURIComponent(mint!)}`),
    enabled: Boolean(mint),
    // Prices move; this is the number someone is deciding on.
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
}

export const CHART_RANGES = ['1D', '1W', '1M', '1Y'] as const
export type ChartRange = (typeof CHART_RANGES)[number]

export type PriceChart = {
  mint: string
  range: ChartRange
  /** Closes only — this is a line, not a candlestick. */
  points: { t: number; p: number }[]
  first: number | null
  last: number | null
  changePct: number | null
}

/**
 * Price history for the buy ticket.
 *
 * An empty `points` array is a real answer, not a failure: plenty of the 900-odd
 * listed assets are thin enough that Jupiter holds no history for them.
 */
export function usePriceChart(mint: string | null, range: ChartRange) {
  return useQuery({
    queryKey: ['price-chart', mint, range],
    queryFn: () =>
      apiRequest<{ chart: PriceChart }>(`/v1/trades/chart?mint=${encodeURIComponent(mint!)}&range=${range}`),
    enabled: Boolean(mint),
    staleTime: 60_000,
    retry: 1,
  })
}

/** What a given amount actually buys, before any wallet is involved. */
export interface QuotePreview {
  amountUsdc: number
  outAmount: string
  decimals: number | null
  outQuantity: number | null
  pricePerUnit: number | null
  priceImpactPct: number | null
  route: string | null
}

export function useQuotePreview(mint: string | null, amountUsdc: number | null) {
  return useQuery({
    queryKey: ['trade-quote', mint, amountUsdc],
    queryFn: () =>
      apiRequest<{ quote: QuotePreview }>(
        `/v1/trades/quote?outputMint=${encodeURIComponent(mint!)}&amountUsdc=${amountUsdc}`,
      ),
    enabled: Boolean(mint) && Boolean(amountUsdc) && (amountUsdc ?? 0) > 0,
    staleTime: 15_000,
    retry: 0,
  })
}

export function requestTradeOrder(input: {
  outputMint: string
  outputSymbol: string
  amountUsdc: number
  taker: string
  goalId?: string
  tesseraAcknowledged?: boolean
}) {
  // A demo order is priced for real and never sent to a chain; only a local server takes one.
  return apiRequest<{ order: TradeOrder }>('/v1/trades/order', {
    method: 'POST',
    body: JSON.stringify(DEMO ? { ...input, demo: true } : input),
  })
}

/**
 * Selling a position back to USDC.
 *
 * Priced by quantity rather than by dollars, because that is the number the
 * seller has — "all of it", or "half". The fee is reported separately rather
 * than netted: Jupiter prices the swap, while a Token-2022 transfer fee is taken
 * by the mint outside the route, so folding it in would be inventing a figure
 * Jupiter never quoted.
 */
export interface SellQuote {
  quantity: number
  baseUnits: string
  decimals: number
  proceedsUsdc: number
  pricePerUnit: number | null
  transferFeeBps: number
  transferFeeUsdc: number
  priceImpactPct: number | null
  route: string | null
}

export function useSellQuote(mint: string | null, quantity: number | null) {
  return useQuery({
    queryKey: ['sell-quote', mint, quantity],
    queryFn: () =>
      apiRequest<{ quote: SellQuote }>(
        `/v1/trades/sell-quote?inputMint=${encodeURIComponent(mint!)}&quantity=${quantity}`,
      ),
    enabled: Boolean(mint) && Boolean(quantity) && (quantity ?? 0) > 0,
    staleTime: 15_000,
    retry: 0,
  })
}

export function requestSellOrder(input: { inputMint: string; quantity: number; taker: string }) {
  return apiRequest<{ order: TradeOrder }>('/v1/trades/sell-order', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function executeTrade(input: { requestId: string; signedTransaction: string }) {
  return apiRequest<{ result: { status: 'Success'; signature: string }; contributionId: string }>(
    '/v1/trades/execute',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

/**
 * The whole investable universe — ~930 tokenised stocks plus the private-market
 * assets — searchable, with live prices.
 *
 * Needs no wallet: browsing and pricing are public reads. A wallet is only
 * required to sign a purchase.
 */
export interface CatalogPage {
  assets: InvestableAsset[]
  total: number
  page: number
  hasMore: boolean
  priced: boolean
}

/**
 * Endless list. Pages append as you scroll rather than replacing the view, so
 * nobody has to reach the bottom and press Next to keep reading.
 */
export function useAssetCatalog(query: string) {
  return useInfiniteQuery({
    queryKey: ['asset-catalog', query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<CatalogPage>(`/v1/trades/catalog?limit=24&page=${pageParam}&q=${encodeURIComponent(query)}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    // The first call walks the upstream catalog; after that it is cached server side.
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
