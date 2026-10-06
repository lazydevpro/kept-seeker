import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Rings } from '@/components/rings'
import { lightColors } from '@/lib/tokens.generated'
import { GOAL, TOTAL_INVESTED, TOTAL_KEPT, WEEKS, frameAt, investedThrough, kept } from '@/lib/year'
import type { Quote } from '@/lib/prices'
import { SANS, SERIF } from '../fonts'
import { Counter, Enter, Eyebrow, Line, Strip, useRingPx, type Tone } from './kit'

/**
 * The eight scenes.
 *
 * Every ring is the real `<Rings>` from `web/components/rings.tsx` — the same component the
 * app and the landing page draw. Every number comes from `web/lib/year.ts`. Nothing here is a
 * mock-up of the product; it is the product, rendered at 24fps.
 *
 * Rings take their values as **props**, not through the imperative `set()` the website uses.
 * That API exists because scroll outruns React and re-rendering 180 paths a frame is not
 * viable in a browser. Remotion already re-renders every frame, so props are both simpler and
 * the only correct option here: calling `set()` during render mutates the DOM and then React
 * reconciles those same elements straight back to their prop values, which would draw the
 * rings empty on every single frame.
 */

type SceneProps = { tone: Tone; size: number }

/** Ink scenes need the dark track set, or three pale bands read as full rather than empty. */
const ringMode = (tone: Tone) => (tone.dark ? 'dark' : 'light')

const stage: React.CSSProperties = {
  justifyContent: 'center',
  alignItems: 'center',
  gap: '3%',
  padding: '8%',
}

/** ── 1. The promise ──────────────────────────────────────────────────────────────────── */

export function ScenePromise({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  const draw = spring({ frame: frame - 12, fps, config: { damping: 200 }, durationInFrames: 44 })

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <Rings mode={ringMode(tone)} size={px(0.2)} promise={draw} goal={0} circle={0} />
      <Enter at={30}>
        <span style={{ display: 'block', textAlign: 'center' }}>
          <Counter value={draw * 20} prefix="$" size={size * 1.5} tone={tone} at={30} />
        </span>
      </Enter>
      <Line text="A promise. Twenty dollars," serif="every week." tone={tone} size={size} at={42} />
    </AbsoluteFill>
  )
}

/** ── 2. The sawtooth ─────────────────────────────────────────────────────────────────── */

export function SceneSawtooth({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { width } = useVideoConfig()

  const px = useRingPx()
  // Weeks 1 → 5, straight out of the dataset, so the ring sawtooths on its own.
  const t = interpolate(frame, [0, 190], [0, 5], { extrapolateRight: 'clamp' })
  const value = frameAt(t)

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <Eyebrow text={`Week ${value.week}`} tone={tone} size={size} />
      <Rings
        mode={ringMode(tone)}
        size={px(0.2)}
        promise={value.promise}
        goal={value.goal}
        circle={value.circle}
      />
      <Strip
        through={Math.floor(t)}
        kept={kept}
        width={width * 0.52}
        height={size * 0.9}
        tone={tone}
      />
      <Line text="Keep it, and the ring" serif="closes." tone={tone} size={size} at={20} />
    </AbsoluteFill>
  )
}

/** ── 3. The miss ─────────────────────────────────────────────────────────────────────── */

/**
 * The centre of the film. Eight seconds, most of them still.
 *
 * Week 6 is a miss in the dataset, so the ring climbs to 45% and stops — then there is a full
 * second where nothing on screen moves at all, which is the only dead air in the film and the
 * reason the scene works. It will feel too long in the edit. It is not too long.
 */
