/**
 * The voiceover — what is said, and the beat each line starts on.
 *
 * Where a caption is up, the voice says the caption: the words on screen and the words heard
 * never disagree. The lines between captions tell the part the picture cannot: that this is
 * the promise you keep putting off.
 *
 * The whole script is spoken in ONE take (`scripts/voiceover.mjs`), then cut at the pauses and
 * laid on these beats, so every line is the same voice, the same read and the same level.
 * Change a word here and the take is regenerated; change only a beat and it is just re-laid.
 *
 * "kept" is written in lower case on purpose: capitalised, the voice read it as a name and it
 * came back sounding like "Capt." In lower case it is the ordinary word, which is the point.
 *
 * One sentence per line. The voice pauses after every sentence, so a line with two sentences
 * could not be told apart from two lines when the take is cut.
 *
 * Plain values only — the script imports this file straight into Node.
 */

/**
 * `silent`: recorded in the take but left out of the film. The take is cut against every line,
 * so a line the film no longer wants stays in the script, and the approved recording stays valid.
 */
export type Line = { at: number; text: string; silent?: boolean }

/** The texts the film plays without. */
export const SILENT_TEXTS = (): Set<string> =>
  new Set(LINES.filter((line) => line.silent).map((line) => line.text))

export const LINES: Line[] = [
  // The problem — the to-do appears, then gets pushed.
  { at: 0.5, text: 'You’ve been meaning to start investing.' },
  { at: 6.2, text: 'Next week, you tell yourself.' },
  // Each distraction as it scrolls past the middle of the frame.
  { at: 11, text: 'The weekend.' },
  { at: 13.6, text: 'A new phone.' },
  { at: 15.9, text: 'Later.' },
  // The hard stop: said into the silence.
  { at: 23.8, text: 'Next week never comes.' },
  { at: 29, text: 'Unless you’re not doing it alone.' },
  // The drop; the wordmark rises at 38.
  { at: 37.4, text: 'This is kept.' },
  { at: 45.8, text: 'Make one small promise.' },
  // The dial lands on $25 at 53.
  { at: 52.6, text: 'Twenty-five dollars.' },
  { at: 55.9, text: 'Every Friday.' },
  { at: 60.4, text: 'It lets you buy real stocks and crypto.' },
  // Private markets are off in the Seeker build (Oct 2026); the line stays in the take, unplayed.
  { at: 69, text: 'Even companies that aren’t public yet.', silent: true },
  // The ring closes on 80.
  { at: 81, text: 'Promise kept.' },
  { at: 88.2, text: 'Your circle sees you kept your promise.' },
  // The amount falls off the card at 92.
  { at: 93.6, text: 'Never how much.' },
  // Their reactions come back at 98, 99 and 100.
  { at: 97.6, text: 'And they cheer you on.' },
  { at: 103.8, text: 'Fall behind, and they’ll nudge you.' },
  // Their ring closes at 108.
  { at: 108.6, text: 'Back on track.' },
  // The pull-back to the crowd; the wave of rings closing starts at 114.
  { at: 112.6, text: 'It’s not just you.' },
  { at: 115.3, text: 'It’s everyone around you.' },
  { at: 121, text: 'Week after week.' },
  { at: 124.7, text: 'Month after month.' },
  // The missed week crosses frame at about 128.
  { at: 127.55, text: 'Miss a week, and just keep going.' },
  // The tally under the row counts up from 128.
  { at: 132.7, text: 'You barely notice it adding up.' },
  // Ten years fill and the tally compounds to $18,236 (closing.tsx), landing at about 146.
  {
    at: 139,
    text: 'Keep going for ten years, and it could grow to over eighteen thousand dollars.',
  },
  // The three hits at 152–156 are left alone.
  { at: 157.5, text: 'Promises compound.' },
  { at: 162.5, text: 'kept.' },
  { at: 164.3, text: 'Now in beta, on Android.' },
]

/**
 * How it should sound. Sent as the system instruction, so it is never part of the text to read;
 * if a voice model will not take one, it goes ahead of the script instead and whatever of it is
 * read aloud is cut off by the listener.
 */
export const DIRECTION =
  'You are the narrator of a short product film for an app called Kept (said like the ordinary word "kept"). ' +
  'Read the text you are given, and nothing else, in a warm, calm, quietly confident voice, like the narrator ' +
  'of an Apple product film: close to the microphone, unhurried, never salesy. Pause after every sentence.'

/** Gemini's prebuilt voice for the take. Sulafat is the warm one; try Algieba or Charon for a lower read. */
export const DEFAULT_VOICE = 'Sulafat'

/** A line as it was cut from the take: `public/next-week/vo/<voice>/take.json`. */
export type VoiceLine = Line & {
  src: string
  /** Seconds of room before the first word. */
  lead: number
  /** Seconds from the first word to the end of the last. */
  speech: number
  /** The whole clip. */
  seconds: number
}

export type Take = { voice: string; model: string; lines: VoiceLine[] }
