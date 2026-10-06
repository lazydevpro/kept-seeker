import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import type { CalculateMetadataFunction } from 'remotion'
import { EQUITIES, fetchQuotes, type Quote } from '@/lib/prices'
import { SCENES, boundaries, frames, layout, toneAt, type Scene, type SceneId } from './film'
import { palette, RingWipes, useScale } from './kit'
import {
  SceneAssets,
  SceneCircle,
  SceneClose,
  SceneMiss,
  ScenePrivacy,
  ScenePromise,
  SceneSawtooth,
  SceneYear,
} from './scenes'

export type ProductFilmProps = {
  /** Which scenes to include — the cutdown passes a subset. */
  only?: SceneId[]
  quotes: Quote[]
  live: string
}

/** The resting state, used before `calculateMetadata` resolves and if the fetch fails. */
export const RESTING_QUOTES: Quote[] = EQUITIES.map((listing) => ({
  symbol: listing.symbol,
  name: listing.name,
  kind: listing.kind,
  price: listing.capturedPrice,
  change24h: null,
  stale: true,
}))

/**
 * Prices are fetched **at render time**, not baked in.
 *
 * `lib/prices.ts` is the same module the landing page uses, so every render of this film
 * carries that morning's real market data and the chip can honestly say so. A product film
 * whose numbers are true on the day it ships is an unusual thing to be able to claim, and it
 * costs one call because the fetching was already written.
 *
 * `fetchQuotes` never rejects — it falls back to captured prices and flags them stale — so a
 * flaky network degrades the label rather than failing the render.
 */
export const calculateProductMetadata: CalculateMetadataFunction<ProductFilmProps> = async ({
  props,
}) => {
  // This film shows the stock shelf only; the site's ticker now carries crypto as well.
  const quotes = (await fetchQuotes()).filter((quote) => quote.kind === 'stock')
  const fresh = quotes.some((quote) => !quote.stale)
  const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  return {
    props: {
      ...props,
      quotes,
      live: fresh ? `Live · ${asOf}` : 'Captured prices',
    },
  }
}

export function ProductFilm({ only, quotes, live }: ProductFilmProps) {
  const frame = useCurrentFrame()
  const size = useScale()

  const scenes: Scene[] = only ? SCENES.filter((s) => only.includes(s.id)) : SCENES
  const { offsets } = layout(scenes)
  const tone = palette(toneAt(frame, scenes))

  const render = (id: SceneId) => {
    switch (id) {
      case 'promise':
        return <ScenePromise tone={tone} size={size} />
      case 'sawtooth':
        return <SceneSawtooth tone={tone} size={size} />
      case 'miss':
        return <SceneMiss tone={tone} size={size} />
      case 'circle':
        return <SceneCircle tone={tone} size={size} />
      case 'year':
        return <SceneYear tone={tone} size={size} />
      case 'assets':
        return <SceneAssets tone={tone} size={size} quotes={quotes} live={live} />
      case 'privacy':
        return <ScenePrivacy tone={tone} size={size} />
      case 'close':
        return <SceneClose tone={tone} size={size} />
    }
  }

  return (
    <AbsoluteFill style={{ background: tone.bg }}>
      {scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={offsets[i]}
          durationInFrames={frames(scene)}
          premountFor={24}
        >
          {render(scene.id)}
        </Sequence>
      ))}

      {/* The one transition, fired on every scene boundary. */}
      <RingWipes boundaries={boundaries(scenes)} colour={tone.bg} />
    </AbsoluteFill>
  )
}
