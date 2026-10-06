/**
 * Renders all three cuts.
 *
 * Sequential rather than parallel on purpose: Remotion already uses every core for one
 * render, so running three at once just makes each of them slower and the machine unusable.
 *
 *   node scripts/render.mjs            # all three
 *   node scripts/render.mjs Launch     # one
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const CUTS = [
  // "Next week" — the product video. Needs `npm run score` first for its audio.
  { id: 'NextWeek', out: 'out/kept-next-week-16x9.mp4' },
  // The same film on NastelBom – Product. Needs the MP3 in public/next-week/music/ (see tracks.ts).
  { id: 'NextWeek-product', out: 'out/kept-next-week-16x9-product.mp4' },
  // Both again with the voiceover. Needs `npm run voiceover` first (a Gemini key; see voice.ts).
  { id: 'NextWeek-product-vo', out: 'out/kept-next-week-16x9-product-vo.mp4' },
  { id: 'NextWeek-vo', out: 'out/kept-next-week-16x9-vo.mp4' },
  // The generated-footage piece.
  { id: 'Launch', out: 'out/kept-troop-16x9.mp4' },
  { id: 'LaunchVertical', out: 'out/kept-troop-9x16.mp4' },
  { id: 'LaunchSquare', out: 'out/kept-troop-1x1.mp4' },
  // The product film. Each of these refetches prices, so each carries its own timestamp.
  { id: 'Product', out: 'out/kept-product-16x9.mp4' },
  { id: 'ProductVertical', out: 'out/kept-product-9x16.mp4' },
  { id: 'ProductSquare', out: 'out/kept-product-1x1.mp4' },
  { id: 'ProductShort', out: 'out/kept-product-30s.mp4' },
]

const only = process.argv[2]
const wanted = only ? CUTS.filter((c) => c.id === only) : CUTS

if (wanted.length === 0) {
  console.error(`Unknown composition "${only}". Try one of: ${CUTS.map((c) => c.id).join(', ')}`)
  process.exit(1)
}

mkdirSync('out', { recursive: true })

for (const cut of wanted) {
  console.log(`\n  → ${cut.id}  ${cut.out}`)
  const result = spawnSync(
    'npx',
    [
      'remotion',
      'render',
      cut.id,
      cut.out,
      '--codec',
      'h264',
      '--crf',
      '18',
      '--color-space',
      'bt709',
      '--log',
      'error',
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) {
    console.error(`\n  ${cut.id} failed.`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n  Done.\n')
