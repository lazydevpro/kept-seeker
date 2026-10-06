import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/app-header'
import { Button, Card, Chip, PressableCard, Row, Screen, SectionHeader, Sheet, T, type Tone } from '@/components/ui'
import { space } from '@/constants/theme'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { Icon } from '@/design/icons'
import { Object3D } from '@/design/objects'
import { AssetLogo } from '@/features/trade/asset-logo'
import { formatPrice } from '@/features/trade/format-price'
import { PortfolioCard } from '@/features/portfolio/portfolio-card'
import { useWalletLink } from '@/features/trade/use-wallet-link'
import { useInvestableAssets, type InvestableAsset } from '@/features/trade/trade-api'
import { useNetwork } from '@/features/network/use-network'

type ShelfAsset = InvestableAsset & {
  kind: string
  shelf: 'public' | 'crypto' | 'private'
  tone: Tone
}

/**
 * A deliberately short shelf. The catalogue response fills in mints and availability; these
 * entries carry the framing — what the thing is, in three words.
 */
const SHELF: ShelfAsset[] = [
  {
    symbol: 'SPYx',
    name: 'S&P 500',
    kind: 'Broad market',
    shelf: 'public',
    tone: 'kiwi',
    mint: '',
    logo: '',
    description: '',
    available: false,
    supportsAtomicSwaps: false,
    provider: 'xstocks',
    instrument: 'tokenized_stock',
    transferFeeBps: 0,
  },
  {
    symbol: 'QQQx',
    name: 'Nasdaq 100',
    kind: 'Technology tilt',
    shelf: 'public',
    tone: 'sky',
    mint: '',
    logo: '',
    description: '',
    available: false,
    supportsAtomicSwaps: false,
    provider: 'xstocks',
    instrument: 'tokenized_stock',
    transferFeeBps: 0,
  },
  {
    symbol: 'TSLAx',
    name: 'Tesla',
    kind: 'Single company',
    shelf: 'public',
    tone: 'coral',
    mint: '',
    logo: '',
    description: '',
    available: false,
    supportsAtomicSwaps: false,
    provider: 'xstocks',
    instrument: 'tokenized_stock',
    transferFeeBps: 0,
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    kind: "The network's own",
    shelf: 'crypto',
    tone: 'grape',
    mint: 'So11111111111111111111111111111111111111112',
    logo: '',
    description: '',
    available: true,
    supportsAtomicSwaps: true,
    provider: 'crypto',
    instrument: 'crypto',
    transferFeeBps: 0,
  },
  {
    symbol: 'cbBTC',
    name: 'Bitcoin',
    kind: 'Held by Coinbase',
    shelf: 'crypto',
    tone: 'sun',
    mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',
    logo: '',
    description: '',
    available: true,
    supportsAtomicSwaps: true,
    provider: 'crypto',
    instrument: 'crypto',
    transferFeeBps: 0,
  },
  {
    symbol: 'SKR',
    name: 'Seeker',
    kind: 'Solana Mobile',
    shelf: 'crypto',
    tone: 'kiwi',
    mint: 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3',
    logo: '',
    description: '',
    available: true,
    supportsAtomicSwaps: true,
    provider: 'crypto',
    instrument: 'crypto',
    transferFeeBps: 0,
  },
  {
    symbol: 'tOpenAI',
    name: 'OpenAI',
    kind: 'Pre-IPO exposure',
    shelf: 'private',
    tone: 'grape',
    mint: 'oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
    logo: '',
    description: "Loan participation right linked to OpenAI's pre-IPO valuation.",
    available: true,
    supportsAtomicSwaps: false,
    provider: 'tessera',
    instrument: 'loan_participation',
    transferFeeBps: 20,
  },
  {
    symbol: 'tKalshi',
    name: 'Kalshi',
    kind: 'Pre-IPO exposure',
    shelf: 'private',
    tone: 'sun',
    mint: 'TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
    logo: '',
    description: "Loan participation right linked to Kalshi's pre-IPO valuation.",
    available: true,
    supportsAtomicSwaps: false,
    provider: 'tessera',
    instrument: 'loan_participation',
    transferFeeBps: 20,
  },
  {
    symbol: 'tSpaceX',
    name: 'SpaceX',
    kind: 'Pre-IPO exposure',
    shelf: 'private',
    tone: 'sky',
    mint: 'TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
    logo: '',
    description: "Loan participation right linked to SpaceX's pre-IPO valuation.",
    available: true,
    supportsAtomicSwaps: false,
    provider: 'tessera',
    instrument: 'loan_participation',
    transferFeeBps: 20,
  },
]

