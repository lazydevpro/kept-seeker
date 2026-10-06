/**
 * `POST /api/contact` — the one piece of server behaviour on an otherwise static site.
 *
 * A Cloudflare Pages Function, which Pages builds into its own Worker and serves alongside
 * `out/`. The rest of the site stays a static export; this route exists for exactly one
 * reason, and it is a security one.
 *
 * ── Why the page does not call Discord directly ──
 *
 * A Discord webhook URL *is* the credential. Anyone holding it can post to the channel as
 * often as they like, and there is no second factor to add. Fetching Discord from the browser
 * would ship that URL inside the JavaScript bundle, where it is one "view source" away from
 * being permanent spam — and rotating it means redeploying the site. Keeping the call here
 * means the secret lives in Pages, never in the bundle and never in git.
 *
 * Set it once, and never through a file:
 *
 *   npx wrangler pages secret put DISCORD_WEBHOOK_URL
 *
 * With the secret unset the route answers 503 and the form says so plainly, which is the
 * right behaviour for a preview deploy that has no channel to post into.
 */

/** The slice of Workers KV this route uses. */
interface CounterStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>
}

/** The slice of the Pages Functions context this route uses. */
interface Env {
  DISCORD_WEBHOOK_URL?: string
  /** Per-address send counts. Bound in wrangler.jsonc; unbound, the limit is skipped. */
  CONTACT_LIMITS?: CounterStore
}

/**
 * Five messages per address, in a window that restarts with each one. Enough for anyone
 * having a real conversation; a script is out of room after the fifth.
 *
 * KV is eventually consistent, so a burst fired in the same second from several locations
 * can slip a few past — fine for keeping a Discord channel usable, which is the whole job.
 * The honeypot and the length caps still run first.
 */
const SEND_LIMIT = 5
const SEND_WINDOW_SECONDS = 10 * 60

interface RouteContext {
  request: Request
  env: Env
}

interface Submission {
  name: string
  email: string
  message: string
  /** Honeypot. A real person never sees this field, so anything in it came from a bot. */
  website?: string
}

const LIMITS = { name: 80, email: 160, message: 2000 } as const

/** Deliberately loose. The job is to catch a typo, not to adjudicate RFC 5322. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

const fail = (message: string, status: number) => json({ ok: false, error: message }, status)

/*
 * One `onRequest` rather than `onRequestPost` plus a fallback. Exporting both leaves it to
 * Pages to decide which wins for a POST, and a wrong guess there fails closed on the only
 * method that matters. Branching here is unambiguous.
 */
export const onRequest = async ({ request, env }: RouteContext): Promise<Response> => {
  if (request.method !== 'POST') return fail('Send this form with POST.', 405)

  let body: Partial<Submission>
  try {
    body = (await request.json()) as Partial<Submission>
  } catch {
    return fail('That request could not be read.', 400)
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const message = String(body.message ?? '').trim()

  /*
   * A caught bot gets a 200 and no delivery. Answering 400 would tell whoever wrote the bot
   * exactly which field gave them away, and they would simply stop filling it in.
   */
  if (String(body.website ?? '').trim()) return json({ ok: true })

  if (!name || name.length > LIMITS.name) return fail('Add your name.', 422)
  if (!EMAIL.test(email) || email.length > LIMITS.email) return fail('Check that email address.', 422)
  if (!message || message.length > LIMITS.message) {
    return fail(`Write a message, up to ${LIMITS.message} characters.`, 422)
  }

  const webhook = env.DISCORD_WEBHOOK_URL
  if (!webhook) return fail('The contact form is not configured yet. Try the GitHub link instead.', 503)

  if (env.CONTACT_LIMITS) {
    const key = `contact:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`
    const sent = Number((await env.CONTACT_LIMITS.get(key)) ?? '0')
    if (sent >= SEND_LIMIT) {
      return fail('That is a lot of messages. Give it a few minutes and try again.', 429)
    }
    await env.CONTACT_LIMITS.put(key, String(sent + 1), { expirationTtl: SEND_WINDOW_SECONDS })
  }

  const country = request.headers.get('cf-ipcountry') ?? 'unknown'

  const discord = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'KEPT — kept-seeker.pages.dev',
      /*
       * Nothing in a submission may ping anyone. Without this, a message containing
       * `@everyone` notifies the whole server — the form would be a free megaphone. Stripping
       * the text instead would be a filter to get around; `parse: []` is the server refusing
       * to resolve any mention at all, whatever the body says.
       */
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: 'New message from the landing page',
          color: 0xa3e635,
          fields: [
            { name: 'Name', value: name, inline: true },
            { name: 'Email', value: email, inline: true },
            { name: 'Country', value: country, inline: true },
            { name: 'Message', value: message },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })

  if (!discord.ok) {
    // The response body can carry the webhook path back. Log the status and nothing else.
    console.error('Discord webhook rejected the message', discord.status)
    return fail('That did not send. Try again in a moment.', 502)
  }

  return json({ ok: true })
}
