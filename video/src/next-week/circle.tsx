import React from 'react'
import { Img, staticFile } from 'remotion'
import { Rings } from '@/components/rings'
import { SANS, SERIF } from '../fonts'
import {
  CARD_LAND,
  CARD_LIFT,
  CARD_SHED,
  NUDGE_LAND,
  NUDGE_SEND,
  REACTIONS,
  SECTION,
  THEIRS_CLOSE,
  WAVE_START,
  WAVE_STEP,
} from './cues'
import { clamp, easeIn, easeInOut, easeOut, lerp, rand, span, spring } from './motion'
import { Camera, Caption, Card, Confetti, CX, CY, INK, L, onScreen, Phone, SCREEN } from './parts'
import { KEPT_SIZE } from './middle'
import { WEEK_SIZE } from './closing'
import type { Clock } from './opening'

/**
 * 6 · Shared, 7 · Ripple — 0:42 to 1:00 at 120 BPM.
 *
 * The camera pulls back from "Kept." and it is on a phone between two friends' phones. The
 * moment lifts off, sheds the amount, and lands on theirs; reactions come back. One friend is
 * behind — a nudge, and their ring closes too. Pull back further and it is dozens of circles
 * closing, until the camera pushes into ours: week one of a year.
 */

const OURS = { x: CX, y: 560, scale: 0.8, rotY: 0 }
const MAYA = { x: 430, y: 580, scale: 0.64, rotY: 18 }
const DEV = { x: 1490, y: 580, scale: 0.64, rotY: -18 }

/** Our screen's ring. The Kept ring (620px, centre frame) is exactly this at the opening zoom. */
const OUR_RING = { sx: SCREEN.w / 2, sy: 330, size: 220 }
const FRIEND_RING = { sx: SCREEN.w / 2, sy: 380, size: 220 }
const OUR_RING_AT = onScreen(OURS, OUR_RING.sx, OUR_RING.sy)
const PULL_FROM = 620 / (OUR_RING.size * OURS.scale)

const SHARED_ZOOM = 1.12
const CHIPS = [124, 194, 264]
const REACTION = [
  { emoji: '👏', from: MAYA },
  { emoji: '💜', from: DEV },
  { emoji: '🔥', from: MAYA },
]

/** The camera across both sections: pull back from Kept, hold, pull back again for the ripple. */
function camera(beat: number) {
  const out1 = span(beat, 84, 87.5, easeInOut)
  const out2 = span(beat, 110, 112.5, easeInOut)
  return {
    // Settles a touch closer than 1:1, so the three phones fill the frame rather than float in it.
    zoom: Math.pow(PULL_FROM, 1 - out1) * Math.pow(SHARED_ZOOM, out1) * Math.pow(0.5, out2),
    fx: lerp(OUR_RING_AT.x, CX, out1),
    fy: lerp(OUR_RING_AT.y, CY, out1),
  }
}

/** A world point through the camera, for the hand-off to the glyph field. */
function project(beat: number, x: number, y: number) {
  const c = camera(beat)
  return { x: CX + (x - c.fx) * c.zoom, y: CY + (y - c.fy) * c.zoom, zoom: c.zoom }
}

function OurScreen({ beat, spb, chrome }: { beat: number; spb: number; chrome: number }) {
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
          opacity: chrome,
        }}
      >
        This week
      </div>
      <div
        style={{
          position: 'absolute',
          left: OUR_RING.sx - OUR_RING.size / 2,
          top: OUR_RING.sy - OUR_RING.size / 2,
        }}
      >
        <Rings size={OUR_RING.size} promise={1} only={['promise']} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: KEPT_SIZE / (PULL_FROM * OURS.scale),
            transform: 'translateY(-2%)',
          }}
        >
          Kept.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 468,
          width: '100%',
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 600,
          color: L.inkMuted,
          opacity: chrome,
        }}
      >
        $25 · SpaceX
      </div>
      {CHIPS.map((sx, k) => {
        const pop = spring((beat - REACTIONS[k]!) * spb, { w: 16, z: 0.55 })
        if (pop <= 0) return null
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: sx - 28,
              top: 540,
              width: 56,
              height: 56,
              borderRadius: 28,
              background: L.surfaceSunken,
              display: 'grid',
              placeItems: 'center',
              fontSize: 30,
              transform: `scale(${pop})`,
            }}
          >
            {REACTION[k]!.emoji}
          </div>
        )
      })}
    </div>
  )
}

