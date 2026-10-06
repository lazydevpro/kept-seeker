import React from 'react'
import { Img, staticFile } from 'remotion'
import { Rings } from '@/components/rings'
import { SANS, SERIF } from '../fonts'
import { DIAL_STEPS, SECTION } from './cues'
import { clamp, easeIn, easeInOut, easeOut, expoOut, lerp, span, spring } from './motion'
import { Caption, Confetti, CX, CY, INK, L, Phone, SCREEN, type Words } from './parts'
import type { Clock } from './opening'

/**
 * 3 · Promise, 4 · Invest, 5 · Kept — 0:22 to 0:44 at 120 BPM.
 *
 * Out of the ring's white, a phone. The ring lifts off it and becomes a dial: $10 to $25.
 * The $25 drops as a coin into a reel of real names, which turns out to be the phone's buy
 * screen. Buy — and the button bends round into the ring, closing it.
 */

// ── The promise ──────────────────────────────────────────────────────────────────────────

/** The amount on the dial at a given beat: $10, then a $5 step on each of the next three beats. */
function amountAt(beat: number) {
  let amount = 10
  for (const step of DIAL_STEPS.slice(1)) if (beat >= step - 0.15) amount += 5
  return amount
}

/** How far round the dial is — springs to each step so it lands on the beat. */
function dialAt(beat: number, spb: number) {
  let value = 0.2
  for (const step of DIAL_STEPS.slice(1))
    value += 0.1 * spring((beat - step + 0.2) * spb, { w: 20, z: 0.62 })
  return value
}

const PHONE_REST = { x: 700, y: CY, scale: 1 }
const RING_ON_PHONE = { sx: SCREEN.w / 2, sy: 300, size: 250 }
const DIAL = { x: CX, y: 500, size: 620 }

/** The promise screen, in screen coordinates. */
function PromiseScreen({ amount, dial, ring }: { amount: number; dial: number; ring: number }) {
  const slider = clamp(amount / 60)
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: SANS, color: INK }}>
      <div
        style={{
          position: 'absolute',
          top: 78,
          width: '100%',
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 600,
          color: L.inkMuted,
        }}
      >
        Your promise
      </div>
      <div
        style={{
          position: 'absolute',
          left: RING_ON_PHONE.sx - RING_ON_PHONE.size / 2,
          top: RING_ON_PHONE.sy - RING_ON_PHONE.size / 2,
          opacity: ring,
        }}
      >
        <Rings size={RING_ON_PHONE.size} promise={dial} only={['promise']} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          ${amount}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 452,
          width: '100%',
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 600,
          color: L.inkMuted,
        }}
      >
        every Friday
      </div>
      <div
        style={{
          position: 'absolute',
          left: 44,
          top: 530,
          width: 300,
          height: 10,
          borderRadius: 5,
          background: L.trackKiwi,
        }}
      >
        <div
          style={{ width: `${slider * 100}%`, height: '100%', borderRadius: 5, background: L.kiwi }}
        />
        <div
          style={{
            position: 'absolute',
            left: slider * 300 - 17,
            top: -12,
            width: 34,
            height: 34,
            borderRadius: 17,
            background: '#fff',
            boxShadow: '0 4px 12px rgba(11,15,10,0.22)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 610,
          width: 328,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div
            key={i}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              fontWeight: 700,
              background: i === 4 ? L.kiwi : L.surfaceSunken,
              color: i === 4 ? INK : L.inkMuted,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 34,
          top: 740,
          width: 320,
          height: 62,
          borderRadius: 31,
          background: INK,
          color: L.background,
          display: 'grid',
          placeItems: 'center',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Make my promise
      </div>
    </div>
  )
}

/** The number on the dial, rolling to each new value. */
function RollingAmount({ beat, size }: { beat: number; size: number }) {
  const amount = amountAt(beat)
  const step = DIAL_STEPS.slice(1)
    .filter((s) => beat >= s - 0.15)
    .pop()
  const t = step ? span(beat, step - 0.15, step + 0.2, easeOut) : 1
  const prev = amount - (step ? 5 : 0)
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: SANS,
    fontWeight: 700,
    fontSize: size,
    letterSpacing: '-0.035em',
    color: INK,
    lineHeight: 1,
    top: -size / 2,
  }
  return (
    <div style={{ position: 'relative', width: size * 3, height: 0 }}>
      {t < 1 && (
        <div
          style={{
            ...style,
            transform: `translateY(${-t * size * 0.6}px)`,
            opacity: 1 - t,
            filter: `blur(${t * 6}px)`,
          }}
        >
          ${prev}
        </div>
      )}
      <div
        style={{
          ...style,
          transform: `translateY(${(1 - t) * size * 0.6}px)`,
          opacity: t,
          filter: t < 1 ? `blur(${(1 - t) * 6}px)` : undefined,
        }}
      >
        ${amount}
      </div>
    </div>
  )
}

