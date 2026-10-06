import React, { useId } from 'react'
import { lightColors, darkColors } from '@/lib/tokens.generated'
import { SANS, SERIF } from '../fonts'
import { clamp, easeIn, easeOut, rand, span } from './motion'

/**
 * The film's parts. Everything is laid out in a fixed 1920 × 1080 design space; the root
 * scales that to the output, so every number in the scenes is a pixel at 1080p.
 */

export const W = 1920
export const H = 1080
export const CX = W / 2
export const CY = H / 2

export const INK = lightColors.ink
export const CREAM = lightColors.background
export const L = lightColors
export const D = darkColors

// ── Type ──────────────────────────────────────────────────────────────────────────────────

/** A line, as plain words and at most one accent word set in the serif. */
export type Words = (string | { accent: string })[]

/**
 * One line of type. Words rise out of a blur one after another and leave upward — the way
 * they would if the camera were moving past them, which is the only way anything leaves.
 */
export function Caption({
  beat,
  at,
  out,
  words,
  x = CX,
  y,
  size = 64,
  color = INK,
  align = 'center',
  stagger = 0.14,
}: {
  beat: number
  at: number
  out: number
  words: Words
  x?: number
  y: number
  size?: number
  color?: string
  align?: 'center' | 'left'
  stagger?: number
}) {
  if (beat < at - 0.05 || beat > out + 0.7) return null

  const tokens: { text: string; accent: boolean }[] = []
  for (const part of words) {
    if (typeof part === 'string') {
      for (const w of part.split(' ').filter(Boolean)) tokens.push({ text: w, accent: false })
    } else {
      for (const w of part.accent.split(' ').filter(Boolean)) tokens.push({ text: w, accent: true })
    }
  }
  const leave = span(beat, out, out + 0.55, easeIn)

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: align === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)',
        whiteSpace: 'nowrap',
        color,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.025em',
        lineHeight: 1.1,
      }}
    >
      {tokens.map((token, i) => {
        const t = span(beat, at + i * stagger, at + i * stagger + 0.85, easeOut)
        const opacity = t * (1 - leave)
        const dy = (1 - t) * size * 0.45 - leave * size * 0.4
        const blur = (1 - t) * 12 + leave * 12
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: i === tokens.length - 1 ? 0 : '0.26em',
              opacity,
              transform: `translateY(${dy}px)`,
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              ...(token.accent
                ? {
                    fontFamily: SERIF,
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: size * 1.14,
                    letterSpacing: 0,
                  }
                : null),
            }}
          >
            {token.text}
          </span>
        )
      })}
    </div>
  )
}

// ── Light ─────────────────────────────────────────────────────────────────────────────────

/** A soft bloom of colour. The film's only gradient, and never a hard edge. */
export function Glow({
  x,
  y,
  r,
  color,
  opacity,
}: {
  x: number
  y: number
  r: number
  color: string
  opacity: number
}) {
  if (opacity <= 0.001) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, ${color}00 68%)`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}

/** Light falls off toward every edge, so the camera seems to move through space, not past a border. */
export function Vignette({ color, strength }: { color: string; strength: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 75% 70% at 50% 50%, ${color}00 55%, ${color} 100%)`,
        opacity: strength,
        pointerEvents: 'none',
      }}
    />
  )
}

// ── Camera ────────────────────────────────────────────────────────────────────────────────

/**
 * The camera. Children are laid out in frame space; this puts `focus` at the centre of the
 * frame at `zoom`. Every section change in the film is this moving, not a scene swapping.
 */
