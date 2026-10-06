/**
 * The account's lifecycle: getting back in, and getting out.
 *
 * Every account starts anonymous, and for a long time the session token in the
 * keychain was the only thing that knew who you were — a reinstall or a new phone
 * lost the account for good. The wallet is now the way back in
 * (`backend/src/wallet-sign-in.ts`), and this is the client half of it, next to
 * the ways out: sign out, unlink, leave, delete.
 */

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiClientError, apiRequest } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { resetOnboarding } from '@/features/onboarding/onboarding-state'

/** A challenge the wallet has signed, usable once for linking OR signing in. */
export type SignedChallenge = { challengeId: string; signature: string }

export class WalletNotLinkedError extends Error {}

/**
 * Switch this device to the account the signed wallet belongs to.
 *
 * Goes through `authClient.$fetch`, not `apiRequest`, because it is a Better
 * Auth endpoint that answers with a new session cookie — and only the auth
 * client's Expo plugin stores that cookie and tells `useSession` it changed.
 */
export async function signInWithWallet(signed: SignedChallenge, client: QueryClient) {
  const { error } = await authClient.$fetch('/sign-in/wallet', {
    method: 'POST',
    body: signed,
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'wallet_not_linked') throw new WalletNotLinkedError(error.message)
    throw new ApiClientError(error.message ?? 'Could not sign in with that wallet.', error.status, code)
  }
  // Everything cached belongs to the account this device just left.
  client.clear()
}

/**
 * Sign out and start over with a fresh anonymous account.
 *
 * `SessionBootstrap` signs the new one in as soon as the old session is gone,
 * so the app is never left without one.
 */
async function leaveThisDevice(client: QueryClient) {
  await authClient.signOut().catch(() => undefined)
  await resetOnboarding()
  client.clear()
}

export function useSignOut() {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => leaveThisDevice(client) })
}

export function useDeleteAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiRequest('/v1/me', { method: 'DELETE' })
      await leaveThisDevice(client)
    },
  })
}

export function useUnlinkWallet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (address: string) => apiRequest(`/v1/wallets/${address}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['me'] }),
  })
}

/** Leave a circle (your own id) or, as its owner, remove someone from it. */
export function useRemoveFromCircle(circleId?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      apiRequest<{ left: boolean; circleDeleted: boolean }>(`/v1/circles/${circleId}/members/${memberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['circles'] })
      client.invalidateQueries({ queryKey: ['circle', circleId] })
      client.invalidateQueries({ queryKey: ['circle-feed', circleId] })
    },
  })
}

export function useRename() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (displayName: string) =>
      apiRequest('/v1/me', { method: 'PATCH', body: JSON.stringify({ displayName }) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['me'] })
      // Circle rows and feed entries carry the name too.
      client.invalidateQueries({ queryKey: ['circle'] })
      client.invalidateQueries({ queryKey: ['circle-feed'] })
    },
  })
}

export function useAcceptTerms() {
  const client = useQueryClient()
  return useMutation({
    /*
     * `crypto` confirms only what buying crypto needs; `all` confirms the fuller statement
     * stocks and private markets need too (backend/src/lib/terms.ts).
     */
    mutationFn: ({ version, scope }: { version: number; scope: 'crypto' | 'all' }) =>
      apiRequest('/v1/me/terms', {
        method: 'POST',
        body: JSON.stringify(
          scope === 'crypto'
            ? { version, acceptTerms: true, notCryptoRestricted: true }
            : { version, acceptTerms: true, notRestricted: true },
        ),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['me'] }),
  })
}
