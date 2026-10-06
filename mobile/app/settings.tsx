/**
 * Account — the ways out, in one place.
 *
 * Before this screen there were none: no way to leave a circle, unlink a wallet,
 * sign out or delete anything. A social app you cannot leave is one people are
 * right to be wary of joining.
 *
 * Signing out is only offered once a wallet is linked, because for an anonymous
 * account the wallet is the only way back in. Without one, "sign out" would
 * quietly be "delete", and it should say so rather than pretend otherwise.
 */

import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Alert, StyleSheet, TextInput, View } from 'react-native'
import { useWallet } from '@/features/demo/demo-wallet'
import { Button, Card, IconButton, ListRow, Row, Screen, SectionHeader, T } from '@/components/ui'
import { makeThemedStyles, useAppTheme } from '@/components/theme-provider'
import { radii, space, type } from '@/constants/theme'
import { AppConfig } from '@/constants/app-config'
import { IconPlate } from '@/design/icons'
import { type CircleSummary, useCircles, useMe } from '@/features/social/social-api'
import {
  useDeleteAccount,
  useRemoveFromCircle,
  useRename,
  useSignOut,
  useUnlinkWallet,
} from '@/features/account/account-api'
import { confirmAsync } from '@/lib/confirm'

function truncate(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export default function SettingsScreen() {
  const router = useRouter()
  const styles = useStyles()
  const { colors, mode, toggleTheme } = useAppTheme()
  const me = useMe()
  const circles = useCircles()
  const wallet = useWallet()
  const signOut = useSignOut()
  const deleteAccount = useDeleteAccount()
  const unlink = useUnlinkWallet()

  const wallets = me.data?.wallets ?? []
  const canSignOut = wallets.length > 0

  const fail = (title: string) => (error: unknown) =>
    Alert.alert(title, error instanceof Error ? error.message : 'Please try again.')

  const startOver = () => router.replace('/onboarding')

  const handleUnlink = async (address: string) => {
    const lastWay = wallets.length === 1
    const ok = await confirmAsync({
      title: 'Unlink this wallet?',
      message: lastWay
        ? 'It is your only way back into this account on another device. Your holdings stay in the wallet either way.'
        : 'Your holdings stay in the wallet. You can link it again any time.',
      confirmLabel: 'Unlink',
      destructive: lastWay,
    })
    if (!ok) return
    unlink.mutate(address, { onError: fail('Could not unlink') })
  }

  const handleSignOut = async () => {
    const ok = await confirmAsync({
      title: 'Sign out?',
      message: 'To come back, connect the same wallet and choose “I already use KEPT”.',
      confirmLabel: 'Sign out',
    })
    if (!ok) return
    await wallet.disconnect().catch(() => undefined)
    signOut.mutate(undefined, { onSuccess: startOver, onError: fail('Could not sign out') })
  }

  const handleDelete = async () => {
    const ok = await confirmAsync({
      title: 'Delete your account?',
      message:
        'Your goal, streak, awards and circle memberships are deleted for good. Circles you own pass to the longest-standing member. Your wallet and everything in it are not touched — KEPT never held them.',
      confirmLabel: 'Delete everything',
      destructive: true,
    })
    if (!ok) return
    await wallet.disconnect().catch(() => undefined)
    deleteAccount.mutate(undefined, { onSuccess: startOver, onError: fail('Could not delete the account') })
  }

  return (
    <Screen>
      <Row style={styles.header}>
        <IconButton name="chevronLeft" label="Back" onPress={() => router.back()} />
        <View style={styles.headerCopy}>
          <T role="eyebrow" color={colors.inkFaint}>
            Private to you
          </T>
          <T role="title">Account</T>
        </View>
      </Row>

      <NameCard current={me.data?.profile.displayName ?? ''} />

      <View>
        <SectionHeader title="Wallet" />
        <Card style={styles.list}>
          {wallets.length === 0 ? (
            <ListRow
              leading={<IconPlate name="wallet" tone="neutral" />}
              title="No wallet linked"
              subtitle="Link one from Invest. It is also how you get back into this account on a new phone."
              last
            />
          ) : (
            wallets.map((row, index) => (
              <ListRow
                key={row.id}
                leading={<IconPlate name="wallet" />}
                title={truncate(row.address)}
                subtitle="Linked · signs you back in on any device"
                trailing={<Button label="Unlink" variant="ghost" onPress={() => void handleUnlink(row.address)} />}
                last={index === wallets.length - 1}
              />
            ))
          )}
        </Card>
      </View>

      <CirclesSection circles={circles.data?.circles ?? []} myId={me.data?.profile.id} />

      <View>
        <SectionHeader title="App" />
        <Card style={styles.list}>
          <ListRow
            leading={<IconPlate name={mode === 'dark' ? 'moon' : 'sun'} tone="sun" />}
            title="Appearance"
            subtitle={mode === 'dark' ? 'Dark' : 'Light'}
            trailing={
              <Button label={`Use ${mode === 'dark' ? 'light' : 'dark'}`} variant="secondary" onPress={toggleTheme} />
            }
          />
          <ListRow
            leading={<IconPlate name="info" tone="neutral" />}
            title="Terms of use"
            onPress={() => void WebBrowser.openBrowserAsync(AppConfig.termsUrl)}
          />
          <ListRow
            leading={<IconPlate name="lock" tone="neutral" />}
            title="Privacy policy"
            onPress={() => void WebBrowser.openBrowserAsync(AppConfig.privacyUrl)}
            last
          />
        </Card>
      </View>

      <View style={styles.exits}>
        {canSignOut ? (
          <Button
            label={signOut.isPending ? 'Signing out…' : 'Sign out'}
            icon="logOut"
            variant="secondary"
            disabled={signOut.isPending}
            onPress={() => void handleSignOut()}
          />
        ) : (
          <T role="caption" center color={colors.inkMuted}>
            Signing out needs a linked wallet — without one there would be no way back into this account.
          </T>
        )}
        <Button
          label={deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
          variant="ghost"
          tone="coral"
          disabled={deleteAccount.isPending}
          onPress={() => void handleDelete()}
        />
        <T role="caption" center color={colors.inkMuted}>
          KEPT {Constants.expoConfig?.version ?? ''}
        </T>
      </View>
    </Screen>
  )
}

/** What the circle calls you — the one thing about you they see besides the ring. */
function NameCard({ current }: { current: string }) {
  const styles = useStyles()
  const { colors } = useAppTheme()
  const rename = useRename()
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? current
  const trimmed = value.trim()
  const changed = draft !== null && trimmed !== current
  const valid = trimmed.length >= 2 && trimmed.length <= 40

  return (
    <View>
      <SectionHeader title="Name" />
      <Card style={styles.nameCard}>
        <TextInput
          value={value}
          onChangeText={setDraft}
          maxLength={40}
          autoCapitalize="words"
          autoComplete="name"
          accessibilityLabel="Your name, as your circle sees it"
          style={[type.body, styles.nameInput, { color: colors.ink }]}
        />
        <Button
          label={rename.isPending ? 'Saving…' : 'Save'}
          variant="secondary"
          disabled={!changed || !valid || rename.isPending}
          onPress={() =>
            rename.mutate(trimmed, {
              onSuccess: () => setDraft(null),
              onError: (error) =>
                Alert.alert('Not saved', error instanceof Error ? error.message : 'Please try again.'),
            })
          }
        />
      </Card>
      <T role="caption" color={colors.inkMuted} style={styles.hint}>
        Your circle sees this and your ring. Never an amount.
      </T>
    </View>
  )
}

function CirclesSection({ circles, myId }: { circles: CircleSummary[]; myId?: string }) {
  const styles = useStyles()
  if (!circles.length || !myId) return null
  return (
    <View>
      <SectionHeader title="Circles" />
      <Card style={styles.list}>
        {circles.map((circle, index) => (
          <CircleRow key={circle.id} circle={circle} myId={myId} last={index === circles.length - 1} />
        ))}
      </Card>
    </View>
  )
}

function CircleRow({ circle, myId, last }: { circle: CircleSummary; myId: string; last: boolean }) {
  const leave = useRemoveFromCircle(circle.id)
  const alone = Number(circle.member_count) <= 1
  const owner = circle.role === 'owner'

  const handleLeave = async () => {
    const ok = await confirmAsync({
      title: `Leave ${circle.name}?`,
      message: alone
        ? 'You are the only member, so the circle and its feed will be deleted.'
        : owner
          ? 'The circle passes to its longest-standing member. Your posts leave with you.'
          : 'Your posts leave with you. You can rejoin with a new invite.',
      confirmLabel: 'Leave',
      destructive: true,
    })
    if (!ok) return
    leave.mutate(myId, {
      onError: (error) => Alert.alert('Could not leave', error instanceof Error ? error.message : 'Please try again.'),
    })
  }

  return (
    <ListRow
      leading={<IconPlate name="people" tone="coral" />}
      title={circle.name}
      subtitle={`${circle.member_count} ${Number(circle.member_count) === 1 ? 'member' : 'members'}${owner ? ' · you own it' : ''}`}
      trailing={<Button label="Leave" variant="ghost" disabled={leave.isPending} onPress={() => void handleLeave()} />}
      last={last}
    />
  )
}

const useStyles = makeThemedStyles(() =>
  StyleSheet.create({
    header: { gap: space[3], alignItems: 'center' },
    headerCopy: { flex: 1, gap: 2 },
    list: { paddingVertical: 0, paddingHorizontal: space[4] },
    exits: { gap: space[3], paddingTop: space[2], paddingBottom: space[8] },
    nameCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
    nameInput: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: radii.md },
    hint: { marginTop: space[2], paddingHorizontal: space[2] },
  }),
)
