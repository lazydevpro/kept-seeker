import React from 'react'
import { Composition, Still } from 'remotion'
import { Launch } from './Launch'
import { FPS as TROOP_FPS, TOTAL_FRAMES } from './edit'
import { NextWeek, calculateNextWeekMetadata, type NextWeekProps } from './next-week/NextWeek'
import { FPS, TRACKS, filmFrames } from './next-week/tracks'
import { DEFAULT_VOICE } from './next-week/voice'
import { ShowcaseThumbnail, Thumbnail, type ThumbnailProps } from './next-week/thumbnail'
import { CUTDOWN, SCENES, layout } from './product/film'
import {
  ProductFilm,
  RESTING_QUOTES,
  calculateProductMetadata,
  type ProductFilmProps,
} from './product/ProductFilm'

/**
 * Two films, three cuts each.
 *
 * The alternate aspects are not crops of a finished 16:9 render — they are the same component
 * laid out at a different frame size, so type rescales and content re-centres instead of being
 * sliced. Both films derive their type scale from `width`, which is what makes that work.
 */
export function RemotionRoot() {
  const troop = { component: Launch, durationInFrames: TOTAL_FRAMES, fps: TROOP_FPS } as const

  const full = layout(SCENES).total
  const short = layout(SCENES.filter((s) => CUTDOWN.includes(s.id))).total

  const product = {
    component: ProductFilm,
    fps: FPS,
    calculateMetadata: calculateProductMetadata,
    defaultProps: { quotes: RESTING_QUOTES, live: 'Captured prices' } as ProductFilmProps,
  } as const

  return (
    <>
      {/* "Next week" — the product video. One composition per track, for comparing scores,
          each with and without the voiceover (`-vo`, made by scripts/voiceover.mjs). */}
      {TRACKS.flatMap((track) =>
        [null, DEFAULT_VOICE].map((voice) => (
          <Composition
            key={`${track.id}-${voice ?? 'none'}`}
            id={`${track.id === 'score' ? 'NextWeek' : `NextWeek-${track.id}`}${voice ? '-vo' : ''}`}
            component={NextWeek}
            fps={FPS}
            width={1920}
            height={1080}
            durationInFrames={filmFrames(track.bpm)}
            defaultProps={{ track: track.id, voice } satisfies NextWeekProps}
            calculateMetadata={calculateNextWeekMetadata}
          />
        )),
      )}

      {/* Its thumbnail, at YouTube's 1280 × 720 — the hook, and the brand line on cream. */}
      <Still
        id="Thumbnail"
        component={Thumbnail}
        width={1280}
        height={720}
        defaultProps={{ variant: 'never' } satisfies ThumbnailProps}
      />
      <Still
        id="Thumbnail-compound"
        component={Thumbnail}
        width={1280}
        height={720}
        defaultProps={{ variant: 'compound' } satisfies ThumbnailProps}
      />
      {/* The app itself: the name on the left, the phone with the real screen on the right. */}
      <Still id="Thumbnail-showcase" component={ShowcaseThumbnail} width={1280} height={720} />

      {/* The generated-footage piece — social, marketing. */}
      <Composition id="Launch" {...troop} width={1920} height={1080} />
      <Composition id="LaunchVertical" {...troop} width={1080} height={1920} />
      <Composition id="LaunchSquare" {...troop} width={1080} height={1080} />

      {/* The product film — pure motion graphics, live prices at render time. */}
      <Composition id="Product" {...product} durationInFrames={full} width={1920} height={1080} />
      <Composition
        id="ProductVertical"
        {...product}
        durationInFrames={full}
        width={1080}
        height={1920}
      />
      <Composition
        id="ProductSquare"
        {...product}
        durationInFrames={full}
        width={1080}
        height={1080}
      />

      {/* Scenes 1, 3, 5, 8. `miss` survives every cut. */}
      <Composition
        id="ProductShort"
        {...product}
        durationInFrames={short}
        width={1920}
        height={1080}
        defaultProps={{ ...product.defaultProps, only: CUTDOWN }}
      />
    </>
  )
}
