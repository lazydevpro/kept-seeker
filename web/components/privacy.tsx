'use client'

import { useId, useState } from 'react'
import { Card, Chip, Object3D } from '@/components/ui'
import { Rings } from '@/components/rings'
import styles from './privacy.module.css'

/**
 * The product's sharpest claim, made tactile rather than asserted.
 *
 * One card, two readings of it. Flip the switch and the private rows are **gone** — not
 * blurred, gone — while the ring grows to fill the space they left, because when progress is
 * the only thing shared it is also the only thing worth showing.
 *
 * An earlier version blurred the figures instead. That was the wrong illustration: a blurred
 * balance is still in the DOM, still selectable, still one devtools panel away, and the real
 * product does not send those values to a friend's device at all. Removing the rows is what
 * actually happens, so it is what the card should do.
 *
 * The two rows that survive — promise and streak — keep their position and their values
 * across both views. That is the point being made: these two are shared, everything below
 * them is not, and nothing about them changes depending on who is looking.
 */

/** Shared with the circle. Same values in both views, by design. */
const PUBLIC_ROWS = [
  { label: 'Promise', value: 'Kept' },
  { label: 'Streak', value: '14 weeks' },
]

/** Never leaves your device. Present only in the owner's view. */
const PRIVATE_ROWS = [
  { label: 'Portfolio', value: '$1,284.60' },
  { label: 'This week', value: '$20 → 0.0259 SPYx' },
  { label: 'Holdings', value: 'SOL · SPYx · NVDAx' },
]

export function Privacy() {
  const [asFriend, setAsFriend] = useState(true)
  const labelId = useId()

  return (
    <section className={styles.section} aria-labelledby="privacy-heading">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Privacy</p>
          <h2 id="privacy-heading">
            Your circle sees the ring. <em className="serif">Not the number.</em>
          </h2>
          <p className="lede">
            Progress is the social object. Balances, holdings and buys stay yours unless you decide otherwise,
            for each circle, one at a time.
          </p>

          <div className={styles.toggle}>
            <span id={labelId} className={styles.toggleLabel}>
              Viewing as
            </span>
            {/*
              Two buttons in a group, not one `role="switch"`.

              A switch carrying both option labels ends up with an accessible name ("Viewing
              as") that does not contain either piece of visible text, so somebody driving the
              page by voice cannot say "click Your circle" and have anything happen —
              Lighthouse flags exactly this as label-content-name-mismatch. Two buttons each
              named by the words printed on them fixes it, and `aria-pressed` still announces
              which one is active.
            */}
            <div className={styles.switch} role="group" aria-labelledby={labelId}>
              <button
                type="button"
                className={styles.switchOption}
                aria-pressed={!asFriend}
                onClick={() => setAsFriend(false)}
              >
                You
              </button>
              <button
                type="button"
                className={styles.switchOption}
                aria-pressed={asFriend}
                onClick={() => setAsFriend(true)}
              >
                Your circle
              </button>
            </div>
          </div>
        </div>

        <div className={styles.stage}>
          <Card className={styles.card} data-view={asFriend ? 'circle' : 'owner'}>
            <header className={styles.cardHead}>
              {/*
                The ring is the whole card in the circle view, so it is sized to be that: 148
                centred above the name, rather than a 64px glyph beside it. Same component,
                same geometry — only the scale and the composition change.
              */}
              <Rings
                size={asFriend ? 148 : 64}
                detail={asFriend ? 'full' : 'glyph'}
                promise={1}
                goal={0.34}
                circle={0.86}
                label="Your week"
                className={styles.cardRing}
              />
              <div className={styles.cardWho}>
                <p className={styles.cardName}>You</p>
                <p className={styles.cardWeek}>Week 38 · kept</p>
              </div>
              <Chip label={asFriend ? 'Progress only' : 'Private view'} tone={asFriend ? 'coral' : 'kiwi'} />
            </header>

            <dl className={styles.figures}>
              {PUBLIC_ROWS.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className="numeric">{row.value}</dd>
                </div>
              ))}

              {/* Not rendered at all for the circle — which is the claim, literally. */}
              {!asFriend &&
                PRIVATE_ROWS.map((row) => (
                  <div key={row.label} className={styles.privateRow}>
                    <dt>
                      {row.label}
                      <span className={styles.onlyYou}>only you</span>
                    </dt>
                    <dd className="numeric">{row.value}</dd>
                  </div>
                ))}
            </dl>

            <p className={styles.note} aria-live="polite">
              {asFriend
                ? 'What Maya sees: the ring, the promise, the streak. The other three rows are not sent to her device.'
                : 'What you see: everything, on your device, from your own wallet.'}
            </p>
          </Card>

          <Object3D name="shield" size={88} className={styles.shield} />
        </div>
      </div>
    </section>
  )
}
