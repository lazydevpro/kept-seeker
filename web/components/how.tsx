'use client'

import { useRef } from 'react'
import { useMotionScene } from '@/lib/motion'
import { Card, Chip, Object3D, type ObjectName } from '@/components/ui'
import { Rings } from '@/components/rings'
import styles from './how.module.css'

/**
 * Three steps, each shown as the card the reader will actually meet in the app rather than as
 * an icon and a sentence. The 3D objects are the app's own files, so the handshake here is the
 * handshake on the awards screen.
 *
 * The cards rise on entry with a stagger — a plain fade would let all three land at once and
 * read as a feature grid, which is the thing this section is trying to avoid being.
 */

const STEPS: {
  object: ObjectName
  tone: 'kiwi' | 'grape' | 'coral'
  step: string
  title: string
  body: string
  card: React.ReactNode
}[] = [
  {
    object: 'handshake',
    tone: 'kiwi',
    step: 'One',
    title: 'Make the promise',
    body: 'Pick an amount and a week. Say it out loud to four people, or to one.',
    card: (
      <>
        <Chip label="Every Sunday" tone="kiwi" />
        <p className={styles.cardStat}>
          <span className="numeric">$20</span> <span className={styles.cardUnit}>a week</span>
        </p>
        <p className={styles.cardMeta}>Goal · $1,000 by December</p>
      </>
    ),
  },
  {
    object: 'chart-up',
    tone: 'grape',
    step: 'Two',
    title: 'Buy the real thing',
    body: 'Crypto and tokenised equities, settled on Solana from your own wallet.',
    card: (
      <>
        <Chip label="Verified mint" tone="grape" />
        <p className={styles.cardStat}>
          <span className="numeric">0.1643</span> <span className={styles.cardUnit}>SOL</span>
        </p>
        <p className={styles.cardMeta}>$20.00 · price impact 0.01%</p>
      </>
    ),
  },
  {
    object: 'people',
    tone: 'coral',
    step: 'Three',
    title: 'Let them notice',
    body: 'Your circle sees the ring close. They never see the balance behind it.',
    card: (
      <>
        <div className={styles.faces}>
          <Rings size={40} detail="glyph" promise={1} goal={0.4} circle={0.75} label="Maya's week" />
          <Rings size={40} detail="glyph" promise={1} goal={0.62} circle={0.5} label="Dev's week" />
          <Rings size={40} detail="glyph" promise={0.3} goal={0.28} circle={0.75} label="Sam's week" />
        </div>
        <p className={styles.cardMeta}>Maya and Dev kept theirs. Sam has until Sunday.</p>
      </>
    ),
  },
]

export function How() {
  const root = useRef<HTMLElement>(null)

  useMotionScene(
    ({ gsap }) => {
      gsap.from(`.${styles.step}`, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: root.current, start: 'top 72%' },
      })
    },
    { scope: root },
  )

  return (
    <section className={styles.section} ref={root} id="how" aria-labelledby="how-heading">
      <div className="shell">
        <header className={styles.head}>
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="display-2">
            Three things, <em className="serif">once a week.</em>
          </h2>
        </header>

        <ol className={styles.steps}>
          {STEPS.map((item) => (
            <li className={styles.step} key={item.step}>
              <div className={styles.stepHead}>
                <Object3D name={item.object} size={72} />
                <p className={styles.stepIndex}>{item.step}</p>
              </div>
              <h3 className={styles.stepTitle}>{item.title}</h3>
              <p className={styles.stepBody}>{item.body}</p>
              <Card tone={item.tone} className={styles.stepCard}>
                {item.card}
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
