import { Hono } from "hono";
import { z } from "zod";
import { getAddMemoInstruction } from "@solana-program/memo";
import {
  address,
  appendTransactionMessageInstruction,
  blockhash,
  compileTransaction,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { ApiError, id } from "../lib/http";
import { fetchQuotes } from "../lib/prices";
import { positionFor } from "../lib/holdings";
import { rpcUrl } from "../lib/solana";
import { TERMS_VERSION } from "../lib/terms";
import { fetchTokens } from "../lib/tokens";
import { parseJson } from "../lib/validation";
import type { AppEnv, Job, Variables } from "../types";

const XSTOCKS_ASSETS_URL = "https://api.xstocks.fi/api/v2/public/assets";
/** Guard against an unbounded walk if the catalog ever stops terminating. */
const MAX_CATALOG_PAGES = 30;
/** Pages fetched concurrently; upstream is ~2.5s a page. */
const CATALOG_BATCH = 6;
const CATALOG_TTL_MS = 60 * 60 * 1000;

/**
 * Names people recognise, in the order they lead the catalog.
 *
 * Plain alphabetical opened on Airtel Africa, AAON and Alcoa — accurate, and a
 * terrible first impression of a 930-asset market. Every symbol here was checked
 * against the live catalog; anything not found simply falls through to the
 * alphabetical tail, so a delisting cannot leave a hole.
 *
 * The three T-Tokens sit high deliberately: they are among the most recognisable
 * names in the whole catalog, and left to the alphabet they landed ~800 rows
 * down. The row carries a "Private" chip, so they are never mistaken for the
 * index funds they sit next to.
 */
const FEATURED = [
  "SPYx",
  "QQQx",
  "VOOx",
  "tOpenAI",
  "tSpaceX",
  "tKalshi",
  "NVDAx",
  "AAPLx",
  "MSFTx",
  "GOOGLx",
  "AMZNx",
  "METAx",
  "TSLAx",
  "AVGOx",
  "AMDx",
  "NFLXx",
  "COINx",
  "MSTRx",
  "HOODx",
  "PLTRx",
  "CRCLx",
  "ORCLx",
  "JPMx",
  "BRK.Bx",
  "WMTx",
  "DISx",
  "MCDx",
  "KOx",
  "UBERx",
  "ABNBx",
  "INTCx",
  "IBMx",
  "PFEx",
  "XOMx",
  "GLDx",
  "SLVx",
  "TQQQx",
];
const FEATURED_RANK = new Map(
  FEATURED.map((symbol, index) => [symbol.toUpperCase(), index]),
);
const JUPITER_SWAP_URL = "https://api.jup.ag/swap/v2";
/**
 * Read-only pricing. Works keyless (0.5 req/s, shared by everyone) so an amount
 * can be priced before trading is configured, and sends the key when there is
 * one. This was `lite-api.jup.ag`, which Jupiter is retiring by cutting its rate
 * limit until it is gone — same paths, same responses, new host.
 */
const JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1";
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/**
 * The amount anyone may put in, in USDC.
 *
 * There is no fixed ticket: the weekly promise is a habit, not a price list, so
 * the buy ticket takes a number. The ceiling is a guard against a slipped
 * decimal point, not a product opinion.
 */
const MIN_ORDER_USDC = 1;
const MAX_ORDER_USDC = 10_000;

interface XStocksAsset {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  isTradingHalted: boolean;
  deployments: Array<{
    address: string;
    network: string;
    supportsAtomicSwaps: boolean;
    stablecoins?: Array<{ symbol: string; address: string; decimals: number }>;
  }>;
}

type AssetProvider = "xstocks" | "tessera";

interface InvestableAsset {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  mint: string;
  available: boolean;
  supportsAtomicSwaps: boolean;
  provider: AssetProvider;
  instrument: "tokenized_stock" | "loan_participation";
  transferFeeBps: number;
}

interface OrderResponse {
  transaction: string | null;
  requestId: string;
  inAmount: string;
  outAmount: string;
  inUsdValue?: number;
  outUsdValue?: number;
  priceImpact?: number;
  router: string;
  mode: string;
  feeBps: number;
  feeMint: string;
  expireAt?: string;
  errorCode?: number;
  errorMessage?: string;
}

interface ExecuteResponse {
  status: "Success" | "Failed";
  signature: string;
  code: number;
  totalInputAmount: string;
  totalOutputAmount: string;
  error?: string;
}

interface LatestBlockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

interface JupiterQuote {
  outAmount?: string;
  priceImpactPct?: string | number;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
}

async function solanaRpc<T>(
  env: AppEnv,
  method: string,
  params: unknown[],
): Promise<T> {
  const response = await fetch(rpcUrl(env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });
  if (!response.ok)
    throw new ApiError(502, "Solana is temporarily unavailable.");
  const payload = (await response.json()) as {
    result?: T;
    error?: { message: string };
  };
  if (payload.error || payload.result === undefined)
    throw new ApiError(
      502,
      payload.error?.message ?? "Solana did not return a result.",
    );
  return payload.result;
}

function toBase64(bytes: {
  readonly length: number;
  readonly [index: number]: number;
}): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

/**
 * Tessera publishes its whole shelf here — no key, no pagination.
 *
 * This lane used to be two entries typed out by hand, on the belief that Tessera
 * had no public catalog. It does; the search that missed it looked at
 * `api.tesseralab.co`, which is the lab's corporate site, not the product API.
 * Reading the real one picked up T-SpaceX, which the hardcoded pair had no way
 * to know about.
 */
const TESSERA_TOKENS_URL =
  "https://rest-api.tessera.pe/v1/public/token-details";
const TESSERA_TTL_MS = 60 * 60 * 1000;
/** All three mints carry the same 0.20% Token-2022 transfer fee; verified on-chain. */
const TESSERA_TRANSFER_FEE_BPS = 20;

interface TesseraToken {
  id: string;
  name: string;
  code: string;
  sector?: string;
  mint: string;
}

/**
 * Tessera's catalogue as of 23 Sep 2026, for when its API is down.
 *
 * Kept as a floor, not as the source of truth: if Tessera is unreachable the
 * private lane degrades to these rather than emptying, which would read to
 * someone mid-purchase as the asset having been withdrawn. The API does fail —
 * one call in five returned a 500 when this was checked — so the floor has to
 * be the whole catalogue. With only the original two here, T-SpaceX read "not
 * currently available" whenever Tessera hiccupped. Mints verified on-chain:
 * Token-2022, 9 decimals, 20 bps transfer fee.
 */
const TESSERA_FALLBACK: readonly TesseraToken[] = [
  {
    id: "T-OpenAI",
    name: "T-OpenAI",
    code: "tOpenAI",
    sector: "Artificial Intelligence",
    mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
  },
  {
    id: "T-Kalshi",
    name: "T-Kalshi",
    code: "tKalshi",
    sector: "Prediction Markets",
    mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
  },
  {
    id: "T-SpaceX",
    name: "T-SpaceX",
    code: "tSpaceX",
    sector: "Aerospace",
    mint: "TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v",
  },
];

function mapTesseraToken(token: TesseraToken): InvestableAsset {
  // "T-SpaceX" → "SpaceX", so the caption reads like the xStocks one
  // ("Apple xStock") instead of repeating the ticker back at the reader.
  const company = token.name.replace(/^T-/, "");
  return {
    name: `${company} T-Token`,
    symbol: token.code,
    // Artwork is keyed by the token id, not the code.
    logo: `https://cdn.tesseralab.co/tessera/tokenicon_${token.id}.svg`,
    description: `Tessera loan participation right with economic exposure linked to ${company}'s pre-IPO valuation.${token.sector ? ` Sector: ${token.sector}.` : ""}`,
    mint: token.mint,
    available: true,
    supportsAtomicSwaps: false,
    provider: "tessera",
    instrument: "loan_participation",
    transferFeeBps: TESSERA_TRANSFER_FEE_BPS,
  };
}

/** Survives between requests in a warm isolate, like the xStocks catalog. */
let tesseraCache: { at: number; assets: InvestableAsset[] } | null = null;

async function getTesseraAssets(): Promise<InvestableAsset[]> {
  if (tesseraCache && Date.now() - tesseraCache.at < TESSERA_TTL_MS) {
    return tesseraCache.assets;
  }
  try {
    const response = await fetch(TESSERA_TOKENS_URL, {
      cf: { cacheTtl: 3600, cacheEverything: true },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const tokens = (await response.json()) as TesseraToken[];
    // An empty or malformed body must not be cached as "Tessera has no assets".
    if (!Array.isArray(tokens) || !tokens.length)
      throw new Error("empty catalog");
    const assets = tokens
      .filter((token) => token?.mint && token?.code)
      .map(mapTesseraToken);
    if (!assets.length) throw new Error("no usable tokens");
    tesseraCache = { at: Date.now(), assets };
    return assets;
  } catch (error) {
    // Degrading silently here once hid the whole lane behind the two fallback
    // mints with nothing in the log to say why.
    console.warn("tessera catalog unavailable, using fallback:", String(error));
    return TESSERA_FALLBACK.map(mapTesseraToken);
  }
}

interface CatalogPage {
  nodes: XStocksAsset[];
  page?: { hasNextPage?: boolean };
}

async function fetchCatalogPage(page: number): Promise<CatalogPage | null> {
  const response = await fetch(`${XSTOCKS_ASSETS_URL}?page=${page}`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!response.ok) return null;
  return (await response.json()) as CatalogPage;
}

/** Survives between requests in a warm isolate, so only the first call pays. */
let catalogCache: { at: number; nodes: XStocksAsset[] } | null = null;

async function getXStocksAssets() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.nodes;
  }

  // The catalog is PAGINATED — 100 assets a page, ~928 in total. Reading only
  // the first page silently hid almost everything: SPYx, QQQx and TSLAx all sit
  // on later pages, which is why the public-market shelf looked permanently
  // "Soon" even though those assets are live and not trading-halted.
  //
  // Pages are fetched in parallel batches. Upstream takes ~2.5s a page, so
  // walking ten of them one at a time blew past the request timeout.
  const first = await fetchCatalogPage(0);
  if (!first)
    throw new ApiError(502, "The asset catalog is temporarily unavailable.");

  const nodes = [...(first.nodes ?? [])];
  let next = 1;
  let more = Boolean(first.page?.hasNextPage);

  while (more && next < MAX_CATALOG_PAGES) {
    const batch = Array.from(
      { length: Math.min(CATALOG_BATCH, MAX_CATALOG_PAGES - next) },
      (_, index) => fetchCatalogPage(next + index),
    );
    const pages = await Promise.all(batch);
    more = false;
    for (const page of pages) {
      // A later page failing still leaves a usable catalog; only page 0 is fatal.
      if (!page?.nodes?.length) continue;
      nodes.push(...page.nodes);
      if (page.page?.hasNextPage) more = true;
    }
    next += CATALOG_BATCH;
  }

  catalogCache = { at: Date.now(), nodes };
  return nodes;
}

function normalizeTesseraSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

async function findTesseraAsset(symbol: string) {
  return (await getTesseraAssets()).find(
    (asset) =>
      normalizeTesseraSymbol(asset.symbol) === normalizeTesseraSymbol(symbol),
  );
}

function mapXStocksAsset(asset: XStocksAsset): InvestableAsset | null {
  const deployment = asset.deployments.find(
    (item) => item.network === "Solana",
  );
  if (!deployment) return null;
  return {
    name: asset.name,
    symbol: asset.symbol,
    logo: asset.logo,
    description: asset.description,
    mint: deployment.address,
    available: !asset.isTradingHalted,
    supportsAtomicSwaps: deployment.supportsAtomicSwaps,
    provider: "xstocks",
    instrument: "tokenized_stock",
    transferFeeBps: 0,
  };
}

async function getInvestableAssets(requestedSymbols: string[]) {
  const requested = new Set(
    requestedSymbols.map((symbol) => symbol.trim().toUpperCase()),
  );
  const tessera = await getTesseraAssets();
  const tesseraAssets = tessera.filter((asset) =>
    requested.has(asset.symbol.toUpperCase()),
  );
  const xStockSymbols = [...requested].filter(
    (symbol) => !tessera.some((asset) => asset.symbol.toUpperCase() === symbol),
  );
  if (!xStockSymbols.length) return tesseraAssets;
  const xStocks = await getXStocksAssets();
  return [
    ...xStocks
      .filter((asset) => xStockSymbols.includes(asset.symbol.toUpperCase()))
      .map(mapXStocksAsset)
      .filter((asset): asset is InvestableAsset => asset !== null),
    ...tesseraAssets,
  ];
}

async function findInvestableAsset(symbol: string) {
  const tesseraAsset = await findTesseraAsset(symbol);
  if (tesseraAsset) return tesseraAsset;
  const xStock = (await getXStocksAssets()).find(
    (asset) => asset.symbol.toUpperCase() === symbol.trim().toUpperCase(),
  );
  return xStock ? mapXStocksAsset(xStock) : null;
}

/**
 * The same lookup keyed by mint, which is what a row hands to the buy ticket.
 * Returns null rather than throwing: an asset Jupiter knows and our catalog does
 * not is still worth pricing, it just has no provider or fee to report.
 */
async function findInvestableAssetByMint(
  mint: string,
): Promise<InvestableAsset | null> {
  const tessera = (await getTesseraAssets()).find(
    (asset) => asset.mint === mint,
  );
  if (tessera) return tessera;
  const xStock = (await getXStocksAssets()).find((asset) =>
    asset.deployments.some(
      (item) => item.network === "Solana" && item.address === mint,
    ),
  );
  return xStock ? mapXStocksAsset(xStock) : null;
}

export const tradeRoutes = new Hono<{
  Bindings: AppEnv;
  Variables: Variables;
}>();

tradeRoutes.get("/assets", async (c) => {
  const requested = (
    c.req.query("symbols") ?? "SPYx,QQQx,TSLAx,tOpenAI,tKalshi,tSpaceX"
  )
    .split(",")
    .slice(0, 12);
  const assets = await getInvestableAssets(requested);
  const quotes = await fetchQuotes(
    c.env,
    assets.map((asset) => asset.mint),
  );
  return c.json({
    assets: assets.map((asset) => ({
      ...asset,
      priceUsd: quotes?.[asset.mint]?.usdPrice ?? null,
      priceChange24h: quotes?.[asset.mint]?.priceChange24h ?? null,
    })),
    network: "solana-mainnet",
  });
});

/**
 * The whole investable universe, searchable, with live prices.
 *
 * Needs no wallet: browsing and pricing are public reads. A wallet is only
 * required to sign a purchase.
 *
 * Only the assets on the requested page are priced — quoting all ~900 would be
 * eighteen upstream calls for data nobody is looking at.
 */
tradeRoutes.get("/catalog", async (c) => {
  const search = (c.req.query("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 24), 1), 50);
  const page = Math.max(Number(c.req.query("page") ?? 0), 0);

  const [tessera, xStocksRaw] = await Promise.all([
    getTesseraAssets(),
    getXStocksAssets(),
  ]);
  const xStocks = xStocksRaw
    .map(mapXStocksAsset)
    .filter((asset): asset is InvestableAsset => asset !== null);
  const everything = [...tessera, ...xStocks];

  const matched = search
    ? everything.filter(
        (asset) =>
          asset.symbol.toLowerCase().includes(search) ||
          asset.name.toLowerCase().includes(search),
      )
    : everything;

  /**
   * Lower sorts first. Searching "apple" should put AAPLx above any name that
   * merely contains the word, so relevance outranks the featured list while a
   * query is active.
   */
  const relevance = (asset: InvestableAsset) => {
    if (!search) return FEATURED_RANK.get(asset.symbol.toUpperCase()) ?? 1000;
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    if (symbol === search) return 0;
    if (symbol.startsWith(search)) return 1;
    if (name.startsWith(search)) return 2;
    if (symbol.includes(search)) return 3;
    return 4;
  };

  const ordered = [...matched].sort((a, b) => {
    // A halted asset never leads, whatever else is true of it.
    if (a.available !== b.available) return a.available ? -1 : 1;
    const byRelevance = relevance(a) - relevance(b);
    if (byRelevance !== 0) return byRelevance;
    return a.symbol.localeCompare(b.symbol);
  });

  const slice = ordered.slice(page * limit, page * limit + limit);
  const quotes = await fetchQuotes(
    c.env,
    slice.map((asset) => asset.mint),
  );

  return c.json({
    assets: slice.map((asset) => ({
      ...asset,
      priceUsd: quotes?.[asset.mint]?.usdPrice ?? null,
      priceChange24h: quotes?.[asset.mint]?.priceChange24h ?? null,
    })),
    total: ordered.length,
    page,
    hasMore: (page + 1) * limit < ordered.length,
    priced: quotes !== null,
  });
});

/**
 * Everything the buy ticket needs about one asset.
 *
 * The review sheet used to list the weekly promise and who can see it — true,
 * but not what anyone weighs up before buying. This is the other half: what it
 * costs, which way it has moved, and how deep the market is.
 */
tradeRoutes.get("/asset", async (c) => {
  const mint = (c.req.query("mint") ?? "").trim();
  if (!mint) throw new ApiError(400, "A mint is required.");

  const [tokens, listed] = await Promise.all([
    fetchTokens(c.env, [mint]),
    findInvestableAssetByMint(mint),
  ]);
  const token = tokens[mint];
  if (!token && !listed)
    throw new ApiError(404, "That asset is not on the shelf.");

  const change = (window?: { priceChange?: number }) =>
    typeof window?.priceChange === "number" ? window.priceChange : null;
  const volume24h =
    typeof token?.stats24h?.buyVolume === "number" &&
    typeof token?.stats24h?.sellVolume === "number"
      ? token.stats24h.buyVolume + token.stats24h.sellVolume
      : null;

  return c.json({
    asset: {
      mint,
      // The catalog is the authority on identity and structure; Jupiter is the
      // authority on the market. Neither is asked for the other's answer.
      symbol: listed?.symbol ?? token?.symbol ?? "",
      name: listed?.name ?? token?.name ?? "",
      logo: listed?.logo || token?.icon || "",
      provider: listed?.provider ?? null,
      instrument: listed?.instrument ?? null,
      transferFeeBps: listed?.transferFeeBps ?? 0,
      available: listed?.available ?? true,
      decimals: token?.decimals ?? null,
      priceUsd: token?.usdPrice ?? null,
      change5m: change(token?.stats5m),
      change1h: change(token?.stats1h),
      change6h: change(token?.stats6h),
      change24h: change(token?.stats24h),
      liquidityUsd: token?.liquidity ?? null,
      marketCapUsd: token?.mcap ?? token?.fdv ?? null,
      volume24hUsd: volume24h,
      holders: token?.holderCount ?? null,
      verified: token?.isVerified ?? null,
    },
  });
});

/**
 * Price history for one asset, as a plain line.
 *
 * The asset endpoint above answers "what is it worth and which way has it moved",
 * but only as four change figures — there was no series behind them, so the buy
 * ticket had nothing to draw. Jupiter's chart API carries OHLCV for any mint it
 * routes, needs no key, and is the same source the swap quote comes from.
 *
 * Only the close is kept. This is a line, deliberately: the product is a weekly
 * habit, not a trading terminal, and candles would invite reading a wick.
 */
const JUPITER_CHART_URL = "https://datapi.jup.ag/v2/charts";

/**
 * Each range picks an interval fine enough to look alive and coarse enough that one
 * request covers the whole window.
 */
const CHART_RANGES = {
  "1D": { interval: "15_MINUTE", candles: 96 },
  "1W": { interval: "1_HOUR", candles: 168 },
  "1M": { interval: "4_HOUR", candles: 180 },
  "1Y": { interval: "1_DAY", candles: 365 },
} as const;

type ChartRange = keyof typeof CHART_RANGES;

type JupiterCandle = { time?: number; close?: number };

const CHART_TTL_MS = 60 * 1000;
const chartCache = new Map<
  string,
  { at: number; points: { t: number; p: number }[] }
>();

tradeRoutes.get("/chart", async (c) => {
  const mint = (c.req.query("mint") ?? "").trim();
  if (!mint) throw new ApiError(400, "A mint is required.");

  const requested = (c.req.query("range") ?? "1M").toUpperCase();
  if (!(requested in CHART_RANGES))
    throw new ApiError(422, "Unknown range. Use 1D, 1W, 1M or 1Y.");
  const range = requested as ChartRange;
  const { interval, candles } = CHART_RANGES[range];

  const key = `${mint}:${range}`;
  const cached = chartCache.get(key);
  let points =
    cached && Date.now() - cached.at < CHART_TTL_MS ? cached.points : null;

  if (!points) {
    const url = `${JUPITER_CHART_URL}/${encodeURIComponent(mint)}?${new URLSearchParams(
      {
        interval,
        to: String(Date.now()),
        candles: String(candles),
      },
    ).toString()}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as { candles?: JupiterCandle[] };
      points = (payload.candles ?? [])
        .filter(
          (candle): candle is { time: number; close: number } =>
            typeof candle.time === "number" && typeof candle.close === "number",
        )
        .map((candle) => ({ t: candle.time, p: candle.close }));
      chartCache.set(key, { at: Date.now(), points });
    } catch {
      // A chart is a nice-to-have on a buy screen. Failing the whole request would
      // take the price and the amount field down with it, so this answers empty and
      // lets the client say it has no history rather than that something broke.
      points = [];
    }
  }

  // Thinly traded mints genuinely have no history — Jupiter returns an empty array
  // for them — so "no points" is a real answer, not an error.
  const first = points.at(0)?.p ?? null;
  const last = points.at(-1)?.p ?? null;

  return c.json({
    chart: {
      mint,
      range,
      points,
      first,
      last,
      changePct:
        first !== null && last !== null && first !== 0
          ? ((last - first) / first) * 100
          : null,
    },
  });
});

/**
 * A preview quote: what a given amount of USDC actually buys, right now.
 *
 * Deliberately not `/order`. That one persists a row and demands a verified
 * wallet, which made it useless for the thing people do first — trying numbers.
 * This writes nothing and needs no wallet, so the ticket can price an amount
 * while the reader is still deciding whether to connect one.
 */
/**
 * Asks Jupiter what one side buys the other, without persisting anything.
 *
 * Shared by both directions so a buy preview and a sell preview cannot disagree
 * about slippage or route formatting.
 */
async function priceRoute(
  env: AppEnv,
  inputMint: string,
  outputMint: string,
  amount: string,
) {
  const url = new URL(`${JUPITER_QUOTE_URL}/quote`);
  url.search = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: "50",
  }).toString();

  let payload: JupiterQuote;
  try {
    const response = await fetch(url, {
      headers: env.JUPITER_API_KEY ? { "x-api-key": env.JUPITER_API_KEY } : {},
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(String(response.status));
    payload = (await response.json()) as JupiterQuote;
  } catch {
    throw new ApiError(
      502,
      "Could not price that amount right now.",
      "quote_unavailable",
    );
  }
  if (!payload.outAmount)
    throw new ApiError(
      422,
      "No route is available for that amount.",
      "no_route",
    );
  return payload;
}

const routeLabel = (payload: JupiterQuote) =>
  payload.routePlan
    ?.map((step) => step.swapInfo?.label)
    .filter(Boolean)
    .join(" → ") || null;

const impactPct = (payload: JupiterQuote) =>
  payload.priceImpactPct !== undefined
    ? Number(payload.priceImpactPct) * 100
    : null;

tradeRoutes.get("/quote", async (c) => {
  const outputMint = (c.req.query("outputMint") ?? "").trim();
  const amountUsdc = Number(c.req.query("amountUsdc") ?? "0");
  if (!outputMint) throw new ApiError(400, "An output mint is required.");
  if (
    !Number.isFinite(amountUsdc) ||
    amountUsdc < MIN_ORDER_USDC ||
    amountUsdc > MAX_ORDER_USDC
  )
    throw new ApiError(
      422,
      `Enter an amount between $${MIN_ORDER_USDC} and $${MAX_ORDER_USDC}.`,
    );

  const payload = await priceRoute(
    c.env,
    SOLANA_USDC,
    outputMint,
    String(Math.round(amountUsdc * 1_000_000)),
  );

  const tokens = await fetchTokens(c.env, [outputMint]);
  const decimals = tokens[outputMint]?.decimals ?? null;
  const outQuantity =
    decimals === null
      ? null
      : Number(payload.outAmount) / Math.pow(10, decimals);

  return c.json({
    quote: {
      amountUsdc,
      outAmount: payload.outAmount,
      decimals,
      outQuantity,
      // What each unit actually costs once the route is taken, which is the
      // number worth comparing against the headline price.
      pricePerUnit:
        outQuantity && outQuantity > 0 ? amountUsdc / outQuantity : null,
      priceImpactPct: impactPct(payload),
      route: routeLabel(payload),
    },
  });
});

/**
 * The other direction: what a quantity of an asset is worth in USDC right now.
 *
 * Takes a quantity rather than a dollar amount, because that is the number the
 * seller actually has — "all of it", or "half". Writes nothing and needs no
 * wallet, same as the buy preview.
 *
 * `transferFeeBps` is reported separately rather than folded into the figure.
 * Jupiter quotes the swap; a Token-2022 transfer fee is taken by the mint on the
 * way out and is not part of the route, so a quote that silently netted it would
 * be the app inventing a number Jupiter never said.
 */
tradeRoutes.get("/sell-quote", async (c) => {
  const inputMint = (c.req.query("inputMint") ?? "").trim();
  const quantity = Number(c.req.query("quantity") ?? "0");
  if (!inputMint) throw new ApiError(400, "An input mint is required.");
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new ApiError(422, "Enter how much you want to sell.");

  const [tokens, listed] = await Promise.all([
    fetchTokens(c.env, [inputMint]),
    findInvestableAssetByMint(inputMint),
  ]);
  const decimals = tokens[inputMint]?.decimals;
  if (decimals === undefined)
    throw new ApiError(
      422,
      "That asset cannot be priced right now.",
      "no_decimals",
    );

  const baseUnits = BigInt(Math.round(quantity * Math.pow(10, decimals)));
  if (baseUnits <= 0n)
    throw new ApiError(422, "That amount is too small to sell.", "dust");

  const payload = await priceRoute(
    c.env,
    inputMint,
    SOLANA_USDC,
    baseUnits.toString(),
  );
  const proceedsUsdc = Number(payload.outAmount) / 1_000_000;
  const transferFeeBps = listed?.transferFeeBps ?? 0;

  return c.json({
    quote: {
      quantity,
      baseUnits: baseUnits.toString(),
      decimals,
      proceedsUsdc,
      pricePerUnit: quantity > 0 ? proceedsUsdc / quantity : null,
      // Charged by the mint, not the route. Tessera's three are 0.20%; xStocks are 0.
      transferFeeBps,
      transferFeeUsdc: (proceedsUsdc * transferFeeBps) / 10_000,
      priceImpactPct: impactPct(payload),
      route: routeLabel(payload),
    },
  });
});

tradeRoutes.post("/order", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      outputMint: z.string().min(32).max(44),
      outputSymbol: z.string().min(2).max(12),
      amountUsdc: z.number().min(MIN_ORDER_USDC).max(MAX_ORDER_USDC),
      taker: z.string().min(32).max(44),
      goalId: z.string().optional(),
      tesseraAcknowledged: z.boolean().optional(),
      demo: z.boolean().optional(),
    }),
  );
  const wallet = await c.env.DB.prepare(
    "SELECT id FROM wallet_connections WHERE user_id = ? AND address = ? AND verified_at IS NOT NULL",
  )
    .bind(c.get("userId"), body.taker)
    .first();
  if (!wallet)
    throw new ApiError(403, "Verify this wallet before requesting an order.");
  const asset = await findInvestableAsset(body.outputSymbol);
  if (!asset || asset.mint !== body.outputMint || !asset.available) {
    throw new ApiError(422, "This asset is not currently available on Solana.");
  }
  if (asset.provider === "tessera" && !body.tesseraAcknowledged)
    throw new ApiError(
      422,
      "Acknowledge Tessera's private-market and eligibility risks before continuing.",
      "tessera_acknowledgement_required",
    );
  // Buying only. `/sell-order` deliberately has no such gate: whatever the
  // terms say, nobody is ever stopped from getting their money back out.
  const terms = await c.env.DB.prepare(
    "SELECT terms_version FROM profiles WHERE user_id = ?",
  )
    .bind(c.get("userId"))
    .first<{ terms_version: number | null }>();
  if (Number(terms?.terms_version ?? 0) < TERMS_VERSION)
    throw new ApiError(
      403,
      "Confirm you are eligible and accept the terms before your first purchase.",
      "terms_required",
    );
  const amount = String(Math.round(body.amountUsdc * 1_000_000));
  /*
   * Demo mode, for recording the app in a browser (mobile `features/demo`). Only a
   * local server honours it. Nothing is signed and nothing touches a chain, but the
   * order is priced with a real quote, so what the screen says it bought is what
   * that money would have bought today.
   */
  if (body.demo) {
    if (c.env.ENVIRONMENT !== "local")
      throw new ApiError(
        422,
        "Demo orders only exist on a local server.",
        "demo_unavailable",
      );
    const quote = await priceRoute(c.env, SOLANA_USDC, body.outputMint, amount);
    const requestId = id("demo_order");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO trade_orders (request_id, user_id, wallet_address, input_mint, output_mint, input_amount, expected_output_amount, output_symbol, goal_id, expires_at, execution_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo')`,
    )
      .bind(
        requestId,
        c.get("userId"),
        body.taker,
        SOLANA_USDC,
        body.outputMint,
        amount,
        String(quote.outAmount ?? "0"),
        body.outputSymbol,
        body.goalId ?? null,
        expiresAt,
      )
      .run();
    return c.json({
      order: {
        transaction: null,
        requestId,
        inAmount: amount,
        outAmount: String(quote.outAmount ?? "0"),
        inUsdValue: body.amountUsdc,
        outUsdValue: body.amountUsdc,
        priceImpact: 0,
        router: routeLabel(quote) ?? "Jupiter",
        mode: "live",
        feeBps: 0,
        feeMint: SOLANA_USDC,
        expireAt: expiresAt,
      } satisfies OrderResponse,
    });
  }
  if (String(c.env.SOLANA_CLUSTER) !== "mainnet-beta") {
    const requestId = id("sandbox_order");
    // Renaming this prefix is safe, which is not obvious: verification compares
    // the on-chain memo against the `verification_reference` stored with the
    // contribution, never against a literal. Rows written under the old prefix
    // still carry it on both sides and keep verifying.
    const verificationReference = `kept:v1:${requestId}:${c.get("userId")}:${amount}`;
    const latest = await solanaRpc<{ value: LatestBlockhash }>(
      c.env,
      "getLatestBlockhash",
      [{ commitment: "confirmed" }],
    );
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (value) => setTransactionMessageFeePayer(address(body.taker), value),
      (value) =>
        setTransactionMessageLifetimeUsingBlockhash(
          {
            blockhash: blockhash(latest.value.blockhash),
            lastValidBlockHeight: BigInt(latest.value.lastValidBlockHeight),
          },
          value,
        ),
      (value) =>
        appendTransactionMessageInstruction(
          getAddMemoInstruction({ memo: verificationReference }),
          value,
        ),
    );
    const transaction = toBase64(
      getTransactionEncoder().encode(compileTransaction(message)),
    );
    const expiresAt = new Date(Date.now() + 90_000).toISOString();
    await c.env.DB.prepare(
      `INSERT INTO trade_orders (request_id, user_id, wallet_address, input_mint, output_mint, input_amount, expected_output_amount, output_symbol, goal_id, expires_at, execution_mode, verification_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sandbox', ?)`,
    )
      .bind(
        requestId,
        c.get("userId"),
        body.taker,
        SOLANA_USDC,
        body.outputMint,
        amount,
        "0",
        body.outputSymbol,
        body.goalId ?? null,
        expiresAt,
        verificationReference,
      )
      .run();
    return c.json({
      order: {
        transaction,
        requestId,
        inAmount: amount,
        outAmount: "0",
        inUsdValue: body.amountUsdc,
        outUsdValue: 0,
        priceImpact: 0,
        router: "Solana Memo Program",
        mode: "sandbox",
        feeBps: 0,
        feeMint: "SOL",
        expireAt: expiresAt,
      } satisfies OrderResponse,
    });
  }
  if (!c.env.JUPITER_API_KEY)
    throw new ApiError(
      409,
      "Jupiter is not configured yet.",
      "provider_not_configured",
    );
  const url = new URL(`${JUPITER_SWAP_URL}/order`);
  url.search = new URLSearchParams({
    inputMint: SOLANA_USDC,
    outputMint: body.outputMint,
    amount,
    taker: body.taker,
  }).toString();
  const response = await fetch(url, {
    headers: { "x-api-key": c.env.JUPITER_API_KEY },
  });
  if (!response.ok) throw new ApiError(502, "Could not prepare a live quote.");
  const order = (await response.json()) as OrderResponse;
  if (!order.transaction)
    throw new ApiError(
      422,
      order.errorMessage ?? "No executable route is available.",
    );
  const expiresAt =
    order.expireAt ?? new Date(Date.now() + 60_000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO trade_orders (request_id, user_id, wallet_address, input_mint, output_mint, input_amount, expected_output_amount, output_symbol, goal_id, expires_at, direction, asset_mint, asset_symbol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'buy', ?, ?)`,
  )
    .bind(
      order.requestId,
      c.get("userId"),
      body.taker,
      SOLANA_USDC,
      body.outputMint,
      amount,
      order.outAmount,
      body.outputSymbol,
      body.goalId ?? null,
      expiresAt,
      body.outputMint,
      body.outputSymbol,
    )
    .run();
  return c.json({ order });
});

/**
 * Sell a position back to USDC.
 *
 * Mainnet only, and not because of a missing key: there is nothing to sell on
 * devnet. A rehearsal buy signs a memo and receives no asset, so a devnet sell
 * would be disposing of a balance that does not exist. It refuses rather than
 * pretending, the same way a live buy does.
 *
 * The holding check is ours, not the chain's. The chain would reject an
 * over-sell anyway, but only after the reader has approved it in their wallet
 * and paid a fee to find out.
 */
tradeRoutes.post("/sell-order", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      inputMint: z.string().min(32).max(44),
      quantity: z.number().positive(),
      taker: z.string().min(32).max(44),
    }),
  );

  const wallet = await c.env.DB.prepare(
    "SELECT id FROM wallet_connections WHERE user_id = ? AND address = ? AND verified_at IS NOT NULL",
  )
    .bind(c.get("userId"), body.taker)
    .first();
  if (!wallet) throw new ApiError(403, "Verify this wallet before selling.");

  if (String(c.env.SOLANA_CLUSTER) !== "mainnet-beta")
    throw new ApiError(
      409,
      "Selling needs mainnet — devnet rehearsals never received an asset to sell.",
      "mainnet_required",
    );
  if (!c.env.JUPITER_API_KEY)
    throw new ApiError(
      409,
      "Jupiter is not configured yet.",
      "provider_not_configured",
    );

  const position = await positionFor(c.env, c.get("userId"), body.inputMint);
  if (!position || position.units <= 0n)
    throw new ApiError(422, "You do not hold that asset.", "no_position");

  const decimals = position.decimals;
  if (decimals === null)
    throw new ApiError(
      422,
      "That position cannot be priced yet.",
      "no_decimals",
    );

  const requested = BigInt(Math.round(body.quantity * Math.pow(10, decimals)));
  if (requested <= 0n)
    throw new ApiError(422, "That amount is too small to sell.", "dust");
  if (requested > position.units)
    throw new ApiError(
      422,
      "That is more than you hold.",
      "insufficient_holding",
    );

  const url = new URL(`${JUPITER_SWAP_URL}/order`);
  url.search = new URLSearchParams({
    inputMint: body.inputMint,
    outputMint: SOLANA_USDC,
    amount: requested.toString(),
    taker: body.taker,
  }).toString();
  const response = await fetch(url, {
    headers: { "x-api-key": c.env.JUPITER_API_KEY },
  });
  if (!response.ok) throw new ApiError(502, "Could not prepare a live quote.");
  const order = (await response.json()) as OrderResponse;
  if (!order.transaction)
    throw new ApiError(
      422,
      order.errorMessage ?? "No executable route is available.",
    );

  const expiresAt =
    order.expireAt ?? new Date(Date.now() + 60_000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO trade_orders (request_id, user_id, wallet_address, input_mint, output_mint, input_amount, expected_output_amount, output_symbol, goal_id, expires_at, direction, asset_mint, asset_symbol)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'USDC', NULL, ?, 'sell', ?, ?)`,
  )
    .bind(
      order.requestId,
      c.get("userId"),
      body.taker,
      body.inputMint,
      SOLANA_USDC,
      requested.toString(),
      order.outAmount,
      expiresAt,
      body.inputMint,
      position.symbol ?? "Investment",
    )
    .run();

  return c.json({ order });
});

tradeRoutes.post("/execute", async (c) => {
  const body = await parseJson(
    c,
    z.object({
      requestId: z.string().min(8),
      signedTransaction: z.string().min(100),
    }),
  );
  const order = await c.env.DB.prepare(
    "SELECT * FROM trade_orders WHERE request_id = ? AND user_id = ? AND executed_at IS NULL",
  )
    .bind(body.requestId, c.get("userId"))
    .first();
  if (!order)
    throw new ApiError(404, "This order is unavailable or was already used.");
  if (String(order.execution_mode) === "demo") {
    if (c.env.ENVIRONMENT !== "local")
      throw new ApiError(404, "This order is unavailable or was already used.");
    const contributionId = id("contribution");
    const tokens = await fetchTokens(c.env, [String(order.output_mint)]);
    const signature = `demo${crypto.randomUUID().replaceAll("-", "")}`;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE trade_orders SET executed_at = CURRENT_TIMESTAMP WHERE request_id = ?",
      ).bind(body.requestId),
      c.env.DB.prepare(
        `INSERT INTO contributions (id, user_id, goal_id, wallet_address, signature, asset_symbol, asset_mint, amount_base_units, execution_mode, input_amount_usdc_base_units, asset_decimals)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?)`,
      ).bind(
        contributionId,
        c.get("userId"),
        order.goal_id,
        order.wallet_address,
        signature,
        order.output_symbol,
        order.output_mint,
        order.expected_output_amount,
        order.input_amount,
        tokens[String(order.output_mint)]?.decimals ?? null,
      ),
    ]);
    await c.env.JOBS.send({
      kind: "verify_contribution",
      contributionId,
    } satisfies Job);
    return c.json({
      result: {
        status: "Success",
        signature,
        code: 0,
        totalInputAmount: String(order.input_amount),
        totalOutputAmount: String(order.expected_output_amount),
      },
      contributionId,
      mode: "live",
    });
  }
  if (String(order.execution_mode) === "sandbox") {
    if (new Date(String(order.expires_at)).getTime() <= Date.now())
      throw new ApiError(
        409,
        "This test order expired. Prepare a fresh one.",
        "order_expired",
      );
    const signature = await solanaRpc<string>(c.env, "sendTransaction", [
      body.signedTransaction,
      {
        encoding: "base64",
        preflightCommitment: "confirmed",
        skipPreflight: false,
      },
    ]);
    const contributionId = id("contribution");
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE trade_orders SET executed_at = CURRENT_TIMESTAMP WHERE request_id = ?",
      ).bind(body.requestId),
      c.env.DB.prepare(
        `INSERT INTO contributions (id, user_id, goal_id, wallet_address, signature, asset_symbol, asset_mint, amount_base_units, execution_mode, input_amount_usdc_base_units, verification_reference)
           VALUES (?, ?, ?, ?, ?, ?, ?, '0', 'sandbox', ?, ?)`,
      ).bind(
        contributionId,
        c.get("userId"),
        order.goal_id,
        order.wallet_address,
        signature,
        order.output_symbol,
        order.output_mint,
        order.input_amount,
        order.verification_reference,
      ),
    ]);
    await c.env.JOBS.send({
      kind: "verify_contribution",
      contributionId,
    } satisfies Job);
    return c.json({
      result: {
        status: "Success",
        signature,
        code: 0,
        totalInputAmount: "0",
        totalOutputAmount: "0",
      },
      contributionId,
      mode: "sandbox",
    });
  }
  if (!c.env.JUPITER_API_KEY)
    throw new ApiError(
      409,
      "Jupiter is not configured yet.",
      "provider_not_configured",
    );
  const response = await fetch(`${JUPITER_SWAP_URL}/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": c.env.JUPITER_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new ApiError(502, "The transaction could not be submitted.");
  const result = (await response.json()) as ExecuteResponse;
  await c.env.DB.prepare(
    "UPDATE trade_orders SET executed_at = CURRENT_TIMESTAMP WHERE request_id = ?",
  )
    .bind(body.requestId)
    .run();
  if (result.status !== "Success" || !result.signature) {
    throw new ApiError(
      422,
      result.error ?? "The swap did not complete.",
      "swap_failed",
    );
  }
  const contributionId = id("contribution");
  const selling = String(order.direction) === "sell";

  /*
   * The two columns swap meaning with the direction, which is the one thing about
   * this table worth reading twice (migration 0010 spells it out):
   *
   *   buy   amount = asset received,  usdc = what was spent
   *   sell  amount = asset disposed,  usdc = what came back
   *
   * On a sell the asset is the order's INPUT, so `asset_mint` must come from
   * `asset_mint` rather than `output_mint` — the latter is USDC and would file the
   * disposal against the dollar, leaving the real position untouched forever.
   */
  await c.env.DB.prepare(
    `INSERT INTO contributions (id, user_id, goal_id, wallet_address, signature, asset_symbol, asset_mint, amount_base_units, input_amount_usdc_base_units, direction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      contributionId,
      c.get("userId"),
      // A sell is not progress against a goal, so it is never attached to one.
      selling ? null : order.goal_id,
      order.wallet_address,
      result.signature,
      selling
        ? (order.asset_symbol ?? order.output_symbol)
        : order.output_symbol,
      selling ? (order.asset_mint ?? order.input_mint) : order.output_mint,
      selling ? order.input_amount : result.totalOutputAmount,
      selling ? result.totalOutputAmount : order.input_amount,
      selling ? "sell" : "buy",
    )
    .run();
  await c.env.JOBS.send({
    kind: "verify_contribution",
    contributionId,
  } satisfies Job);
  return c.json({
    result,
    contributionId,
    direction: selling ? "sell" : "buy",
  });
});
