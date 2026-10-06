import React from 'react'
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion'
import { Rings } from '@/components/rings'
import { SANS, SERIF } from '../fonts'
import { CREAM, D, Glow, H, INK, L, Phone, SCREEN, W } from './parts'

/**
 * The thumbnail for "Next week" — the film's own pieces, still: the three rings of the end
 * and one line in the captions' type, the accent word in the serif.
 *
 * Four words at most, big enough to read at the size a phone lists videos. No money figure:
 * out of the film, it would be a return claim without its footnote.
 *
 *   npx remotion still Thumbnail out/kept-next-week-thumbnail.png
 *   npx remotion still Thumbnail-compound out/kept-next-week-thumbnail-compound.png
 */

export type ThumbnailProps = { variant: 'never' | 'compound' }

const RINGS = { x: 1480, y: 540, size: 620 }

export function Thumbnail({ variant }: ThumbnailProps) {
  const { width } = useVideoConfig()
  const dark = variant === 'never'
  const ink = dark ? CREAM : INK
  const accent = dark ? D.kiwi : L.kiwiDeep
  const [first, accentWord, last] =
    variant === 'never' ? ['Next week', 'never', 'comes.'] : ['Promises', 'compound.', '']

  return (
    <AbsoluteFill style={{ background: dark ? INK : CREAM, overflow: 'hidden' }}>
      {/* Laid out on the film's 1920 × 1080 stage, scaled to whatever size is asked for. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: '0 0',
          transform: `scale(${width / W})`,
        }}
      >
        <Glow
          x={RINGS.x + 60}
          y={RINGS.y - 180}
          r={560}
          color={dark ? D.kiwi : L.kiwi}
          opacity={dark ? 0.32 : 0.22}
        />
        <Glow
          x={RINGS.x - 220}
          y={RINGS.y + 170}
          r={480}
          color={D.grape}
          opacity={dark ? 0.26 : 0.14}
        />
        <Glow
          x={RINGS.x + 240}
          y={RINGS.y + 120}
          r={440}
          color={D.coral}
          opacity={dark ? 0.22 : 0.12}
        />

        <div
          style={{
            position: 'absolute',
            left: RINGS.x - RINGS.size / 2,
            top: RINGS.y - RINGS.size / 2,
          }}
        >
          <Rings
            size={RINGS.size}
            promise={1}
            goal={0.8}
            circle={0.92}
            mode={dark ? 'dark' : 'light'}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 130,
            top: 0,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 150,
            lineHeight: 1.02,
            letterSpacing: '-0.045em',
            color: ink,
          }}
        >
          <div>{first}</div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 176,
                letterSpacing: '-0.01em',
                color: accent,
              }}
            >
              {accentWord}
            </span>
            {last && ` ${last}`}
          </div>
        </div>

        {/* The mark and the name, where a channel's logo would sit. */}
        <div
          style={{
            position: 'absolute',
            left: 136,
            bottom: 92,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <div
            style={{
              width: 84,
              height: 57,
              background: accent,
              WebkitMaskImage: `url(${staticFile('promise.svg')})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 54,
              letterSpacing: '0.04em',
              color: ink,
            }}
          >
            KEPT
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── The app showcase ─────────────────────────────────────────────────────────────────────

/**
 * The app, shown: the mark and the name on the left, the phone on the right with the real
 * "This week" screen — the three rings the film is about, on the app itself. Dark, like the
 * hook thumbnail, so it stands out on a white page.
 *
 * The screen is a real capture: `web/public/deck/shots/home-kept.jpg`, made by
 * `scripts/app-shots.mjs`, copied to `public/showcase/`. Re-shoot and copy it when the app changes.
 *
 *   npx remotion still Thumbnail-showcase out/kept-showcase-thumbnail.png
 */

const SHOWCASE_PHONE = { x: 1395, y: 540, scale: 1.07, turn: -9 }
/** The capture is 1170 × 2532; it sits under a status bar, fitted to the screen's height. */
const SHOT = { top: 50, h: SCREEN.h - 50, aspect: 1170 / 2532 }

function StatusBar() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: SCREEN.w,
        height: SHOT.top,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 34px 0 40px',
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 15,
        color: INK,
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {[5, 8, 11, 14].map((h) => (
          <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: INK }} />
        ))}
        <span
          style={{
            marginLeft: 6,
            width: 24,
            height: 12,
            borderRadius: 3.5,
            border: `1.5px solid ${INK}`,
            padding: 1.5,
            display: 'flex',
          }}
        >
          <span style={{ flex: 1, borderRadius: 1.5, background: INK }} />
        </span>
      </span>
    </div>
  )
}

export function ShowcaseThumbnail() {
  const { width } = useVideoConfig()
  const shotW = SHOT.h * SHOT.aspect
  return (
    <AbsoluteFill style={{ background: INK, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: '0 0',
          transform: `scale(${width / W})`,
        }}
      >
        {/* Light falls round the phone, in the rings' three colours. */}
        <Glow x={SHOWCASE_PHONE.x + 40} y={330} r={620} color={D.kiwi} opacity={0.3} />
        <Glow x={SHOWCASE_PHONE.x - 300} y={780} r={520} color={D.grape} opacity={0.24} />
        <Glow x={SHOWCASE_PHONE.x + 320} y={760} r={460} color={D.coral} opacity={0.2} />
        <Glow x={480} y={540} r={520} color={D.kiwi} opacity={0.08} />

        <Phone
          x={SHOWCASE_PHONE.x}
          y={SHOWCASE_PHONE.y}
          scale={SHOWCASE_PHONE.scale}
          rotY={SHOWCASE_PHONE.turn}
          rim="rgba(251,251,244,0.16)"
        >
          <StatusBar />
          <Img
            src={staticFile('showcase/home-kept.jpg')}
            style={{
              position: 'absolute',
              top: SHOT.top,
              left: (SCREEN.w - shotW) / 2,
              width: shotW,
              height: SHOT.h,
            }}
          />
        </Phone>

        {/* The mark over the name: the film's end card, set large. */}
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 0,
            height: H,
            width: 640,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          <div
            style={{
              width: 330,
              height: 224,
              background: D.kiwi,
              WebkitMaskImage: `url(${staticFile('promise.svg')})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
          />
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 196,
              lineHeight: 1,
              letterSpacing: '0.03em',
              color: CREAM,
              whiteSpace: 'nowrap',
            }}
          >
            KEPT
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
