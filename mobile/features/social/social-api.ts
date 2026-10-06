import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Share } from 'react-native'
import { useEffect } from 'react'
import { apiRequest } from '@/lib/api'

export interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  privacyMode: 'progress_only' | 'amounts' | 'holdings'
}

export interface CircleSummary {
  id: string
  name: string
  description: string | null
  member_count: number
  /** Your role in it. Present on the list, not on a single circle's detail. */
  role?: 'owner' | 'member'
}

export interface CircleMember extends Profile {
  role: 'owner' | 'member'
  showedUp: boolean
  goalProgress: number
}

export interface LinkedWallet {
  id: string
  address: string
  chain: string
  verified_at: string | null
}

/** Whether this account has agreed to the current terms. See `backend/src/lib/terms.ts`. */
export interface TermsStatus {
  current: number
  /** The terms, with the statement crypto needs. */
  accepted: boolean
  /** The fuller statement stocks and private markets need. Absent from servers before terms 3. */
  securitiesAccepted?: boolean
  restrictedJurisdictions: string[]
  cryptoRestrictedJurisdictions?: string[]
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ profile: Profile; wallets: LinkedWallet[]; terms?: TermsStatus }>('/v1/me'),
    retry: 1,
  })
}

export function useCircles() {
  return useQuery({
    queryKey: ['circles'],
    queryFn: () => apiRequest<{ circles: CircleSummary[] }>('/v1/circles'),
    retry: 1,
  })
}

export function useCircle(circleId?: string) {
  return useQuery({
    queryKey: ['circle', circleId],
    queryFn: () => apiRequest<{ circle: CircleSummary; members: CircleMember[] }>(`/v1/circles/${circleId}`),
    enabled: Boolean(circleId),
  })
}

export function useCircleFeed(circleId?: string) {
  return useQuery({
    queryKey: ['circle-feed', circleId],
    queryFn: () =>
      apiRequest<{
        posts: Array<{
          id: string
          body: string | null
          display_name: string
          created_at: string
          reactions: string | null
        }>
      }>(`/v1/circles/${circleId}/feed`),
    enabled: Boolean(circleId),
  })
}

export type ReactionEmoji = '👏' | '💜' | '🔥' | '🙌'

/**
 * Reactions toggle. Adding used to be one-way, so a second tap did nothing and
 * looked like a dead button; `mine` tells the caller which direction to go.
 */
export function useToggleReaction(circleId?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, emoji, mine }: { postId: string; emoji: ReactionEmoji; mine: boolean }) => {
      if (!circleId) throw new Error('Join a circle before reacting.')
      const path = `/v1/circles/${circleId}/posts/${postId}/reactions`
      return mine
        ? apiRequest(`${path}?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' })
        : apiRequest(path, { method: 'POST', body: JSON.stringify({ emoji }) })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['circle-feed', circleId] }),
  })
}

/**
 * The feed packs reactions into one string per post — "👏:userId,🔥:otherId".
 * This unpacks it into a count per emoji plus whether it was you, which is what
 * the row actually needs.
 */
export function readReactions(packed: string | null | undefined, myId: string | undefined) {
  const tally: Record<string, { count: number; mine: boolean }> = {}
  for (const entry of (packed ?? '').split(',')) {
    if (!entry) continue
    // Split once: a user id never contains a colon, but an emoji must not be
    // rebuilt from a naive split either.
    const separator = entry.indexOf(':')
    if (separator < 0) continue
    const emoji = entry.slice(0, separator)
    const userId = entry.slice(separator + 1)
    const current = tally[emoji] ?? { count: 0, mine: false }
    tally[emoji] = { count: current.count + 1, mine: current.mine || userId === myId }
  }
  return tally
}

export function useCircleLive(circleId?: string) {
  const client = useQueryClient()
  useEffect(() => {
    if (!circleId) return
    let socket: WebSocket | undefined
    let active = true
    apiRequest<{ url: string }>(`/v1/circles/${circleId}/live-ticket`, { method: 'POST' })
      .then(({ url }) => {
        if (!active) return
        socket = new WebSocket(url)
        socket.onmessage = () => {
          client.invalidateQueries({ queryKey: ['circle', circleId] })
          client.invalidateQueries({ queryKey: ['circle-feed', circleId] })
          client.invalidateQueries({ queryKey: ['widget-snapshot'] })
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
      socket?.close()
    }
  }, [circleId, client])
}

export function useCreateCircle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      apiRequest<{ id: string }>('/v1/circles', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['circles'] }),
  })
}

/** Rename a circle. The server lets only its owner. */
export function useUpdateCircle(circleId?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { name?: string; description?: string }) =>
      apiRequest(`/v1/circles/${circleId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['circles'] })
      client.invalidateQueries({ queryKey: ['circle', circleId] })
    },
  })
}

export interface GoalSummary {
  id: string
  title: string
  target_value: number
  promise_count: number
  promises_kept: number
  visibility: 'private' | 'progress_only' | 'amounts'
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => apiRequest<{ goals: GoalSummary[] }>('/v1/goals'),
    retry: 1,
  })
}

export function useCreateStarterGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const goal = await apiRequest<{ id: string }>('/v1/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: '12 weeks of showing up',
          targetType: 'weekly_consistency',
          targetValue: 12,
          visibility: 'progress_only',
        }),
      })
      const now = new Date()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      monday.setHours(0, 0, 0, 0)
      const due = new Date(monday)
      due.setDate(due.getDate() + 6)
      due.setHours(23, 59, 59, 999)
      await apiRequest(`/v1/goals/${goal.id}/promises`, {
        method: 'POST',
        body: JSON.stringify({
          weekStart: monday.toISOString().slice(0, 10),
          dueAt: due.toISOString(),
        }),
      })
      return goal
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useShareInvite(circleId?: string) {
  return useMutation({
    mutationFn: async () => {
      if (!circleId) throw new Error('Create a circle before inviting friends.')
      const result = await apiRequest<{ invite: { deepLink: string; webUrl: string } }>(
        `/v1/circles/${circleId}/invites`,
        {
          method: 'POST',
          body: JSON.stringify({ expiresInHours: 72, maxUses: 5 }),
        },
      )
      // The one piece of copy that leaves the app and lands in someone else's messages, so
      // it gets the most care: what it is, what it costs them, what stays private, then the
      // link on its own line where every messaging app will make it tappable.
      //
      // Only the https link is sent. It is an Android App Link, so on a phone that has KEPT
      // it opens the join screen directly, and on one that does not it opens the web page
      // rather than failing silently the way a bare `keptseeker://` link would.
      await Share.share({
        title: 'Join my circle on KEPT',
        message: [
          'Join my circle on KEPT.',
          '',
          'We each invest a little every week and keep each other to it. Your circle sees that you showed up — never how much.',
          '',
          result.invite.webUrl,
        ].join('\n'),
        url: result.invite.webUrl,
      })
      return result.invite
    },
  })
}
