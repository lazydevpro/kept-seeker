import { Base64 } from 'js-base64'
import { useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, TextInput, View } from 'react-native'
import { getTransactionDecoder, getTransactionEncoder } from '@solana/kit'
import { useWallet } from '@/features/demo/demo-wallet'
import { Button, Chip, Row, Sheet, T } from '@/components/ui'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { radii, space } from '@/constants/theme'
import { usd, type Position } from '@/features/portfolio/portfolio-api'
import { executeTrade, requestSellOrder, useSellQuote, type TradeOrder } from './trade-api'
import { useWalletLink } from './use-wallet-link'
import { useSettlementWatch } from './settlement'

/**
 * Selling a position back to USDC.
 *
 * The mirror of the buy ticket, with three deliberate differences.
 *
 * **It is priced in units, not dollars.** The seller has a quantity, not a
 * budget — "all of it" or "half" is the real intent, so the presets are
 * fractions of the holding and the field is in asset units.
 *
 * **The transfer fee is shown on its own line.** Jupiter prices the swap; a
 * Token-2022 transfer fee is taken by the mint outside the route. Netting it
 * into the headline would put a number on screen that Jupiter never quoted, so
 * the estimate and the deduction are listed separately and only the final line
 * claims to be what lands.
 *
 * **Nothing about promises appears here.** Selling does not close a week, does
 * not touch a streak and is never posted to a circle. Mentioning any of that,
 * even to deny it, would imply the opposite is possible.
 */

/** Fractions of the holding, which is how anybody actually decides to sell. */
const PRESETS = [0.25, 0.5, 1] as const