export default function InvestScreen() {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const { account, linked, connecting, linkWallet } = useWalletLink()
  const catalog = useInvestableAssets()
  const network = useNetwork()
  const router = useRouter()
  // An asset opens its own page — price, chart, then a Buy button — rather than dropping
  // straight into the buy sheet, so looking and buying are no longer the same step.
  const openAsset = (asset: ShelfAsset) => router.push({ pathname: '/asset/[mint]', params: { mint: asset.mint } })

  const [risksOpen, setRisksOpen] = useState(false)

  // The catalogue supplies mints, availability, fees and artwork; the shelf keeps its own
  // framing (`name`, `kind`, `tone`) so a raw ticker never replaces the plain-language label.
  const assets = SHELF.map((asset) => {
    // `assets` is guarded as well as `data`: a response that arrives without it — which
    // apiRequest used to hand back as an empty success — blanked the entire screen.
    const live = catalog.data?.assets?.find((entry) => entry.symbol === asset.symbol)
    return { ...asset, ...(live ?? {}), name: asset.name, kind: asset.kind, tone: asset.tone, shelf: asset.shelf }
  })

  return (
    <>
      <Screen>
        <AppHeader eyebrow="The shelf" title="Invest calmly" />

        {/* ── What it is worth and how it has done, first. It used to be a row two-thirds
            of the way down; the number someone opens this screen for should not need finding. ── */}
        <PortfolioCard />

        {/* ── Wallet state, as a single row. ── */}
        <PressableCard
          tone={linked ? 'kiwi' : 'neutral'}
          accessibilityLabel={linked ? 'Wallet verified' : 'Connect your wallet'}
          onPress={linked ? () => undefined : linkWallet}
          disabled={connecting}
          style={styles.wallet}
        >
          <Object3D name={linked ? 'shield' : 'moneyBag'} size={44} />
          <View style={styles.walletCopy}>
            <T role="label" color={colors.ink}>
              {linked ? 'Wallet verified' : account ? 'Verify ownership' : 'Connect your wallet'}
            </T>
            <T role="caption" color={linked ? colors.kiwiDeep : colors.inkFaint}>
              {network.selectedNetwork.label} · self-custodial
            </T>
          </View>
          {linked ? <Icon name="checkCircle" size={22} color={colors.kiwiDeep} /> : <Chip label="Required" />}
        </PressableCard>

        <Shelf
          title="Public markets"
          badge="xStocks"
          assets={assets.filter((asset) => asset.shelf === 'public')}
          onSelect={openAsset}
          onSeeAll={() => router.push('/markets')}
        />

        <Shelf
          title="Crypto"
          badge="On Solana"
          assets={assets.filter((asset) => asset.shelf === 'crypto')}
          onSelect={openAsset}
        />

        <Shelf
          title="Private markets"
          badge="Tessera"
          assets={assets.filter((asset) => asset.shelf === 'private')}
          onSelect={openAsset}
        />

        <PressableCard
          accessibilityLabel="Browse every available asset"
          onPress={() => router.push('/markets')}
          style={styles.wallet}
        >
          <Object3D name="chartUp" size={44} />
          <View style={styles.walletCopy}>
            <T role="label" color={colors.ink}>
              Browse all markets
            </T>
            <T role="caption" color={colors.inkFaint}>
              Stocks, crypto and private markets, live prices, no wallet needed
            </T>
          </View>
          <Icon name="chevronRight" size={18} color={colors.inkFaint} />
        </PressableCard>

        {/* ── Every word of risk copy lives behind this one row. ── */}
        <PressableCard
          accessibilityLabel="Read how the shelf works and the risks"
          onPress={() => setRisksOpen(true)}
          style={styles.risks}
        >
          <Icon name="info" size={20} color={colors.inkMuted} />
          <T role="label" color={colors.inkMuted} style={styles.risksLabel}>
            How this shelf works · Risks
          </T>
          <Icon name="chevronRight" size={18} color={colors.inkFaint} />
        </PressableCard>
      </Screen>

      {/* ── Risks ── */}
      <Sheet
        visible={risksOpen}
        onClose={() => setRisksOpen(false)}
        eyebrow="Before you invest"
        title="The shelf & the risks"
      >
        <View style={styles.riskBody}>
          <RiskNote
            title="A small shelf, on purpose"
            body="A few understandable options, chosen for a long-term habit. No trending lists, no performance races."
          />
          <RiskNote
            title="Quotes come from the route"
            body="Prices are taken from the execution route at review time, not from a market-data subscription."
          />
          <RiskNote
            title="Tokenized assets carry issuer risk"
            body="Issuer, liquidity, market and eligibility risks all apply, and they are not the same as owning the underlying."
          />
          <RiskNote
            title="Crypto moves fast"
            body="SOL, bitcoin and SKR can rise or fall sharply, often within a day. cbBTC also depends on Coinbase holding the bitcoin behind it."
          />
          <RiskNote
            title="T-Tokens are not shares"
            body="Tessera T-Tokens are high-risk loan participation rights with a fee on sale or transfer, and may be restricted where you live."
          />
        </View>
        <Button label="Got it" variant="secondary" onPress={() => setRisksOpen(false)} />
      </Sheet>
    </>
  )
}