function FriendScreen({ name, value, status }: { name: string; value: number; status: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: SANS, color: INK }}>
      <div
        style={{
          position: 'absolute',
          top: 262,
          width: '100%',
          textAlign: 'center',
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        {name}
      </div>
      <div
        style={{
          position: 'absolute',
          left: FRIEND_RING.sx - FRIEND_RING.size / 2,
          top: FRIEND_RING.sy - FRIEND_RING.size / 2 + 40,
        }}
      >
        <Rings size={FRIEND_RING.size} promise={value} only={['promise']} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 668,
          width: '100%',
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 600,
          color: L.inkMuted,
        }}
      >
        {status}
      </div>
    </div>
  )
}

/** The frame position of a friend's ring. */
function friendRing(phone: typeof MAYA) {
  return onScreen(phone, FRIEND_RING.sx, FRIEND_RING.sy + 40)
}

/** The share card. `shed` takes the amount away; nothing else about the card changes. */
function ShareCard({
  x,
  y,
  scale,
  rotY,
  shed,
  opacity,
}: {
  x: number
  y: number
  scale: number
  rotY: number
  shed: number
  opacity: number
}) {
  const gone = span(shed, 0, 0.65, easeIn)
  const collapse = span(shed, 0.6, 1, easeInOut)
  return (
    <Card
      width={600}
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) perspective(1600px) rotateY(${rotY}deg) scale(${scale})`,
        opacity,
        padding: '26px 30px',
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: 'none', width: 104, height: 104 }}>
        <Rings size={104} promise={1} only={['promise']} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 31, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          You kept this week's{' '}
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 35 }}>
            promise
          </span>
        </div>
        <div
          style={{
            fontSize: 27,
            fontWeight: 600,
            color: L.inkMuted,
            marginTop: 8 * (1 - collapse),
            height: 36 * (1 - collapse),
            opacity: 1 - gone,
            filter: gone > 0.01 ? `blur(${gone * 16}px)` : undefined,
            transform: `translateY(${gone * 46}px)`,
          }}
        >
          $25 · SpaceX
        </div>
      </div>
    </Card>
  )
}

function NudgeCard({ x, y, scale, rotY }: { x: number; y: number; scale: number; rotY: number }) {
  return (
    <Card
      width={600}
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) perspective(1600px) rotateY(${rotY}deg) scale(${scale})`,
        padding: '24px 30px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        boxSizing: 'border-box',
      }}
    >
      <Img src={staticFile('3d/bell.png')} style={{ width: 86, height: 86, flex: 'none' }} />
      <div style={{ fontSize: 31, fontWeight: 600, letterSpacing: '-0.02em' }}>
        A nudge from your circle
      </div>
    </Card>
  )
}