export function SellSheet({ position, onClose }: { position: Position | null; onClose: () => void }) {
  const { colors } = useAppTheme()
  const styles = useStyles()
  const { signTransactions } = useWallet()
  const { account, linked, connecting, linkWallet } = useWalletLink()
  const watchSettlement = useSettlementWatch()

  const [text, setText] = useState('')
  const [order, setOrder] = useState<TradeOrder | null>(null)
  const [busy, setBusy] = useState(false)

  const held = position?.quantity ?? 0

  // A new position means a stale quote and a stale order. Clearing on close would
  // leave both alive for the moment the next sheet opens.
  useEffect(() => {
    setText('')
    setOrder(null)
    setBusy(false)
  }, [position?.mint])

  const quantity = useMemo(() => {
    const parsed = Number(text)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [text])

  /**
   * Floating point is why this is a tolerance and not `<=`. A "sell all" preset
   * writes the holding through `toFixed`, which can round a hair above it, and
   * the server would refuse the reader's own balance.
   */
  const valid = quantity > 0 && quantity <= held * 1.000001
  const quote = useSellQuote(valid ? (position?.mint ?? null) : null, valid ? quantity : null)

  const decimals = position?.decimals ?? 6
  const setFraction = (fraction: number) =>
    setText(fraction === 1 ? String(held) : (held * fraction).toFixed(Math.min(decimals, 6)))

  const prepare = async () => {
    if (!position || !account || !valid) return
    setBusy(true)
    try {
      const prepared = await requestSellOrder({
        inputMint: position.mint,
        quantity: Math.min(quantity, held),
        taker: String(account.address),
      })
      setOrder(prepared.order)
    } catch (error) {
      Alert.alert('Quote unavailable', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!order || !position) return
    setBusy(true)
    try {
      const transaction = getTransactionDecoder().decode(Base64.toUint8Array(order.transaction))
      const signed = await signTransactions(transaction)
      const encoded = getTransactionEncoder().encode(signed)
      const execution = await executeTrade({
        requestId: order.requestId,
        signedTransaction: Base64.fromUint8Array(new Uint8Array(encoded)),
      })
      /*
       * Watched like a purchase, but with no ring and no celebration screen.
       * Selling is a thing the product must let you do, not a thing it cheers —
       * the settled banner is the whole acknowledgement it gets.
       */
      watchSettlement({
        contributionId: execution.contributionId,
        symbol: position.symbol,
        direction: 'sell',
      })
      Alert.alert(
        'Sale submitted',
        `${execution.result.signature.slice(0, 8)}… is confirming. Your portfolio updates once it settles.`,
      )
      onClose()
    } catch (error) {
      Alert.alert('Sale unavailable', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const preview = quote.data?.quote
  const netUsdc = preview ? preview.proceedsUsdc - preview.transferFeeUsdc : null

  const actionLabel = () => {
    if (busy) return order ? 'Opening wallet…' : 'Preparing…'
    if (!linked) return connecting ? 'Connecting…' : account ? 'Sign to verify wallet' : 'Connect wallet'
    if (!quantity) return 'Enter an amount'
    if (!valid) return 'More than you hold'
    if (!order) return `Sell ${position?.symbol ?? ''}`
    return 'Approve in wallet'
  }

  return (
    <Sheet
      visible={Boolean(position)}
      onClose={onClose}
      eyebrow="Sell"
      title={position?.symbol ?? ''}
      footer={
        <Button
          label={actionLabel()}
          onPress={!linked ? linkWallet : order ? confirm : prepare}
          disabled={busy || connecting || (linked && !valid)}
        />
      }
    >
      <View style={styles.body}>
        <Row style={styles.between}>
          <T role="caption" color={colors.inkMuted}>
            You hold
          </T>
          <T role="label">
            {held.toLocaleString('en-US', { maximumFractionDigits: 6 })} {position?.symbol}
          </T>
        </Row>

        <View style={styles.field}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            accessibilityLabel={`Quantity of ${position?.symbol ?? 'asset'} to sell`}
          />
          <T role="label" color={colors.inkMuted}>
            {position?.symbol}
          </T>
        </View>

        <Row style={styles.presets}>
          {PRESETS.map((fraction) => (
            <Chip
              key={fraction}
              label={fraction === 1 ? 'All' : `${fraction * 100}%`}
              onPress={() => setFraction(fraction)}
            />
          ))}
        </Row>

        {preview ? (
          <View style={styles.quote}>
            <Row style={styles.between}>
              <T role="caption" color={colors.inkMuted}>
                Estimated
              </T>
              <T role="label">{usd(preview.proceedsUsdc)}</T>
            </Row>
            {preview.transferFeeBps > 0 ? (
              <Row style={styles.between}>
                <T role="caption" color={colors.inkMuted}>
                  Transfer fee ({(preview.transferFeeBps / 100).toFixed(2)}%)
                </T>
                <T role="label" color={colors.coralDeep}>
                  −{usd(preview.transferFeeUsdc)}
                </T>
              </Row>
            ) : null}
            <Row style={styles.between}>
              <T role="label">You receive</T>
              <T role="subheading">{netUsdc === null ? '—' : usd(netUsdc)}</T>
            </Row>
            {preview.route ? (
              <T role="caption" color={colors.inkMuted}>
                via {preview.route}
              </T>
            ) : null}
          </View>
        ) : quote.isError ? (
          <T role="caption" color={colors.coralDeep}>
            Could not price that amount right now.
          </T>
        ) : null}

        <T role="caption" color={colors.inkMuted}>
          USDC lands in your own wallet. KEPT never holds it.
        </T>
      </View>
    </Sheet>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    body: { gap: space[4] },
    between: { justifyContent: 'space-between' },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingHorizontal: space[4],
      paddingVertical: space[3],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.surfaceSunken,
    },
    input: {
      flex: 1,
      // react-native-web gives <input> an intrinsic width flex will not shrink,
      // which pushes the symbol suffix out of the field.
      minWidth: 0,
      fontSize: 24,
      fontWeight: '700',
      color: colors.ink,
    },
    presets: { gap: space[2] },
    quote: {
      gap: space[2],
      padding: space[4],
      borderRadius: radii.md,
      backgroundColor: colors.surfaceSunken,
    },
  }),
)
