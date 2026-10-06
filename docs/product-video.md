# KEPT — "Next week"

**The product video · 73 s on the chosen track (86 s on the composed score) · motion graphics only · one continuous shot · 16:9**

Built: `video/src/next-week/` → `npx remotion render NextWeek` (see [Build](#build)).
Replaces the rendered product film ([product-film.md](product-film.md)) and the live-action
announcement film ([announcement-film.md](announcement-film.md)) as the launch video.

---

## The idea

Everyone has told themselves *I'll start investing next week.* Then next week comes, something
shinier turns up, and it becomes next week again.

The film is that loop — and the one thing that breaks it: **other people waiting on you.**

One object carries the whole film: **the empty circle of a to-do you never tick.** It becomes
the ring. The camera never cuts.

---

## The flow

```
 PROBLEM        ○ Start investing  →  pushed to next week  →  again  →  weeks streak past
                dead stop · the words fall away · "Next week never comes."
                                   │  the ○ is left alone
 TURN           "Unless you're not doing it alone."  three circles arrive out of the dark
                the drop · ours becomes the ring · KEPT
                                   │  the ring's centre fills white; the camera flies through it
 PROMISE        still flying forward: a phone. "One small promise."
                the ring lifts off the screen and becomes a dial: $10 → $25, "every Friday"
                                   │  the $25 shrinks to a coin and drops
 INVEST         a reel of names, one at a time: Tesla, Nvidia, S&P 500, Apple, Gold,
                then OpenAI, SpaceX — Private.  It was the phone's buy screen all along.
                                   │  Buy — the button stretches and bends round into the ring
 KEPT           the ring closes on the beat. Confetti. "Kept."
                                   │  the camera pulls back — it's our phone, between two friends'
 SHARED         the moment lifts off our screen · the amount falls off it · it lands on theirs
                "Your circle sees it."  "Never how much."  Reactions come back.
                                   │  one friend's ring is still open
 RIPPLE         a nudge · their ring closes · pull back: a crowd of circles closing in a wave
                "It's not just you. It's everyone around you."
                                   │  push into ours: it's week one
 THE YEAR       the row of weeks again, now every circle closing as we pass. Awards land.
                One week stays open; the row keeps going. Under it, a tally: put away, $1,275.
                                   │  pull back from week fifty-two
 THE MONEY      the row is one of ten, a year each; the nine new rows fill as the tally
                compounds: in ten years it could grow to $18,236 (an illustration, footnoted)
                                   │  push into the last week of the ten years; it becomes all three rings
 END            white drains to ink · three rings close on three hits · "Promises compound."
                the mark · KEPT · Android beta now · Solana dApp Store soon
```

---

## Rules

1. **One thing on screen.** One object and at most one line of type.
2. **Never cut.** Every section hands an object to the next. No fade to black, no wipe.
3. **Big.** The hero object fills at least half the frame height.
4. **The picture explains, the words confirm.**
5. **Black while you're alone, white once you're not.** Ink until the fly-through, cream through
   the product, ink again under the final rings.
6. **The music cuts the film.** Every ring close lands on a beat — the whole film is timed in beats.

---

## What we're borrowing

Studied frame by frame from the films' scrub previews; audio not checked.

| Technique | Seen in | Where it is in ours |
|---|---|---|
| **Grow from one element** | Framer (a blinking cursor becomes a whole page) [↗](https://www.youtube.com/watch?v=6xJWQRVl9nw) | The to-do's empty ○ becomes the ring, then the whole story |
| **Open on the problem** | Copilot Money (garbled bank text rearranges into a card) [↗](https://www.youtube.com/watch?v=E0jRwbLKWMk) | The week-after-week loop |
| **Lift-out** — one piece of UI comes off the phone to fill the frame | Apple Card intro (chart, map, `$` tile) [↗](https://www.youtube.com/watch?v=03GLhju1yN8) | The ring lifts off the promise screen and becomes the dial |
| **Pull-back reveal** — it was inside the phone all along | Framer, Copilot | The reel of names turns out to be the buy screen; "Kept." turns out to be our phone |
| **The ring as the stage** | Apple Card's payment wheel | The dial, the Buy button bending into the ring, the ending |
| **One camera on one surface, edges falling into darkness** | Linear Agent [↗](https://www.youtube.com/watch?v=mRql2VJ99gM) | The week rows; a vignette throughout |
| **A carrier object** | Raycast (the selection highlight becomes the mic) [↗](https://www.youtube.com/watch?v=Mi173xGb0ZA) | The circle, all the way through |
| **Never:** black chapter cards between sections | Things 3 [↗](https://www.youtube.com/watch?v=2R6o5t0VK_A), the counter-example | — |

---

## The hand-offs

At each one the outgoing object and the incoming one are the same size in the same place.

| From | Object | Becomes | Move |
|---|---|---|---|
| Problem | the to-do's ○ | the lone circle | The words fall away letter by letter; the circle glides to centre |
| Turn | the lone circle | the promise ring | Thickens and draws itself on the drop |
| Turn → Promise | the ring's hollow | the white of the rest of the film | Fills with cream; the camera flies through it and keeps flying forward to a phone |
| Promise | the ring on the phone | the dial | Lifts off the screen to centre frame |
| Promise → Invest | the `$25` | a coin | Shrinks, drops out of frame as the reel rises |
| Invest | the reel | the phone's buy list | The camera pulls back; the screen's edges close in around it |
| Invest → Kept | the Buy button | the ring | Lifts, stretches, bends until its ends meet |
| Kept → Shared | the ring and "Kept." | our phone's screen | Pull back from exactly the zoom where they match |
| Shared | the share card | two notifications | Sheds the amount, splits, lands on both friends' phones |
| Ripple | three phones | three circles in a crowd | Pull back; the phones fade to their rings |
| Ripple → Year | our circle | week one | Push in until it is exactly a week's size |
| Year → Money | week fifty-two | the first of ten rows | Pull back until ten years of weeks fill the frame |
| Money → End | the last week of year ten | the three rings | Push in; goal and circle appear inside it |
| End | the three rings | the mark | Contract, cross into the mark; the wordmark rises under it |

---

## Every word on screen

```
THIS WEEK · NEXT WEEK · Start investing
Weekend.  New phone.  Later.
Next week never comes.
Unless you're not doing it alone.
KEPT
One small promise.
$10 → $25 · every Friday
It lets you buy real stocks.
Tesla · Nvidia · S&P 500 · Apple · Gold · OpenAI (Private) · SpaceX (Private)
Buy $25 of SpaceX
Kept.
Your circle sees it.
You kept this week's promise · $25 · SpaceX (the amount falls away)
Never how much.
A nudge from your circle.
Back on track.
WEEK 1 … WEEK 52 · First promise · First month · Steady eight · Half a year · A full year
Week after week.
PUT AWAY $1,275 → IN TEN YEARS, IT COULD GROW TO $18,236
Illustration, not a forecast: $25 a week for ten years with one week a year missed ($12,750 put in), growing 7% a year. Capital at risk.
Promises compound.
KEPT
Android beta now · Solana dApp Store soon
keptapp.pages.dev
Tokenized stocks via xStocks. Private-market tokens via Tessera. Not available to U.S. persons. Capital at risk.
```

Award titles and objects are the app's own (`mobile/features/awards/awards-api.ts`). Company names
are set in our own type — no company logos.

---

## Sound

**Two layers, kept apart on purpose:**

- **Music** — one track under the whole film.
- **Effects** — 21 one-shots (whoosh, the dead stop, arrivals, dial clicks, the Buy press, the
  kept sound, notification dings, reaction pops, the wave, three hits) placed by the film on its
  own cues in `sound.tsx`. They stay on the picture whatever music is underneath.

**The composed score** (`video/scripts/score.mjs`) is synthesised in code against the same cue
sheet the picture reads (`cues.ts`), so it lands by construction:

| Film | Score |
|---|---|
| 0:00–0:11 · the loop | A tick on every beat, a low piano each bar, hats creeping in, accelerating |
| 0:11 · the stop | Everything cut dead, reverb included |
| 0:11–0:18 · the turn | A faint pad, a swell |
| 0:18 · the drop | Kick, claps, sub, plucked chords — D, A, Bm, G |
| 0:22 → | A lead melody from the fly-through; arpeggios from Kept |
| 1:00 · the year | Everything an octave up |
| 1:08, 1:09, 1:10 | Three hits: G, A, D. The last chord blooms and lets go |

Regenerate with `node scripts/score.mjs` after changing any cue.

**The chosen track: NastelBom – *Product*** ([Pixabay](https://pixabay.com/music/future-bass-product-422908/)),
140.1 BPM. Pixabay's licence allows it in our own promo, no attribution required. It is
*Content ID registered*, so YouTube may show a claim on upload — the video stays up, and the
claim can be released with the licence. Not committed (the licence forbids redistributing the
file on its own): download it to `video/public/next-week/music/nastelbom-product.mp3`.

At 140 BPM the film runs 73 s. The track is cut in four edits (`tracks.ts`):

| Film | Track |
|---|---|
| 0:00–0:09 | The build from bar 11 — the film's hard stop lands just before the track's own drop |
| 0:09–0:15 | Silence; the film's effects and a swell carry the turn |
| 0:15 | The first drop (bar 17), on the ring turning green |
| 0:38 | The breakdown (bar 41), as the moment is shared |
| 0:51 | The second drop arrives on its own, with the year; the three hits land on bar 57, the next phrase |

`node scripts/track-info.mjs <file>` measures a new track's tempo, beat grid and bar-by-bar
loudness, which is all the edit list needs.

**NCS tracks** — support is built, no track is included. `tracks.ts` takes a track's BPM, where
its intro starts and where its drop lands; the film retimes itself to that tempo and splices the
track like an editor would (intro under the problem, cut dead at the stop, back in on the drop).
Each track renders as its own composition, `NextWeek-<id>`.

NCS's free licence covers independent creators, **not a company promoting its own product** —
see [ncs.io/usage-policy](https://ncs.io/usage-policy). A launch video with an NCS track needs
their commercial licence ([request form](https://form.jotform.com/nocopyrightsounds/commercial-license-request)).
Best fit found: Tobu – *Faster* (instrumental, 128 BPM, [ncs.io/TFaster](https://ncs.io/TFaster)),
then Syn Cole – *Feel Good* (124) and Jim Yosef – *Firefly* (130). Drop timestamps are estimates
until checked by ear.

---

## Voiceover

**One take, cut into lines.** The whole script goes to Gemini TTS in a single request, because
lines generated one at a time come back with a different pitch, pace and level each time.
The take is levelled as a whole, then cut into lines, and each line is placed on its beat
(`video/src/next-week/voice.ts`).

- **Words:** where a caption is up, the voice says the caption. Between captions, it tells the
  problem: *You've been meaning to start investing. Next week, you tell yourself.*
- **Voice:** Gemini 3.8 Flash TTS, prebuilt voice *Sulafat* (warm). `--voice Algieba` or
  `Charon` gives a lower read, as a separate take.
- **"kept"** is written in lower case in the script. Capitalised, the voice treated it as a name and it
  was heard back as "Capt."
- **Mix:** the voice is levelled to −12 LUFS, and the music ducks −9 dB under each line. The voice
  sits a median 8 LU over the music.
- **Checked:** Gemini listens back to the whole take, and to the cut lines joined two seconds
  apart, transcribing them without the script. See `video/scripts/voiceover.mjs`.
- **The number:** $1,000 → $1,500 in a year would be a 50% return — not a claim an investing
  app can make. The tally shows what is really put away in a year ($1,275: 51 weeks × $25), then
  a ten-year illustration at 7% a year, computed from the grid on screen and footnoted as such.

| Film | Voice |
|---|---|
| 0:00–0:07 · the loop | You've been meaning to start investing. · Next week, you tell yourself. · The weekend. · A new phone. · Later. |
| 0:10 · the silence | Next week never comes. · Unless you're not doing it alone. |
| 0:16 · the drop | This is kept. |
| 0:19–0:31 · promise, invest | Make one small promise. · Twenty-five dollars. · Every Friday. · It lets you buy real stocks. · Even companies that aren't public yet. |
| 0:34 · Kept | Promise kept. |
| 0:37–0:42 · shared | Your circle sees you kept your promise. · Never how much. · And they cheer you on. |
| 0:44–0:50 · ripple | Fall behind, and they'll nudge you. · Back on track. · It's not just you. · It's everyone around you. |
| 0:51–0:57 · the year | Week after week. · Month after month. · Miss a week, and just keep going. · You barely notice it adding up. |
| 0:59 · the money | Keep going for ten years, and it could grow to over eighteen thousand dollars. |
| 1:05 · three hits | — |
| 1:07–1:10 · end | Promises compound. · kept. · Now in beta, on Android. |

Times are at 140.1 BPM, the chosen track.

---

## Look

- **Ink and cream** from the design tokens. The only gradients are soft blooms of ring colour.
- **Edges fall away** — a vignette, so the camera moves through space rather than past a border.
- **Type** — Sora 700 for lines, Instrument Serif italic for one accent word. One line at a time.
- **Words arrive** rising out of a blur, word by word, and **leave** upward the same way.
- **Motion** — exact damped springs for arrivals, eased curves for the camera, directional
  motion blur whenever the camera moves fast.

---

## Build

`video/src/next-week/`, registered in `video/src/Root.tsx`.

| File | What |
|---|---|
| `cues.ts` | Every moment, in beats. The picture and the score both read it |
| `tracks.ts` | The music the film can sit on; tempo → frames, splice points |
| `motion.ts` | Easing, springs, seeded randomness |
| `parts.tsx` | Caption, camera, motion blur, phone, card, confetti |
| `opening.tsx` · `middle.tsx` · `circle.tsx` · `closing.tsx` | The sections |
| `sound.tsx` | Music and the placed effects |
| `NextWeek.tsx` | The composition |

Reuses the real `<Rings>` from `web/components/rings.tsx`, the tokens, the fonts, the 3D award
art and `promise.svg`.

```bash
cd video
node scripts/score.mjs                                       # music + effects → public/next-week/
npx remotion render NextWeek-product out/kept-next-week-16x9-product.mp4   # the film
npm run voiceover                                            # the voice take (GEMINI_API_KEY) → public/next-week/vo/
node scripts/render.mjs NextWeek-product-vo                  # the film with the voiceover
npx remotion still Thumbnail out/kept-next-week-thumbnail.png                    # 1280×720 thumbnail: "Next week never comes."
npx remotion still Thumbnail-compound out/kept-next-week-thumbnail-compound.png  # the cream one: "Promises compound."
npx remotion still Thumbnail-showcase out/kept-showcase-thumbnail.png          # the app: mark + KEPT left, the real "This week" screen on a phone right
npx remotion render NextWeek out/kept-next-week-16x9.mp4     # the same film on the composed score
node scripts/stills.mjs 22 36 80                             # stills at given beats, for checking
```

**Not done yet:** 9:16 and 1:1 layouts (the scenes are laid out in a fixed 1920 × 1080 space);
cutdowns.

## Cutdowns (planned)

- **30 s** — Problem (compressed) → Turn → Kept → End.
- **15 s vertical** — `Next week never comes.` → the circles arrive → the ring closes → `KEPT`.