export function Camera({
  zoom = 1,
  fx = CX,
  fy = CY,
  children,
}: {
  zoom?: number
  fx?: number
  fy?: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: W,
        height: H,
        transformOrigin: '0 0',
        transform: `translate(${CX}px, ${CY}px) scale(${zoom}) translate(${-fx}px, ${-fy}px)`,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Directional motion blur. CSS blur is round; a moving camera smears along its direction,
 * so this is an SVG filter with separate x and y deviations, set from the camera's speed.
 */
export function Smear({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const id = useId().replace(/:/g, '')
  const sx = Math.min(Math.abs(x), 60)
  const sy = Math.min(Math.abs(y), 60)
  if (sx < 0.4 && sy < 0.4) return <>{children}</>
  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={`smear-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={`${sx} ${sy}`} />
        </filter>
      </svg>
      <div style={{ position: 'absolute', inset: 0, filter: `url(#smear-${id})` }}>{children}</div>
    </>
  )
}

// ── Objects ───────────────────────────────────────────────────────────────────────────────

/** An outline circle — the to-do's checkbox, and the friends before they have rings. */
export function Hoop({
  x,
  y,
  r,
  stroke,
  width,
  opacity = 1,
}: {
  x: number
  y: number
  r: number
  stroke: string
  width: number
  opacity?: number
}) {
  const size = r * 2 + width * 2
  return (
    <svg
      width={size}
      height={size}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        opacity,
        overflow: 'visible',
      }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={width} />
    </svg>
  )
}

export const PHONE = { w: 410, h: 880, r: 68, bezel: 11 }
export const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2, r: 57 }

/** Where a point on a phone's screen lands in the frame. Ignores the phone's slight turn. */
export function onScreen(phone: { x: number; y: number; scale: number }, sx: number, sy: number) {
  return {
    x: phone.x + (sx - SCREEN.w / 2) * phone.scale,
    y: phone.y + (sy - SCREEN.h / 2) * phone.scale,
  }
}

/**
 * A phone. The screen is cream — the same cream as the film — so the camera can fly out of
 * the film and find itself on a screen without anything changing colour.
 */
export function Phone({
  x,
  y,
  scale = 1,
  rotY = 0,
  opacity = 1,
  blur = 0,
  bezel = 1,
  rim,
  children,
}: {
  x: number
  y: number
  scale?: number
  rotY?: number
  opacity?: number
  blur?: number
  /** The frame and shadow fade separately, so a screen can be all there is. */
  bezel?: number
  /** A thin light edge round the frame, so a dark phone still reads on a dark background. */
  rim?: string
  children?: React.ReactNode
}) {
  if (opacity <= 0.001) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x - PHONE.w / 2,
        top: y - PHONE.h / 2,
        width: PHONE.w,
        height: PHONE.h,
        transform: `perspective(2600px) rotateY(${rotY}deg) scale(${scale})`,
        opacity,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: PHONE.r,
          background: '#15181A',
          boxShadow: `${rim ? `inset 0 0 0 2px ${rim}, ` : ''}0 40px 90px rgba(11,15,10,0.22), 0 10px 24px rgba(11,15,10,0.12)`,
          opacity: bezel,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: PHONE.bezel,
          top: PHONE.bezel,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: SCREEN.r,
          background: CREAM,
          overflow: 'hidden',
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            left: SCREEN.w / 2 - 58,
            top: 14,
            width: 116,
            height: 34,
            borderRadius: 17,
            background: '#0B0D0E',
            opacity: bezel,
          }}
        />
      </div>
    </div>
  )
}

/** A small notification or share card, as it appears on a screen. */
export function Card({
  width,
  children,
  style,
}: {
  width: number
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width,
        background: '#FFFFFF',
        borderRadius: 30,
        boxShadow: '0 22px 50px rgba(11,15,10,0.14), 0 4px 12px rgba(11,15,10,0.08)',
        fontFamily: SANS,
        color: INK,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const CONFETTI = [L.kiwi, L.grape, L.coral, L.sun, L.sky]

/** A burst from a ring's edge. Seeded, so every render throws the same confetti. */
export function Confetti({
  seconds,
  x,
  y,
  radius,
  count = 70,
  seed = 1,
  power = 1,
}: {
  /** Seconds since the burst. */
  seconds: number
  x: number
  y: number
  radius: number
  count?: number
  seed?: number
  power?: number
}) {
  if (seconds < 0 || seconds > 3) return null
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = rand(seed * 97 + i) * Math.PI * 2
        const v = (520 + rand(seed * 31 + i * 7) * 1000) * power
        const k = 2.4
        const travel = (v / k) * (1 - Math.exp(-k * seconds))
        const px = x + Math.cos(a) * (radius + travel)
        const py = y + Math.sin(a) * (radius + travel) + 520 * seconds * seconds * power
        const spin = rand(seed + i * 13) * 360 + seconds * (rand(i + seed) - 0.5) * 900
        const fade = 1 - clamp((seconds - 1.1) / 0.9)
        const round = i % 3 === 0
        const s = (round ? 12 : 17) * (0.7 + rand(i * 3 + seed) * 0.6) * Math.max(power, 0.6)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px - s / 2,
              top: py - s / 4,
              width: s,
              height: round ? s : s * 0.55,
              borderRadius: round ? '50%' : 3,
              background: CONFETTI[i % CONFETTI.length],
              transform: `rotate(${spin}deg)`,
              opacity: fade,
            }}
          />
        )
      })}
    </>
  )
}
