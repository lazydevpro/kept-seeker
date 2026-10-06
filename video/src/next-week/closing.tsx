import React from 'react'
import { staticFile } from 'remotion'
import { Rings } from '@/components/rings'
import { SANS } from '../fonts'
import {
  AWARDS,
  HITS,
  MISSED_WEEK,
  MONEY_FILL,
  MONEY_PULL,
  MONEY_PUSH,
  SECTION,
  weekBeat,
  yearWeek,
} from './cues'
import { clamp, easeInOut, easeOut, lerp, span, spring } from './motion'
import { Camera, Caption, CREAM, CX, CY, D, Glow, INK, L, Smear } from './parts'
import { Award } from './middle'
import type { Clock } from './opening'

/**
 * 8 · The year, 9 · The money, 10 · End.
 *
 * The opening's row of weeks again, in white, and this time every circle closes as the camera
 * passes it — except one, and the row keeps going anyway. Awards land on the weeks that
 * earned them, and under the row a tally counts what has been put away.
 *
 * On week fifty-two the camera pulls back: the row is one of ten, a year each, and the nine
 * new rows fill while the tally compounds. Then it pushes into the very last week of the ten
 * years; that ring becomes all three, the white drains away, and they close on three beats.
 */

const [H0, H1, H2] = HITS as unknown as [number, number, number]
const E = SECTION.end
const SPACING = 390
export const WEEK_SIZE = 220
const ROW_Y = CY

// ── The money ────────────────────────────────────────────────────────────────────────────

const YEARS = 10
const ROW_GAP = 650
/** One missed week in each later year, like the one in the first. Any weeks would do. */
const MISSED_LATER = [7, 33, 12, 45, 26, 3, 38, 21, 49]
const missedIn = (year: number) => (year === 1 ? MISSED_WEEK : MISSED_LATER[year - 2]!)

/**
 * The sum: $25 for every week kept, growing 7% a year. An illustration, not a forecast — it
 * says so on screen. Computed from the grid, so the number and the picture always agree.
 */
const WEEKLY = 25
const RATE = 0.07
const WEEKLY_GROWTH = Math.pow(1 + RATE, 1 / 52)
const KEPT = Array.from(
  { length: YEARS * 52 },
  (_, i) => (i % 52) + 1 !== missedIn(Math.floor(i / 52) + 1),
)
/** What the weeks before week `n` (counted from the first) are worth by then. */
function worth(n: number) {
  let total = 0
  for (let i = 0; i < Math.min(n, KEPT.length); i++) {
    if (KEPT[i]) total += WEEKLY * Math.pow(WEEKLY_GROWTH, n - i)
  }
  return total
}
const keptIn = (from: number, to: number) => KEPT.slice(from, to).filter(Boolean).length
export const YEAR_PUT_AWAY = WEEKLY * keptIn(0, 52)
export const TEN_YEAR_PUT_IN = WEEKLY * keptIn(0, YEARS * 52)
export const TEN_YEAR_WORTH = worth(YEARS * 52)

const weekX = (week: number) => CX + (week - 52) * SPACING
const yearY = (year: number) => ROW_Y + (year - 1) * ROW_GAP
/** The whole ten years, fitted to the width of the frame, in its top part. */
const GRID_ZOOM = 1750 / (51 * SPACING + WEEK_SIZE)
const GRID_FX = weekX(26.5)
const GRID_FY = yearY(5.5) + (CY - 400) / GRID_ZOOM
const LAST_Y = yearY(YEARS)

/** Where a world point lands on screen under the grid view. */
const onGrid = (x: number, y: number) =>
  [CX + (x - GRID_FX) * GRID_ZOOM, CY + (y - GRID_FY) * GRID_ZOOM] as const

/**
 * Move the camera so one point glides in a straight line across the screen while the zoom
 * changes evenly — otherwise a pull-back swings its subject out and back.
 */
function glide(
  anchor: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
  z0: number,
  z1: number,
  t: number,
) {
  const zoom = Math.exp(lerp(Math.log(z0), Math.log(z1), t))
  return {
    zoom,
    fx: anchor[0] - (lerp(from[0], to[0], t) - CX) / zoom,
    fy: anchor[1] - (lerp(from[1], to[1], t) - CY) / zoom,
  }
}

