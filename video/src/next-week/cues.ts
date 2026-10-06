/**
 * "Next week" — every moment in the film, in beats.
 *
 * The film is counted in beats, not seconds, so it can be laid against any track: the frame
 * of a beat depends on the track's tempo (see `tracks.ts`), and nothing in here does. At the
 * score's 120 BPM a beat is half a second, so beat 36 is 0:18.
 *
 * Plain values only — `scripts/score.mjs` imports this file straight into Node to compose
 * the score, so the music and the picture read their cues from the same place.
 */

/** The composed score's tempo. Other tracks bring their own. */
export const SCORE_BPM = 120

/** Section boundaries. Each hands an object to the next; none of them is a cut. */
export const SECTION = {
  problem: 0,
  stop: 22, // the hard stop — the music cuts here
  turn: 28,
  drop: 36, // the music comes back
  through: 42, // the camera flies through the ring
  promise: 44,
  invest: 60,
  buy: 76,
  kept: 80,
  shared: 88,
  ripple: 104,
  year: 120,
  money: 138, // the year's row pulls back to ten years of weeks
  end: 152,
  logo: 162, // the mark, then the wordmark
  out: 168,
} as const

export const TOTAL_BEATS = SECTION.out

/** Each push of the to-do into next week: [start, end]. They get faster. */
export const PUSHES: [number, number][] = [
  [8, 10],
  [11, 12.5],
  [13.5, 14.75],
  [15.5, 16.5],
  [17, 17.75],
  [18, 18.6],
]

/** After the last push the weeks stop being separate and streak past until the stop. */
export const STREAK: [number, number] = [18.75, SECTION.stop]

/** Pages crossed: one per push, then this many more in the streak. */
export const STREAK_PAGES = 14

/** The dial: $10 → $15 → $20 → $25, one step per beat. */
export const DIAL_STEPS = [50, 51, 52, 53]

/** Friends' circles arriving in the turn. */
export const ARRIVALS = [32, 33, 34]

/** The shared section. */
export const CARD_LIFT = 90
export const CARD_SHED = 92
export const CARD_LAND = 96
export const REACTIONS = [98, 99, 100]

/** The ripple. */
export const NUDGE_SEND = 104
export const NUDGE_LAND = 106
export const THEIRS_CLOSE = 108
export const WAVE_START = 114
export const WAVE_STEP = 0.5
export const WAVE_RINGS = 8

/** The three hits at the end. */
export const HITS = [SECTION.end, SECTION.end + 2, SECTION.end + 4]

/**
 * The year: where the camera is, in weeks, at a given beat. Starts on week 1, accelerates,
 * and eases onto week 52 — the resolution of the opening's hard stop.
 */
export const YEAR_FROM = SECTION.year
export const YEAR_TO = SECTION.money

export function yearWeek(beat: number) {
  const t = Math.min(Math.max((beat - YEAR_FROM) / (YEAR_TO - YEAR_FROM), 0), 1)
  // Slow start so weeks 1–4 read one by one, then fast, then a long settle onto 52.
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  return 1 + 51 * eased
}

/** The beat a given week crosses the centre of frame. */
export function weekBeat(week: number) {
  let lo: number = YEAR_FROM
  let hi: number = YEAR_TO
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (yearWeek(mid) < week) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * The money. The row of the year pulls back into ten years of weeks; the nine new rows fill
 * while the sum under them compounds; then the camera pushes into the very last week, which
 * becomes the three rings of the end. [start, end] each.
 */
export const MONEY_PULL: [number, number] = [SECTION.money + 0.8, SECTION.money + 4.4]
export const MONEY_FILL: [number, number] = [SECTION.money + 4.2, SECTION.money + 9]
export const MONEY_PUSH: [number, number] = [SECTION.money + 9.8, SECTION.end - 1]

/** The one week in the year that was not kept. The row keeps going. */
export const MISSED_WEEK = 19

/** Awards, on the week they are earned — the app's own titles and objects. */
export const AWARDS = [
  { week: 1, title: 'First promise', object: 'seedling' },
  { week: 4, title: 'First month', object: 'potted-plant' },
  { week: 8, title: 'Steady eight', object: 'fire' },
  { week: 26, title: 'Half a year', object: 'star' },
  { week: 52, title: 'A full year', object: 'trophy' },
] as const