export function SceneMiss({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  const fill = Math.round(2.4 * fps)
  const hold = Math.round(3.6 * fps)

  // Climb to the stall, hold dead, then reset to empty for week 7.
  const t = frame < fill ? interpolate(frame, [0, fill], [5, 5.99]) : frame < hold ? 5.99 : 6.0

  const value = frameAt(t)
  const after = frame >= hold

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <Eyebrow text="Week 6" tone={tone} size={size} />
      <Rings
        mode={ringMode(tone)}
        size={px(0.2)}
        promise={value.promise}
        goal={value.goal}
        circle={value.circle}
      />
      <Strip
        through={after ? 6 : 5}
        kept={kept}
        width={width * 0.52}
        height={size * 0.9}
        tone={tone}
      />

      <div style={{ minHeight: size * 3, textAlign: 'center' }}>
        <Line text="Miss one, and the ring" serif="resets." tone={tone} size={size} at={fill} />
        {after ? (
          <div style={{ marginTop: size * 0.6 }}>
            <Line text="The money" serif="doesn't." tone={tone} size={size * 1.15} at={hold + 10} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

/** ── 4. The circle ───────────────────────────────────────────────────────────────────── */

const FRIENDS = [
  { name: 'Maya', closesAt: 40 },
  { name: 'Dev', closesAt: 56 },
  { name: 'Sam', closesAt: 128 },
]

export function SceneCircle({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  // The bell is the nudge: it appears only while Sam's ring is still open.
  const nudge = spring({ frame: frame - 96, fps, config: { damping: 12 }, durationInFrames: 22 })
  const nudgeOut = interpolate(frame, [124, 138], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <Rings mode={ringMode(tone)} size={px(0.17)} promise={1} goal={0.12} circle={0.25} />

      <div style={{ display: 'flex', gap: size * 0.7, alignItems: 'center' }}>
        {FRIENDS.map((friend, i) => {
          const close = spring({
            frame: frame - friend.closesAt,
            fps,
            config: { damping: 200 },
            durationInFrames: 26,
          })
          return (
            <Enter key={friend.name} at={16} stagger={i * 5}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: size * 0.2 }}>
                <FriendRing progress={close} tone={tone} />
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: size * 0.32,
                    fontWeight: 600,
                    color: tone.muted,
                  }}
                >
                  {friend.name}
                </span>
              </div>
            </Enter>
          )
        })}

        {nudge > 0 && nudgeOut > 0 ? (
          <Img
            src={staticFile('3d/bell.png')}
            style={{
              width: size * 1.6,
              height: size * 1.6,
              opacity: nudgeOut,
              transform: `scale(${nudge}) rotate(${Math.sin(frame * 0.5) * 8}deg)`,
            }}
          />
        ) : null}
      </div>

      <Line text="Four people see the ring" serif="close." tone={tone} size={size} at={20} />
    </AbsoluteFill>
  )
}

function FriendRing({ progress, tone }: { progress: number; tone: Tone }) {
  const px = useRingPx()
  return (
    <Rings
      mode={ringMode(tone)}
      size={px(0.055)}
      detail="glyph"
      promise={progress}
      goal={progress * 0.4}
      circle={progress * 0.7}
    />
  )
}

/** ── 5. The year ─────────────────────────────────────────────────────────────────────── */

export function SceneYear({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  const run = Math.round(6.4 * fps)
  const t = interpolate(frame, [0, run], [6.2, WEEKS], { extrapolateRight: 'clamp' })
  const value = frameAt(t)
  const done = frame > run

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <Eyebrow text={`Week ${value.week} of ${WEEKS}`} tone={tone} size={size} />
      <Rings
        mode={ringMode(tone)}
        size={px(0.2)}
        promise={value.promise}
        goal={value.goal}
        circle={value.circle}
      />
      <Strip through={Math.floor(t)} kept={kept} width={width * 0.62} height={size} tone={tone} />

      {done ? (
        <Enter at={run + 6}>
          <p
            style={{
              margin: 0,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: size * 0.62,
              color: tone.muted,
              textAlign: 'center',
            }}
          >
            <Counter value={WEEKS} size={size * 1.1} tone={tone} at={run + 6} bounce /> promises
            {'  ·  '}
            <Counter value={TOTAL_KEPT} size={size * 1.1} tone={tone} at={run + 12} bounce /> kept
            {'  ·  '}
            <Counter
              value={TOTAL_INVESTED}
              prefix="$"
              size={size * 1.1}
              tone={tone}
              at={run + 18}
              bounce
            />{' '}
            in
          </p>
        </Enter>
      ) : (
        <Counter value={value.invested} prefix="$" size={size * 1.2} tone={tone} />
      )}
    </AbsoluteFill>
  )
}

/** ── 6. What it bought ───────────────────────────────────────────────────────────────── */

export function SceneAssets({
  tone,
  size,
  quotes,
  live,
}: SceneProps & { quotes: Quote[]; live: string }) {
  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg, gap: '2%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.5 }}>
        <Eyebrow text="What it bought" tone={tone} size={size} />
        <span
          style={{
            fontFamily: SANS,
            fontSize: size * 0.26,
            fontWeight: 700,
            padding: `${size * 0.1}px ${size * 0.3}px`,
            borderRadius: 999,
            background: lightColors.kiwiTint,
            color: lightColors.kiwiDeep,
          }}
        >
          {live}
        </span>
      </div>

      <div style={{ width: '74%', display: 'grid', gap: size * 0.22 }}>
        {quotes.map((quote, i) => (
          <Enter key={quote.symbol} at={8} stagger={i * 4}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '5.5em 1fr auto 5em',
                alignItems: 'baseline',
                gap: size * 0.4,
                paddingBottom: size * 0.22,
                borderBottom: `1px solid ${tone.faint}`,
                fontFamily: SANS,
                fontSize: size * 0.42,
              }}
            >
              <span style={{ fontWeight: 700, color: tone.fg }}>{quote.symbol}</span>
              <span style={{ color: tone.muted }}>{quote.name}</span>
              <span style={{ fontWeight: 700, color: tone.fg, fontVariantNumeric: 'tabular-nums' }}>
                $
                {quote.price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    quote.change24h === null
                      ? tone.muted
                      : quote.change24h >= 0
                        ? lightColors.kiwiDeep
                        : lightColors.coralDeep,
                }}
              >
                {quote.change24h === null
                  ? '—'
                  : `${quote.change24h >= 0 ? '+' : ''}${quote.change24h.toFixed(2)}%`}
              </span>
            </div>
          </Enter>
        ))}
      </div>

      <Line
        text="Settled on Solana, from"
        serif="your own wallet."
        tone={tone}
        size={size * 0.8}
        at={40}
      />
    </AbsoluteFill>
  )
}