function camera(beat: number) {
  const out = span(beat, MONEY_PULL[0], MONEY_PULL[1], easeInOut)
  const back = span(beat, MONEY_PUSH[0], MONEY_PUSH[1], easeInOut)
  if (back > 0) {
    // Into the last week of the ten years — the ring the end grows out of.
    const { zoom, fx, fy } = glide([CX, LAST_Y], onGrid(CX, LAST_Y), [CX, CY], GRID_ZOOM, 1, back)
    return { zoom: zoom * endZoom(beat), fx, fy }
  }
  // Out from week fifty-two of the first year to the whole ten.
  return glide([CX, ROW_Y], [CX, CY], onGrid(CX, ROW_Y), 1, GRID_ZOOM, out)
}

/** Each ring closes over the six weeks behind the sweep. */
const FILL_TRAIL = 6

/** How far the sweep has got through the nine new years, in weeks — past the last by its trail. */
function filled(beat: number) {
  return easeInOut(span(beat, MONEY_FILL[0], MONEY_FILL[1])) * ((YEARS - 1) * 52 + FILL_TRAIL)
}

/** 1 → 5.3: the last ring growing into the three rings that fill the frame. */
function endZoom(beat: number) {
  return Math.pow(900 / WEEK_SIZE, span(beat, E - 1, E + 1.2, easeInOut))
}

// ── The year, and the money ──────────────────────────────────────────────────────────────

export function Year({ beat, spb, fpb }: Clock) {
  if (beat < SECTION.year - 0.05 || beat > E + 1.3) return null

  const p = yearWeek(beat)
  const speed =
    beat < SECTION.money
      ? (((yearWeek(beat + 0.02) - yearWeek(beat - 0.02)) / 0.04) * SPACING) / fpb
      : 0
  const cam = camera(beat)
  const othersOut = span(beat, E - 1, E + 0.2, easeOut)
  const rowIn = span(beat, 119.2, SECTION.year + 0.6, easeOut)
  // Labels and awards are for the first year only; they go as the camera pulls back.
  const detailOut = span(beat, MONEY_PULL[0], MONEY_PULL[0] + 1.2)
  const pulling = beat >= MONEY_PULL[0]
  const fill = filled(beat)

  const weeks: React.ReactNode[] = []
  for (let year = 1; year <= (pulling ? YEARS : 1); year++) {
    const lo = year === 1 && !pulling ? Math.max(1, Math.floor(p - 4)) : 1
    const hi = year === 1 && !pulling ? Math.min(52, Math.ceil(p + 4)) : 52
    const newYear = span(beat, MONEY_PULL[0] + 0.6, MONEY_PULL[0] + 2.2)
    for (let w = lo; w <= hi; w++) {
      const x = weekX(year === 1 ? w - p + 52 : w)
      const y = yearY(year)
      const missed = w === missedIn(year)
      const k = (year - 2) * 52 + (w - 1)
      const value = missed
        ? 0
        : year > 1
          ? clamp((fill - k) / FILL_TRAIL)
          : w === 1
            ? 1
            : easeOut(clamp((p - (w - 0.42)) / 0.34))
      const isLast = year === YEARS && w === 52
      // The last ring is handed to `End` the moment the three rings start to appear.
      if (isLast && beat >= E) continue
      const fade = (isLast ? 1 : 1 - othersOut) * (year === 1 ? (w === 1 ? 1 : rowIn) : newYear)
      weeks.push(
        <React.Fragment key={`${year}-${w}`}>
          <div
            style={{
              position: 'absolute',
              left: x - WEEK_SIZE / 2,
              top: y - WEEK_SIZE / 2,
              opacity: fade,
            }}
          >
            <Rings size={WEEK_SIZE} promise={value} only={['promise']} detail="glyph" />
          </div>
          {year === 1 && detailOut < 1 && (
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y - 168,
                transform: 'translate(-50%, -50%)',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '0.22em',
                color: missed ? L.inkFaint : L.inkMuted,
                opacity: fade * (w === 1 ? rowIn : 1) * (1 - detailOut),
                whiteSpace: 'nowrap',
              }}
            >
              WEEK {w}
            </div>
          )}
        </React.Fragment>,
      )
    }
  }

  const awards = AWARDS.map((award) => {
    const x = weekX(award.week - p + 52)
    if (Math.abs(x - CX) > 1400 && !pulling) return null
    const at = award.week === 1 ? SECTION.year + 0.4 : weekBeat(award.week - 0.25)
    const pop = spring((beat - at) * spb, { w: 12, z: 0.6 })
    if (pop <= 0 || detailOut >= 1) return null
    const fade = 1 - detailOut
    return (
      <React.Fragment key={award.week}>
        <Award
          name={award.object}
          size={200}
          style={{ left: x - 100, top: ROW_Y - 492, transform: `scale(${pop})`, opacity: fade }}
        />
        <div
          style={{
            position: 'absolute',
            left: x,
            top: ROW_Y - 262,
            transform: `translate(-50%, -50%) scale(${lerp(0.8, 1, clamp(pop))})`,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: '-0.02em',
            color: INK,
            opacity: clamp(pop * 1.5) * fade,
            whiteSpace: 'nowrap',
          }}
        >
          {award.title}
        </div>
      </React.Fragment>
    )
  })

  return (
    <>
      <Smear x={speed * 0.1} y={0}>
        <Camera zoom={cam.zoom} fx={cam.fx} fy={cam.fy}>
          {weeks}
          {awards}
        </Camera>
      </Smear>
      <Tally beat={beat} p={p} fill={fill} />
    </>
  )
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * Under the row, what the weeks add up to: first what has been put away, then — as the ten
 * years fill — what it could grow to. One number, so one object on screen.
 */