export function PromiseScene({ beat, spb }: Clock) {
  if (beat < SECTION.promise - 0.2 || beat > SECTION.invest + 0.5) return null

  // Still flying forward out of the ring: the phone comes at us from far away and settles.
  const approach = span(beat, SECTION.promise - 0.1, SECTION.promise + 3.6, expoOut)
  const lift = span(beat, 48.4, 50, easeInOut)
  const phoneGone = span(beat, 48.6, 50.1, easeOut)
  const phone = {
    x: lerp(lerp(CX, PHONE_REST.x, span(beat, 45.4, 47.4, easeInOut)), 560, phoneGone),
    y: CY,
    scale: lerp(0.04, 1, approach) * lerp(1, 0.86, phoneGone),
  }
  const amount = amountAt(beat)
  const dial = dialAt(beat, spb)

  // The lifted ring: from its place on the phone to the centre of the frame.
  const from = {
    x: PHONE_REST.x + (RING_ON_PHONE.sx - SCREEN.w / 2),
    y: PHONE_REST.y + (RING_ON_PHONE.sy - SCREEN.h / 2),
  }
  const ringX = lerp(from.x, DIAL.x, lift)
  const ringY = lerp(from.y, DIAL.y, lift)
  const ringSize = lerp(RING_ON_PHONE.size, DIAL.size, lift)

  // The coin: the $25 shrinks into one and falls out of the frame.
  const toCoin = span(beat, 56, 57.2, easeInOut)
  const coin = spring((beat - 56.5) * spb, { w: 11, z: 0.7 })
  const fall = span(beat, 57.8, 60, easeIn)
  const ringOut = span(beat, 56, 57, easeInOut)

  const radius = (ringSize / 2) * 0.895
  const theta = dial * Math.PI * 2
  const knob = spring((beat - 49.5) * spb, { w: 14, z: 0.6 }) * (1 - ringOut)
  const grab =
    1 + 0.14 * Math.sin(Math.PI * span(beat, DIAL_STEPS[0]!, DIAL_STEPS[0]! + 0.5, (t) => t))

  return (
    <>
      <Phone
        x={phone.x}
        y={phone.y}
        scale={phone.scale}
        rotY={lerp(-26, -8, approach)}
        opacity={1 - phoneGone}
        blur={phoneGone * 16}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: span(beat, 44.6, 46.4) }}>
          <PromiseScreen amount={amount} dial={dial} ring={lift > 0 ? 0 : 1} />
        </div>
      </Phone>

      {lift > 0 && fall < 1 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: ringX - ringSize / 2,
              top: ringY - ringSize / 2,
              opacity: 1 - ringOut,
              transform: `scale(${1 + ringOut * 0.1})`,
            }}
          >
            <Rings size={ringSize} promise={dial} only={['promise']} />
          </div>
          {knob > 0.01 && (
            <div
              style={{
                position: 'absolute',
                left: ringX + Math.sin(theta) * radius - 34,
                top: ringY - Math.cos(theta) * radius - 34,
                width: 68,
                height: 68,
                borderRadius: 34,
                background: '#fff',
                boxShadow: '0 8px 22px rgba(11,15,10,0.25)',
                transform: `scale(${knob * grab})`,
              }}
            />
          )}
          {coin > 0.01 && (
            <div
              style={{
                position: 'absolute',
                left: ringX - 76,
                top: ringY - 76 + fall * 1000,
                width: 152,
                height: 152,
                borderRadius: 76,
                background: L.kiwi,
                border: `8px solid ${L.ringPromiseFrom}`,
                boxSizing: 'border-box',
                transform: `scale(${coin}) rotate(${fall * 30}deg)`,
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: ringX,
              top: ringY + fall * 1000,
              transform: `translate(-50%, 0) rotate(${fall * 30}deg)`,
            }}
          >
            <RollingAmount beat={beat} size={lerp(lerp(64, 176, lift), 56, toCoin)} />
          </div>
        </>
      )}
    </>
  )
}

export function PromiseWords({ beat }: Clock) {
  return (
    <>
      <Caption
        beat={beat}
        at={45.8}
        out={48.6}
        x={1130}
        y={CY}
        align="left"
        size={74}
        words={['One small', { accent: 'promise.' }]}
      />
      <Caption
        beat={beat}
        at={53.3}
        out={55.9}
        y={DIAL.y + 178}
        size={52}
        color={L.inkMuted}
        words={['every', { accent: 'Friday' }]}
      />
    </>
  )
}

// ── Invest ───────────────────────────────────────────────────────────────────────────────