function Shelf({
  title,
  badge,
  assets,
  onSelect,
  onSeeAll,
}: {
  title: string
  badge: string
  assets: ShelfAsset[]
  onSelect: (asset: ShelfAsset) => void
  onSeeAll?: () => void
}) {
  const { colors } = useAppTheme()
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        action={
          // "See all" sits in the section header because that is where anyone
          // looks for it. The provider badge stays alongside it for provenance.
          <Row gap={space[2]}>
            <Chip label={badge} tone="neutral" />
            {onSeeAll ? <Chip label="See all" icon="arrowRight" tone="kiwi" onPress={onSeeAll} /> : null}
          </Row>
        }
      />
      <View style={styles.assets}>
        {assets.map((asset) => {
          // An unlisted asset stays fully legible — the "Soon" chip carries the state, so
          // dimming the row as well would just make the shelf hard to read.
          const body = (
            <>
              <AssetMark asset={asset} />
              <View style={styles.assetCopy}>
                <Row gap={space[2]}>
                  <T role="label">{asset.name}</T>
                  <T role="caption" color={colors.inkFaint}>
                    {asset.symbol}
                  </T>
                </Row>
                <T role="caption" color={colors.inkFaint}>
                  {asset.kind}
                </T>
              </View>
              {/* Live price, no wallet needed. A missing quote shows nothing
                  rather than a misleading zero. */}
              <View style={styles.assetPrice}>
                {asset.priceUsd != null ? <T role="label">{formatPrice(asset.priceUsd)}</T> : null}
                {asset.priceChange24h != null ? (
                  <T role="caption" color={asset.priceChange24h >= 0 ? colors.kiwiDeep : colors.coralDeep}>
                    {asset.priceChange24h >= 0 ? '+' : '−'}
                    {Math.abs(asset.priceChange24h).toFixed(1)}%
                  </T>
                ) : null}
              </View>
              {asset.available ? (
                <Icon name="chevronRight" size={18} color={colors.inkFaint} />
              ) : (
                <Chip label="Soon" tone="neutral" />
              )}
            </>
          )

          return asset.available ? (
            <PressableCard
              key={asset.symbol}
              accessibilityLabel={`Review ${asset.name}`}
              onPress={() => onSelect(asset)}
              style={styles.asset}
            >
              {body}
            </PressableCard>
          ) : (
            <Card key={asset.symbol} style={styles.asset}>
              {body}
            </Card>
          )
        })}
      </View>
    </View>
  )
}

/**
 * The asset's own artwork once the catalogue has answered. Until then — and for
 * anything without a logo — the shelf's tone plate carries the row, so the list
 * never flashes empty squares while the request is in flight.
 */
function AssetMark({ asset }: { asset: ShelfAsset }) {
  const { colors } = useAppTheme()
  const background = {
    kiwi: colors.kiwi,
    grape: colors.grape,
    coral: colors.coral,
    sky: colors.sky,
    sun: colors.sun,
    neutral: colors.surfaceSunken,
  }[asset.tone]
  const foreground = asset.tone === 'grape' || asset.tone === 'coral' ? colors.inkInverse : colors.ink
  return (
    <AssetLogo asset={asset} size={46} letters={1} role="subheading" background={background} foreground={foreground} />
  )
}

function RiskNote({ title, body }: { title: string; body: string }) {
  const { colors } = useAppTheme()
  return (
    <View style={{ gap: space[1] }}>
      <T role="label" color={colors.ink}>
        {title}
      </T>
      <T role="bodySmall">{body}</T>
    </View>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    wallet: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    walletCopy: { flex: 1, gap: 2 },
    section: { gap: space[3] },
    assets: { gap: space[2] },
    asset: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[4] },
    assetCopy: { flex: 1, gap: 2 },
    assetPrice: { alignItems: 'flex-end', gap: 2 },
    risks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      backgroundColor: colors.surfaceSunken,
      shadowOpacity: 0,
      elevation: 0,
    },
    risksLabel: { flex: 1 },
    riskBody: { gap: space[4] },
  }),
)
