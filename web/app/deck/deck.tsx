'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Rings } from '@/components/rings'
import styles from './deck.module.css'

/* ── Parts ─────────────────────────────────────────────────────────────────────────── */

function Phone({ shot, alt, size = 'md' }: { shot: string; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <figure className={`${styles.phone} ${styles[size]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static export, and these are already sized */}
      <img src={`/deck/shots/${shot}.jpg`} alt={alt} />
    </figure>
  )
}

function Slide({
  children,
  tone = 'cream',
  className,
}: {
  children: ReactNode
  tone?: 'cream' | 'ink'
  className?: string
}) {
  return (
    <section className={`${styles.slide} ${tone === 'ink' ? styles.ink : ''} ${className ?? ''}`}>
      {children}
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>
}

/** One block of the architecture diagram. */
function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.box}>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

/** The two-headed arrow between the diagram's columns, and what travels along it. */
function Arrow({ labels }: { labels: string[] }) {
  return (
    <div className={styles.archLink} aria-hidden>
      <svg width="64" height="18" viewBox="0 0 64 18">
        <path d="M12 9h40" strokeWidth="2.5" />
        <path d="M2 9l11-7v14zM62 9l-11-7v14z" />
      </svg>
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  )
}

/** A code panel. JSON keys are dimmed so the values — what actually travels — read first. */
function Code({ label, children }: { label: ReactNode; children: string }) {
  return (
    <figure className={styles.code}>
      <figcaption>{label}</figcaption>
      <pre>
        {children.split('\n').map((line, i) => {
          const key = /^(\s*)("[^"]+":)(.*)$/.exec(line)
          return (
            <span key={i}>
              {key ? (
                <>
                  {key[1]}
                  <span className={styles.codeKey}>{key[2]}</span>
                  {key[3]}
                </>
              ) : (
                line
              )}
              {'\n'}
            </span>
          )
        })}
      </pre>
    </figure>
  )
}

type Lane = 'phone' | 'worker' | 'chain' | 'circle'

const LANES: Record<Lane, { label: string; className: string | undefined }> = {
  phone: { label: 'Phone', className: styles.lanePhone },
  worker: { label: 'KEPT Worker', className: styles.laneWorker },
  chain: { label: 'Jupiter · Solana', className: styles.laneChain },
  circle: { label: 'Your circle', className: styles.laneCircle },
}

/** One purchase, as the backend runs it (backend/src/routes/trades.ts and src/jobs.ts). */
const PURCHASE: { lane: Lane; title: string; detail: string; code: string }[] = [
  {
    lane: 'worker',
    title: 'Check, then quote',
    detail:
      'Is the wallet proven yours, the asset listed, the terms accepted? Only then does Jupiter build the swap.',
    code: 'POST /v1/trades/order',
  },
  {
    lane: 'phone',
    title: 'Sign',
    detail: 'Mobile Wallet Adapter hands the swap to Seed Vault or Phantom. The key never leaves the wallet.',
    code: 'signTransactions()',
  },
  {
    lane: 'chain',
    title: 'Land',
    detail: 'Jupiter lands it on mainnet. KEPT records the purchase as pending and queues a check.',
    code: 'POST /v1/trades/execute',
  },
  {
    lane: 'worker',
    title: 'Verify',
    detail:
      'Read back from the chain: it succeeded, your linked wallet signed it, and its balance of that asset went up.',
    code: 'getTransaction',
  },
  {
    lane: 'worker',
    title: 'Settle, once',
    detail: 'One conditional write marks it verified, so a retry can never count it twice. The week is kept.',
    code: "WHERE status = 'pending'",
  },
  {
    lane: 'circle',
    title: 'Noticed',
    detail: 'A post in each of your circles, pushed live through the circle’s own room. No amount in it.',
    code: 'Durable Object → post.created',
  },
]

/* ── The slides ────────────────────────────────────────────────────────────────────── */

const SLIDES: ReactNode[] = [
  // 1 · Title
  <Slide key="title" tone="ink" className={styles.title}>
    <div className={styles.titleRings}>
      <Rings size={520} promise={1} goal={0.75} circle={0.6} mode="dark" label="The three KEPT rings" />
    </div>
    <div className={styles.titleCopy}>
      <h1 className={styles.wordmark}>KEPT</h1>
      <p className={styles.titleLine}>
        Promises <em className="serif">compound.</em>
      </p>
      <p className={styles.titleSub}>Invest a little every week, with people who notice.</p>
    </div>
    <p className={styles.titleFoot}>Android beta · live on Solana mainnet · kept-seeker.pages.dev</p>
  </Slide>,

  // 2 · Problem
  <Slide key="problem" tone="ink">
    <Eyebrow>The problem</Eyebrow>
    <h2 className={styles.huge}>
      “I’ll start investing
      <br />
      next <em className="serif">week.</em>”
    </h2>
    <div className={styles.threeUp}>
      <div>
        <h3>Nothing happens when you skip</h3>
        <p>Every habit worth building has someone who notices you didn’t. Investing has no one.</p>
      </div>
      <div>
        <h3>Apps score the wrong thing</h3>
        <p>
          A balance you didn’t move, at the top of the screen. What you control — putting money in — appears
          nowhere.
        </p>
      </div>
      <div>
        <h3>Social means exposure</h3>
        <p>
          Leaderboards and shared portfolios ask you to show friends your net worth. People sensibly decline.
        </p>
      </div>
    </div>
  </Slide>,

  // 3 · Insight
  <Slide key="insight">
    <div className={styles.split}>
      <div>
        <Eyebrow>The insight</Eyebrow>
        <h2 className={styles.big}>
          Habits stick when someone <em className="serif">notices.</em>
        </h2>
        <p className={styles.lead}>
          Activity rings made exercise visible and shareable. KEPT does the same for investing — and shares the
          progress, never the money.
        </p>
      </div>
      <div className={styles.center}>
        <Rings size={440} promise={1} goal={0.62} circle={0.75} label="Promise, goal and circle rings" />
      </div>
    </div>
  </Slide>,

  // 4 · Product
  <Slide key="product">
    <div className={styles.split}>
      <div>
        <Eyebrow>The product</Eyebrow>
        <h2 className={styles.big}>
          One small promise, <em className="serif">kept</em> every week.
        </h2>
        <ol className={styles.steps}>
          <li>
            <span>
              <b>Promise</b> an amount and a day — <i>$25, every Friday.</i>
            </span>
          </li>
          <li>
            <span>
              <b>Keep it</b> by buying a real asset from your own wallet.
            </span>
          </li>
          <li>
            <span>
              <b>Your circle sees</b> that you kept it. Never how much.
            </span>
          </li>
        </ol>
      </div>
      <div className={styles.center}>
        <Phone shot="home" alt="The KEPT home screen: three rings, an eight-week streak" size="lg" />
      </div>
    </div>
  </Slide>,

  // 5 · The rings
  <Slide key="rings">
    <Eyebrow>The rings</Eyebrow>
    <h2 className={styles.big}>Three questions, one glance.</h2>
    <div className={styles.ringRow}>
      <div className={styles.ringCard}>
        <Rings size={220} promise={1} label="The promise ring, filled" />
        <h3 className={styles.kiwi}>Promise</h3>
        <p>
          Did you keep this week? Fills when you do — and empties every Monday, so there is always one small
          thing to finish.
        </p>
      </div>
      <div className={styles.ringCard}>
        <Rings size={220} goal={0.75} label="The goal ring, three-quarters" />
        <h3 className={styles.grape}>Goal</h3>
        <p>How far along your goal you are — twelve weeks of showing up, a year, whatever you chose.</p>
      </div>
      <div className={styles.ringCard}>
        <Rings size={220} circle={0.75} label="The circle ring, three of four" />
        <h3 className={styles.coral}>Circle</h3>
        <p>
          How many of your people kept theirs. Nothing makes you open your wallet like watching a friend do it
          first.
        </p>
      </div>
    </div>
  </Slide>,

  // 6 · The loop
  <Slide key="loop">
    <Eyebrow>How it works</Eyebrow>
    <h2 className={styles.big}>From promise to noticed, in about a minute.</h2>
    <div className={styles.loop}>
      <div>
        <Phone shot="onboarding-promise" alt="Choosing $25 every Friday" size="sm" />
        <p>
          <b>1 · Promise.</b> An amount and a day.
        </p>
      </div>
      <div>
        <Phone shot="asset" alt="The S&P 500 page with a price chart" size="sm" />
        <p>
          <b>2 · Invest.</b> Pick a real asset.
        </p>
      </div>
      <div>
        <Phone shot="kept" alt="That’s in: $25 of SPYx" size="sm" />
        <p>
          <b>3 · Kept.</b> Approve in your wallet.
        </p>
      </div>
      <div>
        <Phone shot="circle-kept" alt="The circle: three of four kept this week" size="sm" />
        <p>
          <b>4 · Noticed.</b> Your circle sees it, live.
        </p>
      </div>
    </div>
  </Slide>,

  // 7 · Privacy
  <Slide key="privacy">
    <div className={styles.split}>
      <div>
        <Eyebrow>Privacy</Eyebrow>
        <h2 className={styles.big}>
          They see the ring. <em className="serif">Never the number.</em>
        </h2>
        <div className={styles.seeGrid}>
          <div>
            <h3 className={styles.kiwi}>Your circle sees</h3>
            <p>Your name · that you kept this week · your streak · your awards · your goal ring, as a shape</p>
          </div>
          <div>
            <h3 className={styles.coral}>Nobody sees</h3>
            <p>How much you promised · what you bought · what it’s worth · your balance or holdings</p>
          </div>
        </div>
        <p className={styles.note}>
          Not hidden by default — a friend’s app has no way to ask for those numbers. So a student putting in
          $10 and a friend putting in $500 have identical rings, and keep each other going as equals.
        </p>
      </div>
      <div className={styles.center}>
        <Phone shot="circle" alt="A private circle: who kept their week, and their cheers" size="lg" />
      </div>
    </div>
  </Slide>,

  // 8 · Real assets
  <Slide key="assets">
    <div className={styles.split}>
      <div>
        <Eyebrow>Real assets</Eyebrow>
        <h2 className={styles.big}>
          A real position, in <em className="serif">your</em> wallet.
        </h2>
        <ul className={styles.bullets}>
          <li>
            <b>Crypto first,</b> new for Seeker: SOL, bitcoin as Coinbase’s cbBTC, and SKR, Solana Mobile’s own.
          </li>
          <li>
            <b>1,100+ tokenized stocks and ETFs</b> through xStocks — the S&amp;P 500, Nvidia, Tesla, gold —
            priced live.
          </li>
          <li>
            <b>Fractional,</b> so $20 buys a real slice. Routed by Jupiter, approved in your own wallet.
          </li>
          <li>
            <b>Yours to leave with.</b> KEPT never holds funds or keys; sell back to USDC any time.
          </li>
        </ul>
        <p className={styles.small}>Buying is not available to U.S. persons or in restricted countries.</p>
      </div>
      <div className={styles.twoPhones}>
        <Phone shot="invest" alt="The Invest screen: portfolio and markets" size="md" />
        <Phone shot="purchase" alt="Buying $25 of SPYx at a live quote" size="md" />
      </div>
    </div>
  </Slide>,

  // 9 · Verified
  <Slide key="verified">
    <div className={styles.split}>
      <div>
        <Eyebrow>Verified, not self-reported</Eyebrow>
        <h2 className={styles.big}>
          The streak is <em className="serif">real.</em>
        </h2>
        <p className={styles.lead}>
          A habit app with a checkbox is a to-do list. KEPT fills your ring only once the purchase is confirmed
          on Solana, from a wallet you’ve proven is yours.
        </p>
        <div className={styles.flow}>
          <span>You approve in your wallet</span>
          <span>→</span>
          <span>KEPT reads the transaction on-chain</span>
          <span>→</span>
          <span>Ring fills · circle notified</span>
        </div>
      </div>
      <div className={styles.center}>
        <Phone shot="kept-verified" alt="Verified on-chain: your SPYx purchase settled, week kept" size="md" />
      </div>
    </div>
  </Slide>,

  // 10 · The week, kept
  <Slide key="before-after">
    <Eyebrow>The moment</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>The ring closes. The week is kept.</h2>
    <div className={styles.beforeAfter}>
      <div>
        <Phone shot="home" alt="Before: promise open" size="sm" />
        <p>Before · promise open, 8 weeks</p>
      </div>
      <span className={styles.arrow}>→</span>
      <div>
        <Phone shot="home-kept" alt="After: promise kept, 9 weeks" size="sm" />
        <p>After · kept, 9 weeks, amount private</p>
      </div>
    </div>
  </Slide>,

  // 11 · Coming back
  <Slide key="retention">
    <div className={styles.split}>
      <div>
        <Eyebrow>Why people come back</Eyebrow>
        <h2 className={styles.big}>Built for the six days in between.</h2>
        <ul className={styles.bullets}>
          <li>
            <b>A streak that forgives.</b> Perfect months alongside it, so a missed week never ends the story.
            No red, no guilt screens.
          </li>
          <li>
            <b>Twelve awards, none for being rich.</b> Half are earned through other people.
          </li>
          <li>
            <b>Nudges.</b> One per friend per week, only into an open week.
          </li>
          <li>
            <b>Cheers, not comments.</b> 👏 💜 🔥 🙌 — no advice, no pressure.
          </li>
          <li>
            <b>A home-screen widget</b> with your rings — progress, never money.
          </li>
        </ul>
      </div>
      <div className={styles.center}>
        <Phone shot="awards" alt="Awards: perfect month, first promise, steady eight" size="lg" />
      </div>
    </div>
  </Slide>,

  // 12 · Who & where
  <Slide key="status">
    <Eyebrow>Who it’s for · where it is</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      For people who’ve meant to start <em className="serif">for years.</em>
    </h2>
    <div className={styles.twoCol}>
      <div>
        <h3>Who</h3>
        <ul className={styles.bullets}>
          <li>Anyone whose plan is “a bit, regularly, forever” — and keeps failing at regularly.</li>
          <li>
            Friend pairs, couples, siblings: two to five people who trust each other, but not with their
            balance.
          </li>
          <li>Solana Seeker owners, with the wallet already on the phone.</li>
        </ul>
      </div>
      <div>
        <h3>Today</h3>
        <ul className={styles.bullets}>
          <li>
            <b>Live on Solana mainnet</b> — real money, real assets.
          </li>
          <li>
            <b>Android 1.1.0, the Seeker edition</b>, from kept-seeker.pages.dev.
          </li>
          <li>
            <b>Production API</b> on Cloudflare, reading every purchase back from the chain.
          </li>
        </ul>
      </div>
    </div>
  </Slide>,

  // 13 · Solana
  <Slide key="solana" tone="ink">
    <Eyebrow>Built on Solana, for Solana Mobile</Eyebrow>
    <h2 className={styles.big}>
      Two things only the chain <em className="serif">does.</em>
    </h2>
    <div className={styles.threeUp}>
      <div>
        <h3>Ownership without custody</h3>
        <p>
          Every holding sits in your own wallet. A group habit needs no group wallet — you can leave and lose
          nothing.
        </p>
      </div>
      <div>
        <h3>Proof, not a claim</h3>
        <p>
          “I invested this week” becomes something the app can check, which is what everything social rests on.
        </p>
      </div>
      <div>
        <h3>Two taps on a Seeker</h3>
        <p>
          Wallet already on the phone. Mobile Wallet Adapter with Seed Vault, Phantom or Solflare; your account
          follows your wallet.
        </p>
      </div>
    </div>
    <p className={styles.stack}>
      Expo · Android · Cloudflare Workers, D1, Queues, Durable Objects · Jupiter · xStocks · Solana mainnet
    </p>
  </Slide>,

  /* ── Under the hood. Every figure here is read from backend/, not from a plan. ── */

  // 14 · Architecture
  <Slide key="architecture" className={styles.tech}>
    <Eyebrow>Under the hood · Architecture</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      The whole backend is one <em className="serif">Worker.</em>
    </h2>
    <div className={styles.arch}>
      <div className={styles.archCol}>
        <p className={styles.archHead}>On the phone</p>
        <Box title="The KEPT app">
          Expo SDK 55, React Native 0.83. Rings drawn in Skia, data through TanStack Query.
        </Box>
        <Box title="Your wallet">
          Seed Vault, Phantom or Solflare, over Mobile Wallet Adapter. It signs; KEPT never holds a key.
        </Box>
        <Box title="Home-screen widget">Native Android, in Kotlin. Rings only — never money.</Box>
      </div>
      <Arrow labels={['HTTPS', 'WebSocket']} />
      <div className={`${styles.archCol} ${styles.archCore}`}>
        <p className={styles.archHead}>KEPT on Cloudflare</p>
        <Box title="API · Hono on Workers">43 routes, every body checked by Zod. Sessions by Better Auth.</Box>
        <Box title="D1 · SQLite">
          19 tables, 11 migrations: goals, weekly promises, circles, orders, purchases.
        </Box>
        <Box title="Queues">Purchase checks, push and backfills, retried up to ten times with backoff.</Box>
        <Box title="Durable Objects">A live WebSocket room per circle. Exact rate-limit counters.</Box>
        <Box title="One cron, every five minutes">
          Re-checks stuck purchases. At 01:15 UTC it opens the week’s promises and sends reminders.
        </Box>
      </div>
      <Arrow labels={['REST', 'JSON-RPC']} />
      <div className={styles.archCol}>
        <p className={styles.archHead}>Solana &amp; partners</p>
        <Box title="Jupiter">Swap orders and execution, live prices, charts.</Box>
        <Box title="xStocks">1,100+ tokenized stocks and ETFs. The catalogue is cached for an hour.</Box>
        <Box title="Crypto">
          SOL, cbBTC and SKR. SOL arrives as lamports, so it is verified from the wallet’s balance.
        </Box>
        <Box title="Solana RPC">Mainnet, through a private endpoint. The source of truth.</Box>
        <Box title="Expo Push">Reminders and nudges, through FCM.</Box>
      </div>
    </div>
  </Slide>,

  // 15 · A purchase, end to end
  <Slide key="purchase" className={styles.tech}>
    <Eyebrow>Under the hood · One purchase</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      From tap to <em className="serif">kept.</em>
    </h2>
    <ol className={styles.purchase}>
      {PURCHASE.map((step, i) => (
        <li key={step.title} className={styles.step}>
          <div className={styles.stepTop}>
            <span className={styles.stepNo}>{i + 1}</span>
            <span className={`${styles.lane} ${LANES[step.lane].className}`}>{LANES[step.lane].label}</span>
          </div>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
          <code>{step.code}</code>
        </li>
      ))}
    </ol>
    <div className={styles.safety}>
      <h3>If anything stalls</h3>
      <p>A failed check retries up to ten times, backing off.</p>
      <p>Every five minutes, anything pending over two minutes is checked again.</p>
      <p>Unseen after ten minutes, it is rejected. Nothing counted, nothing posted.</p>
    </div>
  </Slide>,

  // 16 · Privacy, enforced
  <Slide key="private-by-construction" tone="ink" className={styles.tech}>
    <div className={styles.split}>
      <div>
        <Eyebrow>Under the hood · Privacy</Eyebrow>
        <h2 className={styles.big}>
          Private by <em className="serif">construction.</em>
        </h2>
        <ul className={`${styles.bullets} ${styles.onInk}`}>
          <li>
            <b>No field to leak.</b> The circle queries never select an amount, an asset or a balance. Every
            route that returns money answers only to your own session.
          </li>
          <li>
            <b>Members only.</b> Every circle route checks membership first. A stranger gets a 403 on the
            circle, its feed and its live room, and a test proves it.
          </li>
          <li>
            <b>Invites nobody can guess.</b> 72-bit tokens, stored only as SHA-256 hashes, gone after 72 hours.
          </li>
          <li>
            <b>Live rooms by ticket.</b> HMAC-signed, bound to one circle, valid for 60 seconds.
          </li>
        </ul>
      </div>
      <div className={styles.codeStack}>
        <Code label="What a friend’s app receives about you · GET /v1/circles/:id">
          {`{
  "id": "…",
  "displayName": "Priya Raman",
  "avatarUrl": null,
  "privacyMode": "progress_only",
  "role": "member",
  "showedUp": true,
  "goalProgress": 0.62
}`}
        </Code>
        <Code label="What your circle’s feed carries · GET /v1/circles/:id/feed">
          {`{
  "kind": "promise_kept",
  "body": "Kept this week’s promise",
  "reactions": "👏:…,🔥:…"
}`}
        </Code>
      </div>
    </div>
  </Slide>,

  // 17 · Identity
  <Slide key="identity" className={styles.tech}>
    <div className={styles.split}>
      <div>
        <Eyebrow>Under the hood · Identity</Eyebrow>
        <h2 className={styles.big}>
          Your wallet is your <em className="serif">account.</em>
        </h2>
        <ol className={styles.steps}>
          <li>
            <span>
              <b>Start anonymous.</b> Open the app and you have an account. No email, no password. Sessions last
              a year, so a skipped week never signs you out.
            </span>
          </li>
          <li>
            <span>
              <b>Prove your wallet.</b> Sign one message that cannot move funds. Only a proven wallet can buy,
              and it belongs to one account.
            </span>
          </li>
          <li>
            <span>
              <b>Come back on any phone.</b> Sign again and your account, circles and streak are back. An empty
              account left behind is deleted.
            </span>
          </li>
        </ol>
      </div>
      <div className={styles.center}>
        <figure className={styles.signCard}>
          <figcaption>What your wallet is asked to sign</figcaption>
          <pre>{`Use this wallet with KEPT.

Wallet: 7Xq3…mP4v
Challenge: challenge_3f9c…
Expires: 2026-09-24T18:05:00Z

This signature does not authorize a transaction.`}</pre>
          <p>Checked with ed25519 on the Worker · single use · expires in five minutes</p>
        </figure>
      </div>
    </div>
  </Slide>,

  // 18 · Reliability and security
  <Slide key="reliability" tone="ink" className={styles.tech}>
    <Eyebrow>Under the hood · Reliability and security</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      Careful where money <em className="serif">moves.</em>
    </h2>
    <div className={styles.sixUp}>
      <div>
        <h3>Counted exactly once</h3>
        <p>Settling is a conditional write. Two workers checking the same purchase cannot both post it.</p>
      </div>
      <div>
        <h3>The chain is the ledger</h3>
        <p>Holdings are the balance change read from the transaction, not the router’s estimate.</p>
      </div>
      <div>
        <h3>Never stuck at pending</h3>
        <p>Retries, a five-minute sweep, and a hard stop: unseen after ten minutes means it never landed.</p>
      </div>
      <div>
        <h3>Limits that limit</h3>
        <p>
          A Durable Object per key counts exactly: 20 sign-ins a minute per address, 30 quotes per user.
          Cloudflare’s own binding was tried first, and never said no.
        </p>
      </div>
      <div>
        <h3>Fails closed</h3>
        <p>Without a strong signing secret, every route but the health check answers 503.</p>
      </div>
      <div>
        <h3>Always a way out</h3>
        <p>
          Selling never waits on the terms. Unlink a wallet, leave a circle or delete the account, in the app.
        </p>
      </div>
    </div>
    <p className={styles.stack}>
      42 API tests in the Workers runtime · CI on the app, the API and the site · 43 routes · 19 tables · 11
      migrations · one cron
    </p>
  </Slide>,

  // 19 · What’s next
  <Slide key="roadmap">
    <Eyebrow>What’s next</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      From beta to <em className="serif">everyone.</em>
    </h2>
    <div className={styles.roadmap}>
      <div>
        <p className={styles.when}>Now</p>
        <h3>Launch</h3>
        <ul className={styles.bullets}>
          <li>
            <b>The Solana dApp Store</b> listing.
          </li>
          <li>
            <b>Push reminders on:</b> built and tested, switching on for the dApp Store release.
          </li>
          <li>
            <b>A real-money pass on a Seeker:</b> buy, verify, sell, reinstall.
          </li>
          <li>
            <b>A legal review</b> of the terms and the restricted countries.
          </li>
        </ul>
      </div>
      <div>
        <p className={styles.when}>Next</p>
        <h3>More worth keeping</h3>
        <ul className={styles.bullets}>
          <li>
            <b>Share more, if you choose:</b> amounts or holdings, for a circle you trust completely. Already in
            the schema, off by default.
          </li>
          <li>
            <b>Cash out to a bank:</b> USDC to spendable money, through an off-ramp partner.
          </li>
        </ul>
      </div>
      <div>
        <p className={styles.when}>Later</p>
        <h3>Wider</h3>
        <ul className={styles.bullets}>
          <li>
            <b>iOS.</b> The API is ready; connecting a wallet there is what’s left to build.
          </li>
          <li>
            <b>Circle streaks:</b> weeks the whole circle keeps together. Still never an amount.
          </li>
          <li>
            <b>More countries,</b> as the issuers allow them.
          </li>
        </ul>
      </div>
    </div>
  </Slide>,

  // 20 · Close
  <Slide key="close" tone="ink" className={styles.close}>
    <p className={styles.closeLine}>
      Most investing apps ask what you’re worth.
      <br />
      This one asks whether you <em className="serif">showed up.</em>
    </p>
    <div className={styles.closeMark}>
      <Rings size={180} promise={1} goal={1} circle={1} mode="dark" label="" />
      <div>
        <p className={styles.closeWord}>KEPT</p>
        <p className={styles.closeSub}>kept-seeker.pages.dev · github.com/lazydevpro/kept-seeker</p>
      </div>
    </div>
  </Slide>,
]

/* ── The deck ──────────────────────────────────────────────────────────────────────── */

export function Deck() {
  const [index, setIndex] = useState(0)
  const [scale, setScale] = useState(1)

  const go = useCallback((step: number) => {
    setIndex((current) => Math.min(SLIDES.length - 1, Math.max(0, current + step)))
  }, [])

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    fit()
    window.addEventListener('resize', fit)
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) go(1)
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) go(-1)
      if (event.key === 'Home') setIndex(0)
      if (event.key === 'End') setIndex(SLIDES.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('keydown', onKey)
    }
  }, [go])

  return (
    <div className={styles.stage} onClick={() => go(1)}>
      <div className={styles.screen} style={{ ['--scale' as string]: scale }}>
        {SLIDES.map((slide, i) => (
          <div key={i} className={styles.frame} data-active={i === index}>
            {slide}
          </div>
        ))}
      </div>
      <p className={styles.counter}>
        {index + 1} / {SLIDES.length}
      </p>
    </div>
  )
}
