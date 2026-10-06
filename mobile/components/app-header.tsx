import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useWallet } from '@/features/demo/demo-wallet'
import { motion, radii, space, type } from '@/constants/theme'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { IconButton, T } from '@/components/ui'
import { Icon } from '@/design/icons'

function truncate(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

/**
 * One header for every tab: context above, title below, and exactly two controls. The
 * wallet collapses to a dot-and-glyph once connected so it stops competing with the title.
 *
 * The first control was the light/dark toggle. It is now the account — the only way to
 * reach sign-out, unlinking, the terms and deleting everything — and the toggle lives
 * inside it. Appearance is set once; the way out has to be findable from every tab.
 */
export function AppHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const { account, connect } = useWallet()
  const { colors } = useAppTheme()
  const styles = useStyles()
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)

  const handleWallet = async () => {
    if (account || connecting) return
    setConnecting(true)
    try {
      await connect()
    } finally {
      setConnecting(false)
    }
  }

  /**
   * Controls sit on the eyebrow line rather than beside the title, so the title always has
   * the full content width. Sharing a row with a wallet pill truncated anything longer than
   * about eleven characters — "Build my reserve" became "Build my …".
   */
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <T role="eyebrow" color={colors.inkFaint}>
          {eyebrow ?? ''}
        </T>
        <View style={styles.actions}>
          <IconButton name="person" label="Account and settings" onPress={() => router.push('/settings')} size={38} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={account ? `Wallet connected: ${account.address}` : 'Connect Solana wallet'}
            onPress={handleWallet}
            style={({ pressed }) => [styles.wallet, account && styles.walletLinked, pressed && motion.pressed]}
          >
            <View style={[styles.status, account && styles.statusLive]} />
            <Icon name="wallet" size={16} color={account ? colors.kiwiDeep : colors.inkMuted} />
            {!account ? (
              <Text style={[type.caption, { color: colors.inkMuted }]}>{connecting ? 'Connecting' : 'Connect'}</Text>
            ) : (
              <Text style={[type.mono, { color: colors.inkMuted, fontSize: 11 }]}>{truncate(account.address)}</Text>
            )}
          </Pressable>
        </View>
      </View>
      <T role="title" numberOfLines={2}>
        {title}
      </T>
    </View>
  )
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    header: { gap: space[2], marginBottom: space[1] },
    topRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    wallet: {
      minHeight: 38,
      borderRadius: radii.pill,
      paddingHorizontal: space[3],
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      backgroundColor: colors.surface,
    },
    walletLinked: { backgroundColor: colors.kiwiTint },
    status: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkFaint },
    statusLive: { backgroundColor: colors.kiwiDeep },
  }),
)