export function Circle({ beat, spb, fpb }: Clock) {
  if (beat < 84 || beat > SECTION.year + 0.05) return null
  if (beat >= 112) return <Field beat={beat} spb={spb} fpb={fpb} />

  const cam = camera(beat)
  const chrome = span(beat, 84, 85.6)
  const friendsIn = span(beat, 84.8, 87.4, easeOut)
  const phonesOut = span(beat, 111.2, 112, easeIn)

  const theirs = span(beat, THEIRS_CLOSE - 1, THEIRS_CLOSE, easeInOut)
  const devValue = lerp(0.35, 1, theirs)

  // The card: lift, shed, split, land.
  const lift = spring((beat - CARD_LIFT) * spb, { w: 9, z: 0.85 })
  const shed = span(beat, CARD_SHED, CARD_SHED + 1.4, (t) => t)
  const split = span(beat, 94, CARD_LAND, easeInOut)
  const liftFrom = onScreen(OURS, SCREEN.w / 2, 480)
  const hover = { x: CX, y: 330 }
  const landAt = (phone: typeof MAYA) => onScreen(phone, SCREEN.w / 2, 80)

  const bell = span(beat, NUDGE_SEND, NUDGE_LAND, easeInOut)
  const bellFrom = OUR_RING_AT
  const bellTo = onScreen(DEV, SCREEN.w / 2, 200)
  const nudge = spring((beat - NUDGE_LAND) * spb, { w: 13, z: 0.65 })

  const devRing = friendRing(DEV)

  return (
    <Camera zoom={cam.zoom} fx={cam.fx} fy={cam.fy}>
      <div style={{ opacity: 1 - phonesOut }}>
        <Phone {...MAYA} x={lerp(MAYA.x - 260, MAYA.x, friendsIn)} opacity={friendsIn}>
          <FriendScreen name="Maya" value={1} status="Kept this week" />
        </Phone>
        <Phone {...DEV} x={lerp(DEV.x + 260, DEV.x, friendsIn)} opacity={friendsIn}>
          <FriendScreen
            name="Dev"
            value={devValue}
            status={theirs >= 1 ? 'Kept this week' : '2 days left'}
          />
        </Phone>
        <Phone {...OURS} bezel={chrome}>
          <OurScreen beat={beat} spb={spb} chrome={chrome} />
        </Phone>
      </div>

      {/* The moment, lifting off our screen. */}
      {beat >= CARD_LIFT && beat < 94 && (
        <ShareCard
          x={lerp(liftFrom.x, hover.x, lift)}
          y={lerp(liftFrom.y, hover.y, lift)}
          scale={lerp(0.3, 1.3, lift)}
          rotY={0}
          shed={shed}
          opacity={clamp(lift * 2)}
        />
      )}
      {beat >= 94 &&
        [MAYA, DEV].map((phone, k) => {
          const to = landAt(phone)
          return (
            <div key={k} style={{ opacity: 1 - phonesOut }}>
              <ShareCard
                x={lerp(hover.x, to.x, split)}
                y={lerp(hover.y, to.y, split) - Math.sin(Math.PI * split) * 110}
                scale={lerp(1.3, 0.36, split)}
                rotY={lerp(0, phone.rotY, split)}
                shed={1}
                opacity={1}
              />
            </div>
          )
        })}

      {/* Reactions coming back. */}
      {REACTION.map((r, k) => {
        const t = span(beat, REACTIONS[k]! - 1.1, REACTIONS[k]!, easeInOut)
        if (t <= 0 || t >= 1) return null
        const from = friendRing(r.from)
        const to = onScreen(OURS, CHIPS[k]!, 568)
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: lerp(from.x, to.x, t),
              top: lerp(from.y, to.y, t) - Math.sin(Math.PI * t) * 190,
              transform: `translate(-50%, -50%) scale(${lerp(1.25, 0.42, t)})`,
              fontSize: 76,
            }}
          >
            {r.emoji}
          </div>
        )
      })}

      {/* The nudge. */}
      {bell > 0 && bell < 1 && (
        <Img
          src={staticFile('3d/bell.png')}
          style={{
            position: 'absolute',
            left: lerp(bellFrom.x, bellTo.x, bell) - 100,
            top: lerp(bellFrom.y, bellTo.y, bell) - Math.sin(Math.PI * bell) * 230 - 100,
            width: 200,
            height: 200,
            transform: `rotate(${Math.sin(beat * 9) * 16 * (1 - bell)}deg) scale(${lerp(1, 0.4, bell)})`,
          }}
        />
      )}
      {nudge > 0 && (
        <div style={{ opacity: 1 - phonesOut }}>
          <NudgeCard x={bellTo.x} y={bellTo.y} scale={0.36 * nudge} rotY={DEV.rotY} />
        </div>
      )}
      <Confetti
        seconds={(beat - THEIRS_CLOSE) * spb}
        x={devRing.x}
        y={devRing.y}
        radius={63}
        count={34}
        seed={9}
        power={0.5}
      />
    </Camera>
  )
}

// ── The field of circles ─────────────────────────────────────────────────────────────────

const CELL = 170
const GLYPH = 90
const COLS = 5
const ROWS = 3

