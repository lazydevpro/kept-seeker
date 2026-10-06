import type { Metadata } from 'next'
import { JoinInvite } from '@/components/join-invite'

export const metadata: Metadata = {
  title: 'You’re invited — KEPT',
  description: 'A friend invited you to their KEPT circle.',
  // An invite page is one person's link, not something to find by searching.
  robots: { index: false, follow: false },
}

/**
 * Where an invite link lands when the app does not open it.
 *
 * Invites are `https://kept-seeker.pages.dev/join/<token>`. On an Android phone with KEPT
 * installed and App Links verified, the link opens the app directly and nobody sees this. Everyone
 * else — no app yet, a desktop, a link previewer — gets this page: whose circle it is, a button
 * that hands the token to the app, and a way to get the app.
 *
 * One static page serves every token: `public/_redirects` rewrites `/join/*` here, and the
 * component reads the token from the address bar. A static export cannot pre-render a page per
 * invite, and should not — invites are private and short-lived.
 */
export default function Join() {
  return <JoinInvite />
}