function Tally({ beat, p, fill }: { beat: number; p: number; fill: number }) {
  const show =
    span(beat, 127.8, 128.8, easeOut) * (1 - span(beat, MONEY_PUSH[0], MONEY_PUSH[0] + 0.8))
  if (show <= 0) return null

  const out = span(beat, MONEY_PULL[0], MONEY_PULL[1], easeInOut)
  const growing = span(beat, MONEY_FILL[0] - 0.4, MONEY_FILL[0] + 0.4)
  // A week counts once its ring has closed; the missed week adds nothing.
  const closed = Math.min(52, Math.floor(p + 0.25))
  const putAway = WEEKLY * (closed - (closed >= MISSED_WEEK ? 1 : 0))
  const weeks = 52 + Math.min(fill, (YEARS - 1) * 52)
  const amount = fill > 0 ? Math.max(YEAR_PUT_AWAY, worth(weeks)) : putAway
  const note = span(beat, MONEY_FILL[1] - 1, MONEY_FILL[1]) * show

  const label = (text: string, opacity: number) => (
    <div
      style={{
        position: 'absolute',
        left: CX,
        top: lerp(728, 752, out),
        transform: 'translate(-50%, -50%)',
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: lerp(22, 24, out),
        letterSpacing: '0.2em',
        color: L.inkMuted,
        opacity: opacity * show,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )

  return (
    <>
      {label('PUT AWAY', 1 - growing)}
      {label('IN TEN YEARS, IT COULD GROW TO', growing)}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: lerp(800, 850, out),
          transform: `translate(-50%, -50%) translateY(${(1 - show) * 16}px)`,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: lerp(76, 132, out),
          letterSpacing: '-0.035em',
          fontVariantNumeric: 'tabular-nums',
          color: INK,
          opacity: show,
          whiteSpace: 'nowrap',
        }}
      >
        {money(amount)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: 1030,
          transform: 'translate(-50%, -50%)',
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 18,
          color: L.inkFaint,
          opacity: note,
          whiteSpace: 'nowrap',
        }}
      >
        Illustration, not a forecast: {money(WEEKLY)} a week for ten years with one week a year
        missed ({money(TEN_YEAR_PUT_IN)} put in), growing {Math.round(RATE * 100)}% a year. Capital
        at risk.
      </div>
    </>
  )
}

export function YearWords({ beat }: Clock) {
  return (
    <Caption
      beat={beat}
      at={121}
      out={127.5}
      y={850}
      size={66}
      words={['Week after', { accent: 'week.' }]}
    />
  )
}

// ── End ──────────────────────────────────────────────────────────────────────────────────

/** The background drains from cream to ink under the three rings. */
export function endDark(beat: number) {
  return span(beat, E, E + 2.2, easeInOut)
}

