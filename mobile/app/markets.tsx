/**
 * Browse every investable asset — ~930 tokenised stocks plus the private-market
 * ones — searchable, with live prices.
 *
 * No wallet required. Browsing and pricing are public reads; a wallet is only
 * needed to sign a purchase, so the whole market is visible before anyone
 * connects anything.
 *
 * This is deliberately a separate screen from the Invest shelf. The shelf stays
 * short because choosing from five understandable options is the habit the
 * product is trying to build; this is the escape hatch for people who want to
 * see the whole universe, not a replacement for it.
 */

import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native'
import { Card, Chip, IconButton, PressableCard, Row, Screen, T } from '@/components/ui'
import { radii, space, type } from '@/constants/theme'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { Icon } from '@/design/icons'
import { Illustration } from '@/design/illustrations'
import { AssetLogo } from '@/features/trade/asset-logo'
import { useAssetCatalog, type InvestableAsset } from '@/features/trade/trade-api'
import { formatPrice as price } from '@/features/trade/format-price'

export default function MarketsScreen() {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const router = useRouter()
  const [query, setQuery] = useState('')
  // Rows open the asset's own page; the buy sheet is one step further in, behind its Buy button.
  const openAsset = (asset: InvestableAsset) => router.push({ pathname: '/asset/[mint]', params: { mint: asset.mint } })
  const catalog = useAssetCatalog(query)

  const pages = catalog.data?.pages ?? []
  const first = pages[0]
  const assets = pages.flatMap((page) => page.assets)

  return (
    <>
      <Screen
        // Pages append as you approach the bottom, so the list never asks to be
        // paged through by hand.
        onEndReached={() => {
          if (catalog.hasNextPage && !catalog.isFetchingNextPage) catalog.fetchNextPage()
        }}
      >
        <Row style={styles.header}>
          <IconButton name="chevronLeft" label="Back" onPress={() => router.back()} />
          <View style={styles.headerCopy}>
            <T role="eyebrow" color={colors.inkFaint}>
              {first ? `${first.total} ${first.total === 1 ? 'asset' : 'assets'}` : 'Public markets'}
            </T>
            <T role="title">Browse all</T>
          </View>
        </Row>

        <Card flat style={styles.searchCard}>
          <Icon name="search" size={18} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Apple, NVDA, gold…"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={[type.body, styles.searchInput, { color: colors.ink }]}
          />
          {query ? (
            <IconButton name="close" label="Clear search" onPress={() => setQuery('')} size={32} on="card" />
          ) : null}
        </Card>

        {catalog.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.kiwiDeep} />
            <T role="caption" center color={colors.inkFaint}>
              Loading the market…
            </T>
          </View>
        ) : assets.length === 0 ? (
          <Card style={styles.empty}>
            <Illustration name="quiet" width={200} label="Nothing found" />
            <T role="body" center>
              Nothing matches “{query}”.
            </T>
          </Card>
        ) : (
          <View style={styles.list}>
            {assets.map((asset) => (
              <AssetRow key={asset.mint} asset={asset} onSelect={openAsset} />
            ))}
          </View>
        )}

        {catalog.isFetchingNextPage ? (
          <View style={styles.more}>
            <ActivityIndicator color={colors.kiwiDeep} />
          </View>
        ) : !catalog.hasNextPage && assets.length > 0 ? (
          <T role="caption" center color={colors.inkFaint}>
            That’s all {first?.total} of them.
          </T>
        ) : null}

        {first && !first.priced ? (
          <T role="caption" center color={colors.inkFaint}>
            Live prices are unavailable right now.
          </T>
        ) : null}
      </Screen>
    </>
  )
}

function AssetRow({ asset, onSelect }: { asset: InvestableAsset; onSelect: (asset: InvestableAsset) => void }) {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const change = asset.priceChange24h ?? null
  const changeColour = change === null ? colors.inkFaint : change >= 0 ? colors.kiwiDeep : colors.coralDeep

  const body = (
    <>
      <AssetLogo asset={asset} size={42} background={colors.kiwiTint} />
      <View style={styles.rowCopy}>
        <Row gap={space[2]}>
          <T role="label" numberOfLines={1}>
            {asset.symbol}
          </T>
          {asset.provider === 'tessera' ? <Chip label="Private" tone="grape" /> : null}
          {asset.provider === 'crypto' ? <Chip label="Crypto" tone="sky" /> : null}
          {!asset.available ? <Chip label="Halted" tone="neutral" /> : null}
        </Row>
        <T role="caption" color={colors.inkFaint} numberOfLines={1}>
          {asset.name}
        </T>
      </View>
      <View style={styles.rowValue}>
        {/* A missing quote reads as "—", never as a price of zero. */}
        <T role="label">{asset.priceUsd != null ? price(asset.priceUsd) : '—'}</T>
        {change !== null ? (
          <T role="caption" color={changeColour}>
            {change >= 0 ? '+' : '−'}
            {Math.abs(change).toFixed(1)}%
          </T>
        ) : null}
      </View>
      {asset.available ? <Icon name="chevronRight" size={18} color={colors.inkFaint} /> : null}
    </>
  )

  // A halted asset is still worth reading, so it keeps its price and its row —
  // it just has nothing to open, and the "Halted" chip already says why.
  return asset.available ? (
    <PressableCard accessibilityLabel={`Review ${asset.name}`} onPress={() => onSelect(asset)} style={styles.row}>
      {body}
    </PressableCard>
  ) : (
    <Card style={styles.row}>{body}</Card>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    header: { minHeight: 56 },
    headerCopy: { flex: 1, gap: space[1] },
    searchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingVertical: space[2],
      paddingHorizontal: space[4],
      borderRadius: radii.pill,
    },
    searchInput: { flex: 1, minHeight: 40, outlineStyle: 'none' as never },
    loading: { paddingVertical: space[10], alignItems: 'center', gap: space[3] },
    empty: { alignItems: 'center', gap: space[3], paddingVertical: space[6] },
    list: { gap: space[2] },
    row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
    rowCopy: { flex: 1, gap: 2 },
    rowValue: { alignItems: 'flex-end', gap: 2 },
    more: { paddingVertical: space[4], alignItems: 'center' },
  }),
)
