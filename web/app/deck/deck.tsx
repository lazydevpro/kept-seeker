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

/* ── The slides: one idea each ─────────────────────────────────────────────────────── */

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
      <h3>Nobody notices when you skip.</h3>
      <h3>Apps show a balance you can’t control.</h3>
      <h3>Social investing means showing your money.</h3>
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
        <p className={styles.lead}>Activity rings, for investing. Friends see the progress, never the money.</p>
        <ul className={styles.legend}>
          <li>
            <b className={styles.kiwi}>Promise</b> Did you keep this week?
          </li>
          <li>
            <b className={styles.grape}>Goal</b> How far along your goal?
          </li>
          <li>
            <b className={styles.coral}>Circle</b> How many friends kept theirs?
          </li>
        </ul>
      </div>
      <div className={styles.center}>
        <Rings size={440} promise={1} goal={0.62} circle={0.75} label="Promise, goal and circle rings" />
      </div>
    </div>
  </Slide>,

  // 4 · How it works
  <Slide key="loop">
    <Eyebrow>How it works</Eyebrow>
    <h2 className={styles.big}>From promise to noticed, in a minute.</h2>
    <div className={styles.loop}>
      <div>
        <Phone shot="onboarding-promise" alt="Choosing $25 every Friday" size="sm" />
        <p>
          <b>1 · Promise</b> $25 a week
        </p>
      </div>
      <div>
        <Phone shot="asset" alt="The Solana page with a price chart" size="sm" />
        <p>
          <b>2 · Buy</b> a real asset
        </p>
      </div>
      <div>
        <Phone shot="kept" alt="That’s in: $25 of SOL" size="sm" />
        <p>
          <b>3 · Kept</b> verified on Solana
        </p>
      </div>
      <div>
        <Phone shot="circle-kept" alt="The circle: three of four kept this week" size="sm" />
        <p>
          <b>4 · Noticed</b> by your circle
        </p>
      </div>
    </div>
  </Slide>,

  // 5 · Real assets, on Solana
  <Slide key="assets">
    <div className={styles.split}>
      <div>
        <Eyebrow>Real assets, on Solana</Eyebrow>
        <h2 className={styles.big}>
          A real position, in <em className="serif">your</em> wallet.
        </h2>
        <ul className={styles.bullets}>
          <li>
            <b>Crypto first:</b> SOL, bitcoin and SKR. Plus 1,100+ tokenized stocks.
          </li>
          <li>
            <b>Yours:</b> KEPT never holds your funds or keys.
          </li>
          <li>
            <b>Proven:</b> the ring fills only when Solana confirms the buy.
          </li>
        </ul>
        <p className={styles.small}>
          Tokenized stocks are not available to U.S. persons or in the issuer’s restricted countries. Crypto is
          not available in the UK or sanctioned regions.
        </p>
      </div>
      <div className={styles.twoPhones}>
        <Phone shot="invest" alt="The Invest screen: crypto first, then stocks" size="md" />
        <Phone shot="purchase" alt="Buying $25 of SOL at a live quote" size="md" />
      </div>
    </div>
  </Slide>,

  // 6 · Privacy
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
            <p>That you kept your week · your streak · your awards</p>
          </div>
          <div>
            <h3 className={styles.coral}>Nobody sees</h3>
            <p>How much · what you bought · what it’s worth</p>
          </div>
        </div>
      </div>
      <div className={styles.center}>
        <Phone shot="circle" alt="A private circle: who kept their week, and their cheers" size="lg" />
      </div>
    </div>
  </Slide>,

  // 7 · Coming back
  <Slide key="retention">
    <div className={styles.split}>
      <div>
        <Eyebrow>Why people come back</Eyebrow>
        <h2 className={styles.big}>Built for the six days in between.</h2>
        <ul className={styles.bullets}>
          <li>
            <b>A streak that forgives</b> one missed week.
          </li>
          <li>
            <b>Awards</b> for showing up, never for being rich.
          </li>
          <li>
            <b>Nudges and cheers</b> from your circle.
          </li>
          <li>
            <b>Your rings</b> on the home screen.
          </li>
        </ul>
      </div>
      <div className={styles.center}>
        <Phone shot="awards" alt="Awards: perfect month, first promise, steady eight" size="lg" />
      </div>
    </div>
  </Slide>,

  // 8 · Market
  <Slide key="market">
    <div className={styles.split}>
      <div>
        <Eyebrow>Market</Eyebrow>
        <h2 className={styles.big}>
          Start where the wallet <em className="serif">already is.</em>
        </h2>
        <ol className={styles.tiers}>
          <li>
            <p className={styles.when}>Start</p>
            <p className={styles.tierStat}>100,900</p>
            <p>
              <b>Seeker owners,</b> wallet in the phone
            </p>
          </li>
          <li>
            <p className={styles.when}>Next</p>
            <p className={styles.tierStat}>15M</p>
            <p>
              <b>Phantom users</b> a month, on any Android
            </p>
          </li>
          <li>
            <p className={styles.when}>Then</p>
            <p className={styles.tierStat}>741M</p>
            <p>
              <b>Crypto owners</b> worldwide
            </p>
          </li>
        </ol>
        <p className={styles.source}>
          Sources: Solana Mobile, SKR airdrop (Jan 2026) · Phantom (Jan 2025) · Crypto.com (Feb 2026)
        </p>
      </div>
      <div className={styles.center}>
        <svg
          className={styles.nest}
          viewBox="0 0 640 640"
          role="img"
          aria-label="Seeker owners inside Phantom users inside crypto owners"
        >
          <circle cx="320" cy="320" r="310" className={styles.nestOuter} />
          <circle cx="320" cy="400" r="210" className={styles.nestMid} />
          <circle cx="320" cy="490" r="110" className={styles.nestInner} />
          <text x="320" y="110" textAnchor="middle">
            Crypto owners
          </text>
          <text x="320" y="270" textAnchor="middle">
            Phantom users
          </text>
          <text x="320" y="500" textAnchor="middle">
            Seeker
          </text>
        </svg>
      </div>
    </div>
  </Slide>,

  // 9 · Competition
  <Slide key="competition">
    <Eyebrow>Competition</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      Social, and still private. Nobody else is <em className="serif">both.</em>
    </h2>
    <div className={styles.compete}>
      <div className={styles.map}>
        <div className={styles.mapY}>
          <span>Shows your money</span>
          <span>Keeps it private</span>
        </div>
        <div className={styles.mapCell}>
          <b>Acorns</b>
          <b>Robinhood recurring buys</b>
          <b>Jupiter Recurring</b>
        </div>
        <div className={`${styles.mapCell} ${styles.mapKept}`}>
          <Rings size={120} promise={1} goal={1} circle={1} mode="dark" label="" />
          <b>KEPT</b>
        </div>
        <div className={styles.mapCell} />
        <div className={styles.mapCell}>
          <b>eToro</b>
          <b>Leaderboards, shared portfolios</b>
        </div>
        <div className={styles.mapX}>
          <span>On your own</span>
          <span>With friends</span>
        </div>
      </div>
      <p className={styles.lead}>
        Friends see that you showed up. Never what you have. And the assets stay in your own wallet.
      </p>
    </div>
  </Slide>,

  // 10 · Business model
  <Slide key="business">
    <div className={styles.split}>
      <div>
        <Eyebrow>Business model</Eyebrow>
        <h2 className={styles.big}>
          We earn when you <em className="serif">keep</em> your promise.
        </h2>
        <ul className={styles.bullets}>
          <li>
            <b>1% commission on every buy,</b> inside the swap. Selling is free.
          </li>
          <li>
            <b>One kept week, one commission.</b> We grow when habits do, not when people trade more.
          </li>
        </ul>
      </div>
      <div className={styles.center}>
        <figure className={styles.sum}>
          <figcaption>One person, $25 every Friday</figcaption>
          <dl>
            <div>
              <dt>Invested in a year</dt>
              <dd>$1,300</dd>
            </div>
            <div>
              <dt>Commission at 1%</dt>
              <dd>$13</dd>
            </div>
            <div className={styles.sumTotal}>
              <dt>150,000 people, 1% of Phantom’s users</dt>
              <dd>$1.95M a year</dd>
            </div>
          </dl>
          <p>An illustration of the model, not a forecast.</p>
        </figure>
      </div>
    </div>
  </Slide>,

  // 11 · Go-to-market
  <Slide key="gtm">
    <Eyebrow>Go-to-market</Eyebrow>
    <h2 className={`${styles.big} ${styles.wide}`}>
      Every promise brings a <em className="serif">friend.</em>
    </h2>
    <div className={styles.roadmap}>
      <div>
        <p className={styles.when}>First · Seeker</p>
        <h3>The dApp Store, with SKR on the shelf.</h3>
      </div>
      <div>
        <p className={styles.when}>Built in · Circles</p>
        <h3>Onboarding ends with an invite. Each circle is up to five friends.</h3>
      </div>
      <div>
        <p className={styles.when}>Then · Every wallet</p>
        <h3>Phantom and Solflare on any Android phone, then iOS.</h3>
      </div>
    </div>
  </Slide>,

  // 12 · Close
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
