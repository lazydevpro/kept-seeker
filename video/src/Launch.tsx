import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { lightColors } from '@/lib/tokens.generated'
import { Rings } from '@/components/rings'
import {
  FOOTAGE_FRAMES,
  FPS,
  OFFSETS,
  screenFrames,
  segmentFrames,
  TIMELINE,
  type Caption as CaptionData,
  type Segment,
  type Shot,
} from './edit'
import { SANS, SERIF } from './fonts'

/**
 * KEPT — the troop film.
 *
 * Generated footage carries the gag; Remotion carries every word and the product. Two things
 * are load-bearing:
 *
 * 1. **The copy stays deadpan.** Epic primate cinema with flat captions about a twenty-dollar
 *    weekly habit. The contrast is the joke, and it is the only version where clicking through
 *    does not find a product that contradicts the ad.
 * 2. **The ending is not a joke.** The film closes on two pinkies hooking, which is literally
 *    KEPT's mark — `promise.svg` is a pinky promise, "the gesture the product is named after".
 *    So the last seven seconds dissolve live pinkies → the mark → the three rings. Footage
 *    becomes logo becomes product, and the landing is clean.
 *
 * The rings are the real `<Rings>` from `web/components/rings.tsx`, aliased in
 * `remotion.config.ts`. Not a copy, not a lookalike — the same component the app and the
 * landing page draw, so the film cannot show a product that does not exist.
 */

const CREAM = lightColors.inkInverse
const INK = lightColors.ink

/** ── Footage ─────────────────────────────────────────────────────────────────────────── */

/**
 * The two trim props do not measure the same thing once `playbackRate` is involved, which is
 * not obvious and cost two wrong renders to pin down:
 *
 *   `trimBefore` places the playhead at that **source** frame.
 *   `trimAfter`  caps playback at that many **composition** frames.
 *
 * So `trimAfter={shot.to}` looks right and is not: at rate 0.85 a 47-frame shot needs 55
 * composition frames, the cap fires at 47, and the last 8 render black. Every shot in the
 * film had a black tail, each looking like a deliberate cut rather than a bug.
 *
 * Scaling *both* values by the rate fixes the black and breaks the content instead — the
 * footage then starts late, and "Week 3." lands on the wrong shot.
 *
 * Only the cap needs converting. Leave `trimBefore` in source frames and give `trimAfter` the
 * segment's own length, at which point the playhead travels exactly `from → to`:
 *
 *   from + screenFrames * rate  =  from + (to - from) / rate * rate  =  to
 */
function ShotClip({ shot }: { shot: Shot }) {
  return (
    <OffthreadVideo
      src={staticFile('troop.mp4')}
      trimBefore={shot.from}
      trimAfter={shot.from + screenFrames(shot)}
      playbackRate={shot.rate}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

/**
 * A scrim under the lower-third copy. The footage is a dim forest and the type is cream, so
 * most frames would be legible without it — but "most" is not a standard, and one bright
 * shaft of light behind a word is all it takes.
 */
function Scrim() {
  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(to top, rgba(6,10,6,0.78) 0%, rgba(6,10,6,0.35) 26%, transparent 52%)',
      }}
    />
  )
}

/** For the centred punch beats, which have no bottom edge to hide behind. */
function Vignette() {
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(6,10,6,0.50) 0%, rgba(6,10,6,0.28) 45%, transparent 75%)',
      }}
    />
  )
}

