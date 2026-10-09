import type { Metadata } from 'next'
import { Deck } from './deck'

/**
 * The pitch deck, twelve slides, one idea each: the problem, the product, the market, the model
 * and the way to it. No team, traction or ask slides yet; how it is built lives in the repo.
 *
 * Every screen in it is a photograph of the real app (video/scripts/app-shots.mjs) and
 * every ring is the real component, so the deck cannot show a product that does not
 * exist. Arrow keys or a click move between slides; printing gives one slide per page,
 * which is how the PDF in docs/ is made.
 */
export const metadata: Metadata = {
  title: 'KEPT — deck',
  robots: { index: false, follow: false },
}

export default function DeckPage() {
  return <Deck />
}