/** The shelf, in the order the voice names it: stocks, then crypto, landing on Solana. */
const NAMES: { name: string; chip?: 'Crypto' | 'Private' }[] = [
  { name: 'Tesla' },
  { name: 'Nvidia' },
  { name: 'S&P 500' },
  { name: 'Apple' },
  { name: 'Bitcoin', chip: 'Crypto' },
  { name: 'Solana', chip: 'Crypto' },
]
const CHIP = {
  Crypto: { background: L.skyTint, color: L.skyDeep },
  Private: { background: L.grapeTint, color: L.grapeDeep },
}
const PICK = NAMES.length - 1
const ROW = 210

/** The reel's position, in rows. Steady through the public names, then slowing onto the last. */
function reelAt(beat: number) {
  if (beat <= 69.5) return (beat - 62.5) / 1.5
  const start = (69.5 - 62.5) / 1.5
  const t = span(beat, 69.5, 73.5, (x) => 1 - (1 - x) * (1 - x))
  return lerp(start, PICK, t)
}

/** The phone the reel turns out to be on. Centred, because the next thing is the Buy button. */
const BUY_PHONE = { x: CX, y: CY }
const LIST_SCALE = 0.28
const PILL = { sy: 780, w: 340, h: 64 }

export function Invest({ beat, spb }: Clock) {
  if (beat < 57.6 || beat > SECTION.kept + 0.05) return null

  const pull = span(beat, 73.5, 76.5, easeInOut)
  const s = lerp(1 / LIST_SCALE, 1, pull)
  const zoom = LIST_SCALE * s
  const drum = 1 - pull
  const recede = span(beat, 77, 78.4, easeOut)
  const reel = reelAt(beat)

  // Clip the reel to the phone's screen as the phone arrives around it.
  const left = Math.max(0, BUY_PHONE.x - (SCREEN.w / 2) * s)
  const top = Math.max(0, BUY_PHONE.y - (SCREEN.h / 2) * s)
  const right = Math.max(0, 1920 - (BUY_PHONE.x + (SCREEN.w / 2) * s))
  const bottom = Math.max(0, 1080 - (BUY_PHONE.y + (SCREEN.h / 2) * s))
  const round = SCREEN.r * s

  const press = 1 - 0.06 * Math.sin(Math.PI * span(beat, SECTION.buy, SECTION.buy + 0.5, (t) => t))

  return (
    <>
      <Phone
        x={BUY_PHONE.x}
        y={BUY_PHONE.y}
        scale={s * lerp(1, 0.9, recede)}
        opacity={span(beat, 74.2, 76, easeOut) * (1 - recede)}
        blur={recede * 16}
      >
        <div
          style={{
            position: 'absolute',
            top: 78,
            width: '100%',
            textAlign: 'center',
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 600,
            color: L.inkMuted,
          }}
        >
          Buy
        </div>
        {beat < SECTION.buy + 1 && (
          <div
            style={{
              position: 'absolute',
              left: SCREEN.w / 2 - PILL.w / 2,
              top: PILL.sy - PILL.h / 2,
              width: PILL.w,
              height: PILL.h,
              borderRadius: PILL.h / 2,
              background: L.kiwi,
              display: 'grid',
              placeItems: 'center',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 22,
              color: INK,
              transform: `scale(${press})`,
            }}
          >
            Buy $25 of Solana
          </div>
        )}
      </Phone>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${round}px)`,
          opacity: 1 - recede,
          filter: recede > 0.01 ? `blur(${recede * 16}px)` : undefined,
        }}
      >
        {/* The picked row, highlighted once it is a list. */}
        <div
          style={{
            position: 'absolute',
            left: CX - 165 * s,
            top: CY - (ROW * zoom) / 2,
            width: 330 * s,
            height: ROW * zoom,
            borderRadius: 22 * s,
            background: L.kiwiTint,
            border: `${3 * s}px solid ${L.kiwi}`,
            boxSizing: 'border-box',
            opacity: span(beat, 75.2, 76.2),
          }}
        />
        {NAMES.map((item, i) => {
          const d = i - reel
          // One name at a time: the neighbours are there to show it is a list, and no more.
          const far = clamp(Math.abs(d) / 1.7)
          const scale = lerp(1, 1 - 0.45 * far, drum)
          const opacity = lerp(1, 1 - far, drum)
          if (Math.abs(d) > 4) return null
          return (
            <div
              key={item.name}
              style={{
                position: 'absolute',
                left: CX,
                top: CY + 40 * drum + d * ROW * zoom,
                transform: `translate(-50%, -50%) perspective(1400px) rotateX(${-d * 18 * drum}deg) scale(${scale * zoom})`,
                display: 'flex',
                alignItems: 'center',
                gap: 34,
                whiteSpace: 'nowrap',
                opacity,
              }}
            >
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 150,
                  letterSpacing: '-0.04em',
                  color: INK,
                }}
              >
                {item.name}
              </span>
              {item.chip && (
                <span
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 40,
                    padding: '12px 26px',
                    borderRadius: 40,
                    ...CHIP[item.chip],
                  }}
                >
                  {item.chip}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <BuyToRing beat={beat} spb={spb} fpb={0} />
    </>
  )
}

export function InvestWords({ beat }: Clock) {
  return (
    <>
      <Caption
        beat={beat}
        at={60.4}
        out={68.5}
        y={120}
        size={60}
        words={['It lets you buy real stocks and', { accent: 'crypto.' }]}
      />
    </>
  )
}

// ── The button bends into the ring ───────────────────────────────────────────────────────

const RING = { x: CX, y: CY, size: 620 }
const RING_R = RING.size * 0.4475
const RING_W = RING.size * 0.105
const BEND_TOP = RING.y - RING_R

/** The Buy pill, lifted off the phone, stretching and curling round until its ends meet. */
function BuyToRing({ beat }: Clock) {
  if (beat < SECTION.buy + 1 || beat >= SECTION.kept) return null

  const lift = span(beat, 77, 78, easeInOut)
  const bend = span(beat, 78, SECTION.kept, easeInOut)
  const startY = BUY_PHONE.y + (PILL.sy - SCREEN.h / 2)
  const y = lerp(startY, BEND_TOP, lift)
  const thick = lerp(PILL.h, RING_W, lift)
  const length = lerp(lerp(PILL.w - PILL.h, 700, lift), 2 * Math.PI * RING_R, bend)
  const theta = Math.max(bend * Math.PI * 2, 0.0001)
  const r = length / theta

  const points: string[] = []
  const N = 96
  for (let j = 0; j <= N; j++) {
    const along = -length / 2 + (length * j) / N
    const phi = along / r
    const px = CX + r * Math.sin(phi)
    const py = y + r * (1 - Math.cos(phi))
    points.push(`${j === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`)
  }

  return (
    <>
      <svg
        width={1920}
        height={1080}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        <defs>
          {/* User-space, not bounding-box: a straight pill has a zero-height box, and SVG
              refuses to paint a bounding-box gradient on one. */}
          <linearGradient
            id="bend"
            gradientUnits="userSpaceOnUse"
            x1={CX - RING_R}
            x2={CX + RING_R}
            y1={0}
            y2={0}
          >
            <stop offset="0" stopColor={L.ringPromiseFrom} />
            <stop offset="1" stopColor={L.ringPromiseTo} />
          </linearGradient>
        </defs>
        <path
          d={points.join(' ')}
          fill="none"
          stroke="url(#bend)"
          strokeWidth={thick}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: y,
          transform: 'translate(-50%, -50%)',
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 22,
          color: INK,
          opacity: 1 - span(beat, 77, 77.4),
        }}
      >
        Buy $25 of Solana
      </div>
    </>
  )
}

// ── Kept ─────────────────────────────────────────────────────────────────────────────────

/** "Kept." inside the ring. Sized to match the phone's own "Kept." once the camera pulls back. */
export const KEPT_SIZE = 135

export function Kept({ beat, spb }: Clock) {
  if (beat < SECTION.kept || beat >= 84) return null
  const since = (beat - SECTION.kept) * spb
  const pulse = span(beat, SECTION.kept, SECTION.kept + 1.6, easeOut)
  const word = spring((beat - SECTION.kept - 0.15) * spb, { w: 12, z: 0.7 })
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: RING.x - RING_R - 10,
          top: RING.y - RING_R - 10,
          width: (RING_R + 10) * 2,
          height: (RING_R + 10) * 2,
          borderRadius: '50%',
          border: `6px solid ${L.kiwi}`,
          transform: `scale(${1 + pulse * 0.9})`,
          opacity: (1 - pulse) * 0.7,
        }}
      />
      <div
        style={{ position: 'absolute', left: RING.x - RING.size / 2, top: RING.y - RING.size / 2 }}
      >
        <Rings size={RING.size} promise={1} only={['promise']} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: RING.x,
          top: RING.y,
          transform: `translate(-50%, -52%) scale(${lerp(0.8, 1, word)})`,
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: KEPT_SIZE,
          color: INK,
          opacity: clamp(word * 1.5),
        }}
      >
        Kept.
      </div>
      <Confetti seconds={since} x={RING.x} y={RING.y} radius={RING_R} count={80} seed={3} />
    </>
  )
}

/** The award objects are 256px renders; this keeps every use of them the same. */
export function Award({
  name,
  size,
  style,
}: {
  name: string
  size: number
  style?: React.CSSProperties
}) {
  return (
    <Img
      src={staticFile(`3d/${name}.png`)}
      style={{ position: 'absolute', width: size, height: size, ...style }}
    />
  )
}

export type { Words }
