/**
 * The buy ticket.
 *
 * This was a summary of the promise — "Weekly promise $25", "Circle sees
 * progress only" — which is true and has nothing to do with the decision in
 * front of someone about to spend money. None of it told them what the thing
 * costs, which way it has moved, or what they would end up holding.
 *
 * So it is now a small terminal: price and recent movement at the top, an amount
 * you type, and a live quote underneath showing what that amount actually buys
 * and what each unit really costs once the route is taken. The amount is free —
 * the weekly promise is a habit, not a price list, and anyone may put in more or
 * less than they promised.
 *
 * It owns the wallet link, the order and the signature, so any list of assets
 * can hand it an asset and get the same ticket.
 */

import { getTransactionDecoder, getTransactionEncoder } from '@solana/kit'
import { Base64 } from 'js-base64'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useWallet } from '@/features/demo/demo-wallet'
import { Button, Chip, Row, Sheet, T } from '@/components/ui'
import { radii, space, type } from '@/constants/theme'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { Icon } from '@/design/icons'
import * as WebBrowser from 'expo-web-browser'
import { AppConfig } from '@/constants/app-config'
import { useAcceptTerms } from '@/features/account/account-api'
import { useGoals, useMe } from '@/features/social/social-api'
import { useNetwork } from '@/features/network/use-network'
import { AssetLogo } from './asset-logo'
import {
  executeTrade,
  requestTradeOrder,
  useAssetDetail,
  useQuotePreview,
  type InvestableAsset,
  type TradeOrder,
} from './trade-api'
import { useWalletLink } from './use-wallet-link'
import { KeptMoment } from './kept-moment'
import { useSettlementWatch } from './settlement'
import { DEMO, walletPause } from '@/features/demo/demo'

/** A demo order carries no transaction; the server only needs the field to be there. */
const DEMO_SIGNED = 'demo'.padEnd(120, '0')

/** Matches the server's guard. A ceiling against a slipped decimal, not a cap on ambition. */
const MIN_USDC = 1
const MAX_USDC = 10_000
const PRESETS = [25, 50, 100, 250]

const money = (value: number, digits = 2) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits })

/** $108,197 → "$108.2k". Deep numbers are context, not figures to read digit by digit. */
const compact = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  })

const pct = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`

/** ["a", "b", "c"] → "a, b or c". The list comes from the server, so it cannot drift from the terms. */
const listOf = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`