export function End({ beat, spb }: Clock) {
  if (beat < E) return null

  const dark = endDark(beat)
  const contract = span(beat, E + 4.3, E + 5.8, easeInOut)
  const toMark = span(beat, SECTION.logo - 0.6, SECTION.logo + 0.8, easeInOut)
  const size = lerp(lerp(WEEK_SIZE * endZoom(beat), 300, contract), 150, toMark)
  const y = lerp(lerp(ROW_Y, 400, contract), 390, toMark)
  const goal = span(beat, H1 - 0.7, H1, easeOut)
  const circle = span(beat, H2 - 0.7, H2, easeOut)
  const trackIn = span(beat, E, E + 0.8)
  const ringsOut = span(beat, SECTION.logo, SECTION.logo + 0.8)

  const hit = (at: number) => Math.exp(-Math.max(0, beat - at) * 2.2) * (beat >= at ? 1 : 0)
  const glow = 0.18 + 0.2 * (hit(H0) + hit(H1) + hit(H2))

  const mark = spring((beat - SECTION.logo) * spb, { w: 10, z: 0.8 })
  const word = span(beat, SECTION.logo + 0.6, SECTION.logo + 1.6, easeOut)
  const cta = span(beat, SECTION.logo + 2, SECTION.logo + 3, easeOut)
  const small = span(beat, SECTION.logo + 2.8, SECTION.logo + 3.8, easeOut)

  const rings = (mode: 'light' | 'dark') => (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - trackIn }}>
        <Rings size={size} promise={1} only={['promise']} mode={mode} />
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: trackIn }}>
        <Rings size={size} promise={1} goal={goal} circle={circle} mode={mode} />
      </div>
    </>
  )

  return (
    <>
      {/* Off-centre, so the light falls round the rings and not into their middle. */}
      <Glow
        x={CX + size * 0.1}
        y={y - size * 0.42}
        r={size * 0.85}
        color={D.kiwi}
        opacity={glow * dark * (1 - ringsOut)}
      />
      <Glow
        x={CX - size * 0.35}
        y={y + size * 0.25}
        r={size * 0.8}
        color={D.grape}
        opacity={(0.1 + 0.3 * hit(H1)) * dark * (1 - ringsOut)}
      />
      <Glow
        x={CX + size * 0.35}
        y={y - size * 0.2}
        r={size * 0.8}
        color={D.coral}
        opacity={(0.1 + 0.3 * hit(H2)) * dark * (1 - ringsOut)}
      />

      <div
        style={{
          position: 'absolute',
          left: CX - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          opacity: 1 - ringsOut,
          transform: `scale(${1 + 0.035 * (hit(H0) + hit(H1) + hit(H2))})`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - dark }}>{rings('light')}</div>
        <div style={{ position: 'absolute', inset: 0, opacity: dark }}>{rings('dark')}</div>
      </div>

      <Caption
        beat={beat}
        at={E + 5.5}
        out={SECTION.logo - 0.7}
        y={700}
        size={92}
        color={CREAM}
        words={['Promises', { accent: 'compound.' }]}
      />

      {/* The mark, tinted kiwi: the pinkies of a promise. */}
      {mark > 0 && (
        <div
          style={{
            position: 'absolute',
            left: CX - 125,
            top: 390 - 85,
            width: 250,
            height: 170,
            background: D.kiwi,
            WebkitMaskImage: `url(${staticFile('promise.svg')})`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            transform: `scale(${lerp(0.6, 1, mark)})`,
            opacity: clamp(mark * 1.4),
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: 575,
          transform: `translate(-50%, -50%) translateY(${(1 - word) * 30}px)`,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 150,
          letterSpacing: '0.02em',
          color: CREAM,
          opacity: word,
          filter: word < 1 ? `blur(${(1 - word) * 12}px)` : undefined,
        }}
      >
        KEPT
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: 718,
          transform: `translate(-50%, -50%) translateY(${(1 - cta) * 20}px)`,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 38,
          letterSpacing: '-0.01em',
          color: CREAM,
          opacity: cta * 0.82,
          whiteSpace: 'nowrap',
        }}
      >
        Android beta now · Solana dApp Store soon
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: 782,
          transform: 'translate(-50%, -50%)',
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 32,
          color: D.kiwi,
          opacity: cta,
        }}
      >
        kept-seeker.pages.dev
      </div>
      <div
        style={{
          position: 'absolute',
          left: CX,
          top: 1030,
          transform: 'translate(-50%, -50%)',
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 18,
          color: D.inkFaint,
          opacity: small * 0.9,
          whiteSpace: 'nowrap',
        }}
      >
        Tokenized stocks via xStocks. Crypto routed by Jupiter. Private-market tokens via Tessera.
        Not available to U.S. persons. Capital at risk.
      </div>
    </>
  )
}