function Caption({ caption, size }: { caption: CaptionData; size: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const local = frame - (caption.atFrame ?? 0)
  const punch = caption.place === 'punch'

  // The punch beats overshoot slightly on the way in — the only place in the film with any
  // bounce, and it is there because "Week 3." is a joke landing, not a statement.
  const enter = spring({
    frame: local,
    fps,
    config: punch ? { damping: 14, mass: 0.6 } : { damping: 200 },
    durationInFrames: punch ? 22 : 18,
  })
  const opacity = interpolate(enter, [0, 0.35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const transform = punch
    ? `scale(${interpolate(enter, [0, 1], [0.86, 1])})`
    : `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`

  return (
    <AbsoluteFill
      style={{
        justifyContent: punch ? 'center' : 'flex-end',
        alignItems: punch ? 'center' : 'flex-start',
        padding: punch ? 0 : `0 ${size * 1.1}px ${size * 1.3}px`,
      }}
    >
      <p
        style={{
          margin: 0,
          opacity,
          transform,
          fontFamily: SANS,
          fontWeight: punch ? 800 : 700,
          fontSize: punch ? size * 1.6 : size,
          lineHeight: 1.12,
          letterSpacing: punch ? '-0.05em' : '-0.03em',
          color: CREAM,
          maxWidth: punch ? '90%' : '78%',
          textAlign: punch ? 'center' : 'left',
          textShadow: '0 2px 28px rgba(0,0,0,0.55)',
        }}
      >
        {caption.text}
        {caption.serif ? (
          <>
            {' '}
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400 }}>
              {caption.serif}
            </span>
          </>
        ) : null}
      </p>
    </AbsoluteFill>
  )
}

/** ── The bridge: mark → rings ────────────────────────────────────────────────────────── */

function Bridge({ caption, size }: { caption: string; size: number }) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()

  // The mark holds, then hands over to the rings. They cross-fade rather than cut, because
  // the point being made is that they are the same object.
  const markOut = interpolate(frame, [0.8 * fps, 1.5 * fps], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ringsIn = interpolate(frame, [1.0 * fps, 1.8 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const draw = spring({
    frame: frame - 1.0 * fps,
    fps,
    config: { damping: 200 },
    durationInFrames: 38,
  })
  const copy = interpolate(frame, [1.8 * fps, 2.4 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const ringSize = Math.round(width * 0.26)

  return (
    <AbsoluteFill style={{ background: INK, justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: markOut }}>
        <Img
          src={staticFile('promise.svg')}
          style={{ width: ringSize * 1.15, filter: 'brightness(0) invert(1)' }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: ringsIn }}>
        <Rings
          size={ringSize}
          promise={draw}
          goal={draw * 0.34}
          circle={draw * 0.86}
          label="Three rings: this week's promise, the goal, and the circle"
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: size * 1.5,
          paddingInline: size,
          opacity: copy,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: size * 0.6,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            color: CREAM,
            textAlign: 'center',
          }}
        >
          {caption}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** ── End card ────────────────────────────────────────────────────────────────────────── */

function EndCard({ size }: { size: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const line = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 })
  const url = interpolate(frame, [1.2 * fps, 1.8 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ background: INK, justifyContent: 'center', alignItems: 'center', gap: size * 0.55 }}
    >
      <p
        style={{
          margin: 0,
          opacity: line,
          transform: `translateY(${interpolate(line, [0, 1], [14, 0])}px)`,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: size * 1.25,
          letterSpacing: '-0.045em',
          color: CREAM,
          textAlign: 'center',
        }}
      >
        Promises{' '}
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400 }}>compound.</span>
      </p>
      <p
        style={{
          margin: 0,
          opacity: url,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: size * 0.4,
          letterSpacing: '0.08em',
          color: lightColors.kiwi,
        }}
      >
        kept-seeker.pages.dev
      </p>
    </AbsoluteFill>
  )
}

/** ── Composition ─────────────────────────────────────────────────────────────────────── */

function Body({ segment, size }: { segment: Segment; size: number }) {
  if (segment.kind === 'bridge') return <Bridge caption={segment.caption} size={size} />
  if (segment.kind === 'end') return <EndCard size={size} />

  return (
    <AbsoluteFill>
      <ShotClip shot={segment.shot} />
      {segment.caption ? (
        <>
          {segment.caption.place === 'punch' ? <Vignette /> : <Scrim />}
          <Caption caption={segment.caption} size={size} />
        </>
      ) : null}
    </AbsoluteFill>
  )
}

export function Launch() {
  const { width, height } = useVideoConfig()

  /*
   * One type scale for all three cuts, but it cannot be a flat fraction of `width`.
   *
   * A 16:9 frame has a wide column and plenty of room, so text at 5.2% of width reads fine.
   * The same fraction on a 1080×1920 portrait frame gives the same pixel size in a frame
   * being watched at a third the physical size — the end card came out looking like a
   * caption. Portrait needs the bigger share of a narrower frame; square sits between.
   */
  const ratio = height > width ? 0.075 : height === width ? 0.06 : 0.052
  const size = Math.round(width * ratio)

  return (
    <AbsoluteFill style={{ background: INK }}>
      {TIMELINE.map((segment, i) => (
        <Sequence
          key={i}
          from={OFFSETS[i]}
          durationInFrames={segmentFrames(segment)}
          premountFor={FPS}
        >
          <Body segment={segment} size={size} />
        </Sequence>
      ))}

      {/*
        One continuous bed under the whole footage section rather than audio on each clip.
        Every shot has its own `playbackRate`, so keeping audio on the clips would pitch-shift
        and chop it at each cut. Forest ambience does not need to sync to picture, so it runs
        straight through underneath and stops when the film leaves the forest.

        Placeholder sound. The score in docs/launch-film.md §2 — fifty-two recordings of one
        ceramic cup — replaces it, and the stick snapping becomes its first strike.
      */}
      <Sequence durationInFrames={FOOTAGE_FRAMES}>
        <Audio src={staticFile('troop.mp4')} volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  )
}