export function PurchaseSheet({ asset, onClose }: { asset: InvestableAsset | null; onClose: () => void }) {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const { signTransactions } = useWallet()
  const { account, linked, connecting, linkWallet } = useWalletLink()
  const watchSettlement = useSettlementWatch()
  const [done, setDone] = useState<{ receives: string | null; rehearsal: boolean } | null>(null)
  const goals = useGoals()
  const network = useNetwork()

  const [amountText, setAmountText] = useState('25')
  const [trading, setTrading] = useState(false)
  const [order, setOrder] = useState<TradeOrder | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  /*
   * Once per account, before the first purchase: the issuers restrict who may
   * hold these tokens, so the reader confirms they are not one of those people
   * and accepts the terms. The server refuses an order until they have
   * (`terms_required`); selling is never gated.
   */
  const me = useMe()
  const acceptTerms = useAcceptTerms()
  const terms = me.data?.terms
  const termsNeeded = Boolean(linked && terms && !terms.accepted)
  const [eligible, setEligible] = useState(false)

  const detail = useAssetDetail(asset?.mint ?? null).data?.asset ?? null
  const isTessera = (detail?.provider ?? asset?.provider) === 'tessera'

  const amount = Number(amountText.replace(/[^0-9.]/g, ''))
  const amountValid = Number.isFinite(amount) && amount >= MIN_USDC && amount <= MAX_USDC

  // Typing "125" should not fire three quotes. The quote follows the number once
  // it settles.
  const [settledAmount, setSettledAmount] = useState<number | null>(null)
  useEffect(() => {
    if (!amountValid) {
      setSettledAmount(null)
      return
    }
    const timer = setTimeout(() => setSettledAmount(amount), 350)
    return () => clearTimeout(timer)
  }, [amount, amountValid])

  const quoteQuery = useQuotePreview(asset?.mint ?? null, settledAmount)
  const quote = quoteQuery.data?.quote ?? null

  // A quote is for one asset, one amount, one moment. Opening a different asset
  // must not inherit the last one's route or its risk acknowledgement.
  useEffect(() => {
    setOrder(null)
    setAcknowledged(false)
    setAmountText('25')
    setDone(null)
  }, [asset?.mint])

  const price = detail?.priceUsd ?? asset?.priceUsd ?? null
  const change24h = detail?.change24h ?? asset?.priceChange24h ?? null
  const feePct = (detail?.transferFeeBps ?? asset?.transferFeeBps ?? 0) / 100

  const prepare = async () => {
    if (!asset || !account || !amountValid) return
    if (termsNeeded && (!eligible || !terms)) return
    setTrading(true)
    try {
      if (termsNeeded && terms) await acceptTerms.mutateAsync(terms.current)
      const prepared = await requestTradeOrder({
        outputMint: asset.mint,
        outputSymbol: asset.symbol,
        amountUsdc: amount,
        taker: String(account.address),
        goalId: goals.data?.goals[0]?.id,
        tesseraAcknowledged: isTessera ? acknowledged : undefined,
      })
      setOrder(prepared.order)
    } catch (error) {
      Alert.alert('Quote unavailable', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setTrading(false)
    }
  }

  const confirm = async () => {
    // `asset` as well as `order`: the success view is built from the asset, and
    // the sheet can be handed a different one between preparing and approving.
    if (!order || !asset) return
    setTrading(true)
    try {
      let signedTransaction: string
      if (DEMO) {
        // No wallet app and no chain: the pause where one would be approving it.
        await walletPause(1200)
        signedTransaction = DEMO_SIGNED
      } else {
        const transaction = getTransactionDecoder().decode(Base64.toUint8Array(order.transaction))
        const signed = await signTransactions(transaction)
        signedTransaction = Base64.fromUint8Array(new Uint8Array(getTransactionEncoder().encode(signed)))
      }
      const execution = await executeTrade({ requestId: order.requestId, signedTransaction })
      /*
       * Two stages. This one is instant and optimistic — the ring closes the
       * moment the wallet returns a signature. The chain has not been asked yet,
       * so nothing here says "kept"; `settlement.tsx` watches for the answer and
       * brings that word with it, wherever the reader has got to by then.
       */
      watchSettlement({
        contributionId: execution.contributionId,
        symbol: asset.symbol,
        direction: 'buy',
      })
      setDone({
        receives: quote?.outQuantity
          ? `${quote.outQuantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${asset.symbol}`
          : null,
        rehearsal: order.mode === 'sandbox',
      })
    } catch (error) {
      Alert.alert('Investment unavailable', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setTrading(false)
    }
  }

  const actionLabel = () => {
    if (trading) return order ? 'Opening wallet…' : 'Preparing…'
    if (!linked) return connecting ? 'Connecting…' : account ? 'Sign to verify wallet' : 'Connect wallet'
    if (!amountValid) return `Enter $${MIN_USDC}–$${MAX_USDC.toLocaleString('en-US')}`
    if (termsNeeded && !eligible) return 'Confirm eligibility to continue'
    if (isTessera && !acknowledged) return 'Acknowledge the risk to continue'
    if (!order) return `Buy ${money(amount)} of ${asset?.symbol ?? ''}`
    return order.mode === 'sandbox' ? 'Sign devnet rehearsal' : 'Approve in wallet'
  }

  return (
    <Sheet
      visible={Boolean(asset)}
      onClose={onClose}
      eyebrow={detail?.name ?? asset?.name ?? ''}
      title={asset?.symbol ?? ''}
      leading={done ? null : asset ? <AssetLogo asset={asset} size={44} /> : null}
      // Pinned: the ticket is taller than a short screen, and the one thing
      // that must never be scrolled away is the button that spends the money.
      footer={
        done ? null : (
          <>
            {/* The acknowledgement rides with the body's action, not the body: it
              gates the action, and scrolled out of sight it left the button
              asking for something the reader could not see. */}
            {termsNeeded && terms ? (
              <View style={[styles.ack, styles.ackStack, eligible && styles.ackOn]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: eligible }}
                  onPress={() => setEligible((value) => !value)}
                  style={styles.ackPress}
                >
                  <Icon
                    name={eligible ? 'checkCircle' : 'dot'}
                    size={22}
                    color={eligible ? colors.kiwiDeep : colors.inkFaint}
                  />
                  <T role="caption" style={styles.ackText}>
                    I am not a U.S. person, I do not live in {listOf(terms.restrictedJurisdictions)}, and I accept the
                    Terms of use.
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void WebBrowser.openBrowserAsync(AppConfig.termsUrl)}
                  hitSlop={8}
                >
                  <T role="caption" color={colors.kiwiDeep}>
                    Read the terms
                  </T>
                </Pressable>
              </View>
            ) : null}
            {isTessera ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                onPress={() => setAcknowledged((value) => !value)}
                style={[styles.ack, acknowledged && styles.ackOn]}
              >
                <Icon
                  name={acknowledged ? 'checkCircle' : 'dot'}
                  size={22}
                  color={acknowledged ? colors.kiwiDeep : colors.inkFaint}
                />
                <T role="caption" style={styles.ackText}>
                  A high-risk loan participation right — not equity, and possibly restricted where you live.
                </T>
              </Pressable>
            ) : null}
            <Button
              label={actionLabel()}
              onPress={linked ? (order ? confirm : prepare) : linkWallet}
              disabled={
                connecting ||
                trading ||
                (linked &&
                  (!amountValid || !asset?.available || (termsNeeded && !eligible) || (isTessera && !acknowledged)))
              }
            />
            <T role="caption" center color={colors.inkFaint}>
              {order?.mode === 'sandbox'
                ? 'Devnet rehearsal — no USDC is spent.'
                : 'Counts toward this week. Nothing moves until you approve it in your wallet.'}
            </T>
          </>
        )
      }
    >
      {/*
        Signed. The ticket is replaced rather than covered — the numbers that led
        to the decision are no longer the subject, and leaving them underneath
        invites a second tap on a button that would buy again.
      */}
      {done ? (
        <KeptMoment
          symbol={asset?.symbol ?? ''}
          amountUsd={money(amount)}
          receives={done.receives}
          rehearsal={done.rehearsal}
          onDone={onClose}
        />
      ) : (
        <>
          {/* ── Price ── */}
          <View style={styles.priceBlock}>
            <Row gap={space[3]}>
              <T role="stat">{price != null ? money(price) : '—'}</T>
              {change24h != null ? (
                <T role="label" color={change24h >= 0 ? colors.kiwiDeep : colors.coralDeep}>
                  {pct(change24h)}
                </T>
              ) : null}
            </Row>
            <Row gap={space[2]}>
              {isTessera ? <Chip label="Private market" tone="grape" /> : null}
              {detail?.verified ? <Chip label="Verified mint" tone="neutral" /> : null}
            </Row>
          </View>

          {/* ── Amount ── */}
          <View style={styles.field}>
            <T role="caption" color={colors.inkFaint}>
              You pay
            </T>
            <View style={[styles.input, !amountValid && amountText.length > 0 && styles.inputBad]}>
              <T role="stat" color={colors.inkFaint}>
                $
              </T>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                inputMode="decimal"
                selectTextOnFocus
                accessibilityLabel="Amount in US dollars"
                placeholder="0"
                placeholderTextColor={colors.inkFaint}
                style={[type.stat, styles.inputText, { color: colors.ink }]}
              />
              <T role="caption" color={colors.inkFaint}>
                USDC
              </T>
            </View>
            <Row gap={space[2]}>
              {PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  label={`$${preset}`}
                  tone={amount === preset ? 'kiwi' : 'neutral'}
                  onPress={() => setAmountText(String(preset))}
                />
              ))}
            </Row>
          </View>

          {/* ── What that buys ── */}
          <View style={styles.receipt}>
            <Row style={styles.receiptRow}>
              <T role="bodySmall" color={colors.inkMuted}>
                You receive
              </T>
              {quoteQuery.isFetching && !quote ? (
                <ActivityIndicator color={colors.kiwiDeep} />
              ) : (
                <T role="label">
                  {quote?.outQuantity != null
                    ? `≈ ${quote.outQuantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${asset?.symbol ?? ''}`
                    : '—'}
                </T>
              )}
            </Row>
            <Row style={styles.receiptRow}>
              <T role="bodySmall" color={colors.inkMuted}>
                Price each
              </T>
              <T role="label">{quote?.pricePerUnit != null ? money(quote.pricePerUnit) : '—'}</T>
            </Row>
            <Row style={styles.receiptRow}>
              <T role="bodySmall" color={colors.inkMuted}>
                Price impact
              </T>
              <T role="label" color={(quote?.priceImpactPct ?? 0) > 1 ? colors.coralDeep : colors.ink}>
                {quote?.priceImpactPct != null ? `${quote.priceImpactPct.toFixed(2)}%` : '—'}
              </T>
            </Row>
            {feePct > 0 ? (
              <Row style={styles.receiptRow}>
                <T role="bodySmall" color={colors.inkMuted}>
                  Transfer fee
                </T>
                <T role="label">{feePct}%</T>
              </Row>
            ) : null}
            <Row style={[styles.receiptRow, styles.receiptLast]}>
              <T role="bodySmall" color={colors.inkMuted}>
                Route
              </T>
              <T role="label" numberOfLines={1}>
                {order?.mode === 'sandbox' ? 'Devnet rehearsal' : (quote?.route ?? network.selectedNetwork.label)}
              </T>
            </Row>
          </View>

          {/* ── Market depth, as context rather than a headline. ── */}
          <Row gap={space[2]} style={styles.stats}>
            <Stat label="Liquidity" value={detail?.liquidityUsd != null ? compact(detail.liquidityUsd) : '—'} />
            <Stat label="24h volume" value={detail?.volume24hUsd != null ? compact(detail.volume24hUsd) : '—'} />
            <Stat label="Holders" value={detail?.holders != null ? detail.holders.toLocaleString('en-US') : '—'} />
          </Row>
        </>
      )}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme()
  const styles = useStyles()
  return (
    <View style={styles.stat}>
      <T role="caption" color={colors.inkFaint}>
        {label}
      </T>
      <T role="label" numberOfLines={1}>
        {value}
      </T>
    </View>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    priceBlock: { gap: space[2] },
    field: { gap: space[2] },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingHorizontal: space[4],
      paddingVertical: space[2],
      borderRadius: radii.lg,
      borderWidth: 2,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.surfaceSunken,
    },
    inputBad: { borderColor: colors.coral },
    // `minWidth: 0` is load-bearing on web: react-native-web gives the <input>
    // an intrinsic width of about twenty characters that flex will not shrink
    // below, which pushed the "USDC" suffix clean out of the field.
    inputText: { flex: 1, minWidth: 0, minHeight: 48, outlineStyle: 'none' as never },
    receipt: { backgroundColor: colors.surfaceSunken, borderRadius: radii.lg, paddingHorizontal: space[4] },
    receiptRow: {
      minHeight: 44,
      justifyContent: 'space-between',
      gap: space[4],
      borderBottomWidth: StyleSheet.hairlineWidth * 2,
      borderBottomColor: colors.hairline,
    },
    receiptLast: { borderBottomWidth: 0 },
    stats: { justifyContent: 'space-between' },
    stat: { flex: 1, gap: 2 },
    ack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceSunken,
    },
    ackOn: { backgroundColor: colors.kiwiTint },
    ackText: { flex: 1 },
    /** The eligibility box: the checkbox row, and the terms link under it. */
    ackStack: { flexDirection: 'column', alignItems: 'flex-start', gap: space[2] },
    ackPress: { flexDirection: 'row', alignItems: 'center', gap: space[3], alignSelf: 'stretch' },
  }),
)