/** The three we know, handed over from the phones to the grid. */
const KNOWN = [
  {
    c: 0,
    r: 0,
    from: () => project(111.9, OUR_RING_AT.x, OUR_RING_AT.y),
    size: OUR_RING.size * OURS.scale,
  },
  {
    c: -2,
    r: 0,
    from: () => project(111.9, friendRing(MAYA).x, friendRing(MAYA).y),
    size: FRIEND_RING.size * MAYA.scale,
  },
  {
    c: 2,
    r: 0,
    from: () => project(111.9, friendRing(DEV).x, friendRing(DEV).y),
    size: FRIEND_RING.size * DEV.scale,
  },
]

/** Alternate rows sit half a cell over, so the field packs like a crowd rather than a table. */
function cellAt(c: number, r: number) {
  return { x: CX + (c + (r % 2 ? 0.5 : 0)) * CELL, y: CY + r * CELL * 0.88 }
}

/** When the wave reaches a cell. Quantised to eighth notes so every click is on the grid. */
export function waveBeat(c: number, r: number) {
  const { x, y } = cellAt(c, r)
  return WAVE_START + Math.round((Math.hypot(x - CX, y - CY) / CELL) * 1.1) * WAVE_STEP
}

function Field({ beat, spb }: Clock) {
  const settle = span(beat, 112, 113.5, easeInOut)
  const push = span(beat, 118, SECTION.year, easeInOut)
  // Into ours until it is exactly the size of week one in the year's row.
  const zoom = Math.pow(WEEK_SIZE / GLYPH, push)
  const othersOut = span(beat, 118.2, 119.4, easeOut)

  const glyphs: React.ReactNode[] = []
  for (let r = -ROWS; r <= ROWS; r++) {
    for (let c = -COLS; c <= COLS; c++) {
      const known = KNOWN.find((k) => k.c === c && k.r === r)
      const d = Math.hypot(c, r)
      const cell = cellAt(c, r)
      const cellX = cell.x
      const cellY = cell.y
      // Further out reads as further away.
      const depth = 1 - 0.28 * clamp(Math.hypot(cellX - CX, cellY - CY) / 820)
      let x = cellX
      let y = cellY
      let size = GLYPH * depth
      let value = 1
      let show = 1
      if (known) {
        const from = known.from()
        x = lerp(from.x, cellX, settle)
        y = lerp(from.y, cellY, settle)
        size = lerp(known.size * 0.5, GLYPH, settle)
      } else {
        show = span(beat, 112.3 + d * 0.16, 113.1 + d * 0.16, easeOut)
        const seed = (c + 10) * 31 + (r + 10) * 7
        const start = 0.12 + rand(seed) * 0.55
        const at = waveBeat(c, r)
        value = lerp(start, 1, span(beat, at - 0.32, at, easeOut))
      }
      const at = waveBeat(c, r)
      const flash = known ? 0 : Math.sin(Math.PI * span(beat, at - 0.05, at + 0.45, (t) => t))
      const fade = known && c === 0 ? 1 : 1 - othersOut
      if (show <= 0.001) continue
      glyphs.push(
        <div
          key={`${c},${r}`}
          style={{
            position: 'absolute',
            left: x - size / 2,
            top: y - size / 2,
            opacity: show * fade,
            transform: `scale(${(0.6 + 0.4 * show) * (1 + 0.14 * flash)})`,
          }}
        >
          <Rings size={size} promise={value} only={['promise']} detail="glyph" />
        </div>,
      )
    }
  }

  return (
    <Camera zoom={zoom} fx={CX} fy={CY}>
      {glyphs}
    </Camera>
  )
}

export function CircleWords({ beat }: Clock) {
  return (
    <>
      <Caption
        beat={beat}
        at={88.2}
        out={92.1}
        y={104}
        size={58}
        words={['Your circle', { accent: 'sees it.' }]}
      />
      <Caption
        beat={beat}
        at={92.6}
        out={100.6}
        y={104}
        size={58}
        words={['Never', { accent: 'how much.' }]}
      />
      <Caption
        beat={beat}
        at={103.8}
        out={107.6}
        y={104}
        size={58}
        words={['A nudge from your', { accent: 'circle.' }]}
      />
      <Caption
        beat={beat}
        at={108.2}
        out={112}
        y={104}
        size={58}
        words={['Back on', { accent: 'track.' }]}
      />
    </>
  )
}