/** ── 7. Privacy ──────────────────────────────────────────────────────────────────────── */

const PRIVATE = ['Portfolio', 'This week', 'Holdings']
const PUBLIC = ['Promise', 'Streak']

export function ScenePrivacy({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  const leave = spring({ frame: frame - 34, fps, config: { damping: 200 }, durationInFrames: 22 })
  const grow = interpolate(leave, [0, 1], [0.055, 0.1])

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <div
        style={{
          width: '54%',
          background: tone.surface,
          borderRadius: size * 0.8,
          padding: size * 0.8,
          display: 'grid',
          justifyItems: 'center',
          gap: size * 0.45,
          boxShadow: `0 ${size * 0.3}px ${size * 1.2}px rgba(0,0,0,0.14)`,
        }}
      >
        <Rings mode={ringMode(tone)} size={px(grow)} promise={1} goal={0.34} circle={0.86} />

        {PUBLIC.map((label) => (
          <Row key={label} label={label} tone={tone} size={size} opacity={1} shift={0} />
        ))}
        {PRIVATE.map((label, i) => (
          <Row
            key={label}
            label={label}
            tone={tone}
            size={size}
            opacity={1 - leave}
            shift={leave * (60 + i * 18)}
          />
        ))}
      </div>

      <Line
        text="Your circle sees the ring."
        serif="Not the number."
        tone={tone}
        size={size * 0.9}
        at={54}
      />
    </AbsoluteFill>
  )
}

function Row({
  label,
  tone,
  size,
  opacity,
  shift,
}: {
  label: string
  tone: Tone
  size: number
  opacity: number
  shift: number
}) {
  if (opacity <= 0.01) return null
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: SANS,
        fontSize: size * 0.38,
        color: tone.muted,
        opacity,
        transform: `translateX(${shift}px)`,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700, color: tone.fg }}>
        {label === 'Promise' ? 'Kept' : label === 'Streak' ? '14 weeks' : '•••••'}
      </span>
    </div>
  )
}

/** ── 8. Close ────────────────────────────────────────────────────────────────────────── */

export function SceneClose({ tone, size }: SceneProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  const px = useRingPx()
  const shrink = interpolate(frame, [0, 26], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const markIn = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const markOut = interpolate(frame, [56, 72], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ ...stage, background: tone.bg }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: shrink }}>
        <Rings mode={ringMode(tone)} size={px(0.2)} promise={1} goal={0.98} circle={1} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center', opacity: markIn * markOut }}
      >
        <Img src={staticFile('promise.svg')} style={{ width: px(0.22) }} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: size * 0.6,
          opacity: interpolate(frame, [68, 86], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: size * 1.35,
            letterSpacing: '-0.045em',
            color: tone.fg,
          }}
        >
          Promises{' '}
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400 }}>compound.</span>
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: size * 0.42,
            letterSpacing: '0.08em',
            color: lightColors.kiwiDeep,
          }}
        >
          kept-seeker.pages.dev
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export const YEAR_FACTS = { GOAL, investedThrough }
