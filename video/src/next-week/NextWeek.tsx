import React from 'react'
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { CalculateMetadataFunction } from 'remotion'
import { SECTION } from './cues'
import { mixHex, span } from './motion'
import { CREAM, H, INK, Vignette, W } from './parts'
import { OpeningWords, Problem, Turn } from './opening'
import { Invest, InvestWords, Kept, PromiseScene, PromiseWords } from './middle'
import { Circle, CircleWords } from './circle'
import { End, Year, YearWords, endDark } from './closing'
import { Sound } from './sound'
import { FPS, TRACKS, filmFrames, framesPerBeat } from './tracks'
import type { Take } from './voice'

/**
 * "Next week" — the product video. See docs/product-video.md.
 *
 * One continuous shot. Each section is drawn by its own component, but none of them is a
 * scene in the editing sense: they overlap at their hand-offs, and at every hand-off the
 * outgoing object and the incoming one are the same size in the same place.
 */

export type NextWeekProps = {
  track: string
  /** A voiceover take made by `scripts/voiceover.mjs`, by voice name. None: music and effects only. */
  voice?: string | null
  /** Filled in from the take's manifest when the composition is resolved. */
  take?: Take | null
}

export const calculateNextWeekMetadata: CalculateMetadataFunction<NextWeekProps> = async ({
  props,
}) => {
  const track = TRACKS.find((t) => t.id === props.track) ?? TRACKS[0]!
  let take: Take | null = null
  if (props.voice) {
    const res = await fetch(staticFile(`next-week/vo/${props.voice}/take.json`))
    // Loud, not silent: a voiceover cut without its voice is the wrong film.
    if (!res.ok) {
      throw new Error(
        `No "${props.voice}" voiceover yet — run \`node scripts/voiceover.mjs\` first.`,
      )
    }
    take = (await res.json()) as Take
  }
  return { durationInFrames: filmFrames(track.bpm), fps: FPS, props: { ...props, take } }
}

/** Ink while you are alone; cream from the fly-through; ink again under the three rings. */
function background(beat: number) {
  if (beat < 43.85) return INK
  return mixHex(CREAM, INK, endDark(beat))
}

export function NextWeek({ track: id, take = null }: NextWeekProps) {
  const frame = useCurrentFrame()
  const { width } = useVideoConfig()
  const track = TRACKS.find((t) => t.id === id) ?? TRACKS[0]!
  const fpb = framesPerBeat(track.bpm)
  const clock = { beat: frame / fpb, spb: 60 / track.bpm, fpb }
  const { beat } = clock
  const bg = background(beat)
  const onInk = beat < 43.85 || beat > SECTION.end + 1
  const vignette = onInk ? 0.9 : 0.35 * (1 - span(beat, SECTION.end, SECTION.end + 1.5))

  return (
    <AbsoluteFill style={{ background: bg }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: H,
          overflow: 'hidden',
          transformOrigin: '0 0',
          transform: `scale(${width / W})`,
        }}
      >
        <Problem {...clock} />
        <Turn {...clock} />
        <PromiseScene {...clock} />
        <Invest {...clock} />
        <Kept {...clock} />
        <Circle {...clock} />
        <Year {...clock} />
        <End {...clock} />
        <Vignette color={onInk ? INK : CREAM} strength={vignette} />
        <OpeningWords {...clock} />
        <PromiseWords {...clock} />
        <InvestWords {...clock} />
        <CircleWords {...clock} />
        <YearWords {...clock} />
      </div>
      <Sound track={track} take={take} />
    </AbsoluteFill>
  )
}
