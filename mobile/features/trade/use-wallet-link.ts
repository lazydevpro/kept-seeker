/**
 * Connect a wallet, then prove it belongs to this account.
 *
 * Two steps that read as one: Mobile Wallet Adapter hands back an address, and a
 * signed challenge proves whoever is holding the app holds its key. The Invest
 * screen displays that state, the purchase sheet requires it, and both need the
 * same transition — so it lives here rather than being written twice.
 *
 * ── When the wallet is already someone's ──
 *
 * Usually it is the reader's own earlier account — from before a reinstall, a new
 * phone, or a session that lapsed. Linking used to stop there with "already
 * linked to an account", which left them locked out of both. Now the same signed
 * challenge can sign this device into that account instead, so the offer to
 * switch costs no second wallet prompt.
 */

import { Base64 } from 'js-base64'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@/features/demo/demo-wallet'
import { ApiClientError, apiRequest } from '@/lib/api'
import { confirmAsync } from '@/lib/confirm'
import { useMe } from '@/features/social/social-api'
import { type SignedChallenge, signInWithWallet, WalletNotLinkedError } from '@/features/account/account-api'
import { markOnboardingComplete } from '@/features/onboarding/onboarding-state'

export function useWalletLink() {
  const { account, connect, signMessages } = useWallet()
  const me = useMe()
  const client = useQueryClient()
  const [connecting, setConnecting] = useState(false)

  /** Connected is not enough — only a verified signature counts as linked. */
  const linked = Boolean(account && me.data?.wallets?.some((wallet) => wallet.address === String(account.address)))

  const signChallenge = async (address: string): Promise<SignedChallenge> => {
    const challenge = await apiRequest<{ challengeId: string; message: string }>('/v1/wallets/challenge', {
      method: 'POST',
      body: JSON.stringify({ address }),
    })
    const signed = await signMessages(new TextEncoder().encode(challenge.message))
    return { challengeId: challenge.challengeId, signature: Base64.fromUint8Array(signed) }
  }

  const link = (signed: SignedChallenge) =>
    apiRequest('/v1/wallets/verify', { method: 'POST', body: JSON.stringify(signed) })

  /** Returns true when the device switched to another account. */
  const offerSwitch = async (signed: SignedChallenge) => {
    const switching = await confirmAsync({
      title: 'This wallet already has a KEPT account',
      message:
        'It is probably yours, from before a reinstall or a new phone. Switch this device to that account? Anything set up here since will be left behind.',
      confirmLabel: 'Switch',
    })
    if (!switching) return false
    await signInWithWallet(signed, client)
    await markOnboardingComplete()
    return true
  }

  const linkWallet = async () => {
    setConnecting(true)
    try {
      if (!account) {
        await connect()
        return
      }
      const signed = await signChallenge(String(account.address))
      try {
        await link(signed)
      } catch (error) {
        if (error instanceof ApiClientError && error.code === 'wallet_linked_elsewhere') {
          await offerSwitch(signed)
          return
        }
        throw error
      }
      await me.refetch()
    } catch (error) {
      Alert.alert('Wallet link failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  /**
   * Onboarding's "I already use KEPT". Signs in to the wallet's account if it
   * has one; if not, links it to this fresh account instead — the reader asked
   * to use this wallet either way, and either way it took one signature.
   *
   * Resolves to 'restored', 'linked', or null when nothing happened.
   */
  const restoreWithWallet = async (): Promise<'restored' | 'linked' | null> => {
    setConnecting(true)
    try {
      const connected = account ?? (await connect())
      const address = String(connected.address)
      const signed = await signChallenge(address)
      try {
        await signInWithWallet(signed, client)
        await markOnboardingComplete()
        return 'restored'
      } catch (error) {
        if (!(error instanceof WalletNotLinkedError)) throw error
        await link(signed)
        await me.refetch()
        return 'linked'
      }
    } catch (error) {
      Alert.alert('Could not use that wallet', error instanceof Error ? error.message : 'Please try again.')
      return null
    } finally {
      setConnecting(false)
    }
  }

  return { account, linked, connecting, linkWallet, restoreWithWallet }
}
