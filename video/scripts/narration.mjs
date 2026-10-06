/**
 * Cuts a narration take recorded anywhere (AI Studio, another TTS, a microphone) into one clip
 * per line, with no model in the loop.
 *
 *   node scripts/narration.mjs <take.wav>      # script: src/demo/narration.ts
 *
 * 1. The take is cleaned and levelled as a whole, exactly as voiceover.mjs does the film's.
 * 2. Its pauses are found (ffmpeg silencedetect), leaving the stretches of speech between them.
 * 3. The lines are fitted to those stretches in order: every line must be one or more whole
 *    stretches, its length should match its share of the words, and a join should sit on a
 *    long pause rather than a comma. The best fit is found exhaustively (dynamic programming),
 *    not guessed from the longest pauses — in a calm read a comma can last as long as a stop.
 * 4. Each line is written with the same lead and tail as the film's clips, and every clip goes
 *    into one reel, two seconds apart, to listen to before it is used.
 *
 * What this cannot do is hear the words. The fit says where the lines most likely are; the
 * reel is where a person confirms it. Writes public/demo/vo/NN.wav, take.wav, check-reel.wav
 * and narration.json. Needs ffmpeg.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { NARRATION } from '../src/demo/narration.ts'

const source = process.argv[2]
if (!source) {
  console.error('Usage: node scripts/narration.mjs <take.wav>')
  process.exit(1)
}

const dir = path.join('public', 'demo', 'vo')
mkdirSync(dir, { recursive: true })
const SR = 24000

// ── Clean and level, as voiceover.mjs does ───────────────────────────────────────────────

const CHAIN = 'highpass=f=70,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:makeup=1.5'
const LOUDNESS = 'I=-12:TP=-1:LRA=11'
const measure = spawnSync('ffmpeg', [
  '-hide_banner',
  '-i',
  source,
  '-af',
  `${CHAIN},loudnorm=${LOUDNESS}:print_format=json`,
  '-f',
  'null',
  '-',
])
const m = JSON.parse(
  /\{[\s\S]*?\}/.exec(measure.stderr.toString().split('Parsed_loudnorm').pop())[0],
)
const takeFile = path.join(dir, 'take.wav')
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-i',
  source,
  '-af',
  `${CHAIN},loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  '-ac',
  '1',
  '-ar',
  String(SR),
  takeFile,
])

// ── Pauses, and the speech between them ──────────────────────────────────────────────────

const probe = spawnSync('ffprobe', [
  '-v',
  'error',
  '-show_entries',
  'format=duration',
  '-of',
  'csv=p=0',
  takeFile,
])
const duration = Number(probe.stdout.toString().trim())
// Found on the take as recorded: levelling lifts the quiet between phrases, and a pause the
// compressor has filled in can no longer be told from a word. The timing is the same.
const detect = spawnSync('ffmpeg', [
  '-hide_banner',
  '-i',
  source,
  '-af',
  'silencedetect=noise=-42dB:d=0.12',
  '-f',
  'null',
  '-',
])
const pauses = []
let open = null
for (const line of detect.stderr.toString().split('\n')) {
  const start = /silence_start: ([\d.]+)/.exec(line)
  const end = /silence_end: ([\d.]+)/.exec(line)
  if (start) open = Number(start[1])
  if (end && open !== null) {
    pauses.push({ from: open, to: Number(end[1]) })
    open = null
  }
}
if (open !== null) pauses.push({ from: open, to: duration })

const stretches = []
let cursor = 0
for (const p of pauses) {
  if (p.from - cursor > 0.05) stretches.push({ from: cursor, to: p.from })
  cursor = p.to
}
if (duration - cursor > 0.05) stretches.push({ from: cursor, to: duration })

/*
 * A sound under 0.2 s on its own between two pauses is a breath or a click, not a word: the one
 * in the first AI Studio take had no pitch at all, where every word does. Left in, it lands at
 * the end of a line's clip. It becomes part of the pause.
 */
const BREATH = 0.2
for (let i = stretches.length - 1; i >= 0; i--) {
  if (stretches[i].to - stretches[i].from >= BREATH || stretches.length <= 1) continue
  const [b] = stretches.splice(i, 1)
  console.log(
    `  ${b.from.toFixed(2)}–${b.to.toFixed(2)}s: too short to be a word, left in the pause`,
  )
}

const n = NARRATION.length
const k = stretches.length
if (k < n) {
  console.error(`The take has ${k} stretches of speech for ${n} lines. Is it the right script?`)
  process.exit(1)
}

// ── Fit the lines to the stretches ───────────────────────────────────────────────────────

/*
 * Matched phrase by phrase, not line by line: inside a sentence a voice pauses only at
 * punctuation, so the script splits into phrases at commas and colons, and every stretch of
 * speech must be one or more whole phrases. A voice often runs through a comma (one stretch,
 * several phrases, free) but rarely stops mid-phrase (one phrase over several stretches, costly).
 * A stretch must also hold a believable number of words for its length: a line-level fit once
 * put four words in 0.54 s.
 */
const words = NARRATION.map((t) => t.split(/\s+/).length)
const phrases = NARRATION.flatMap((t, line) => {
  const parts = t.split(/(?<=[,:;—])\s+/)
  return parts.map((part, j) => ({
    line,
    words: part.split(/\s+/).length,
    last: j === parts.length - 1,
  }))
})
const totalWords = words.reduce((a, b) => a + b, 0)
const speech = stretches.reduce((a, x) => a + (x.to - x.from), 0)
const perWord = speech / totalWords
const pauseAfter = (j) => (j + 1 < k ? stretches[j + 1].from - stretches[j].to : 1)
const P = phrases.length
const misfit = (seconds, w) => ((seconds - w * perWord) / (w * perWord)) ** 2

// best[p][q]: the first p phrases on the first q stretches. Groups never cross a line's end
// except at their own end, so every line starts and ends on a pause.
const best = Array.from({ length: P + 1 }, () => new Array(k + 1).fill(Infinity))
const from = Array.from({ length: P + 1 }, () => new Array(k + 1).fill(null))
best[0][0] = 0
for (let p = 0; p < P; p++) {
  for (let q = 0; q < k; q++) {
    if (best[p][q] === Infinity) continue
    // One stretch holding phrases p..p2.
    let w = 0
    for (let p2 = p; p2 < P; p2++) {
      w += phrases[p2].words
      const seconds = stretches[q].to - stretches[q].from
      const join = phrases[p2].last && p2 < P - 1 ? -0.5 * Math.min(pauseAfter(q), 0.8) : 0
      const c = best[p][q] + misfit(seconds, w) + join
      if (c < best[p2 + 1][q + 1]) {
        best[p2 + 1][q + 1] = c
        from[p2 + 1][q + 1] = [p, q]
      }
      if (phrases[p2].last) break
    }
    // One phrase over stretches q..q2: a pause where the script has none.
    for (let q2 = q + 1; q2 < k; q2++) {
      const seconds = stretches[q2].to - stretches[q].from
      const join = phrases[p].last && p < P - 1 ? -0.5 * Math.min(pauseAfter(q2), 0.8) : 0
      const c = best[p][q] + misfit(seconds, phrases[p].words) + 1.5 * (q2 - q) + join
      if (c < best[p + 1][q2 + 1]) {
        best[p + 1][q2 + 1] = c
        from[p + 1][q2 + 1] = [p, q]
      }
    }
  }
}
if (best[P][k] === Infinity) {
  console.error('No fit of the script to this take. Is it the right script?')
  process.exit(1)
}
// Walk back, noting which stretch each line starts and ends on.
const spans = NARRATION.map(() => ({ a: Infinity, b: -1 }))
for (let p = P, q = k; p > 0;) {
  const [p0, q0] = from[p][q]
  for (let i = p0; i < p; i++) {
    const span = spans[phrases[i].line]
    span.a = Math.min(span.a, q0)
    span.b = Math.max(span.b, q - 1)
  }
  ;[p, q] = [p0, q0]
}

// ── Clips, the reel, and what was decided ────────────────────────────────────────────────

const LEAD = 0.03
const TAIL = 0.18
const lines = spans.map(({ a, b }, i) => {
  const start = Math.max(0, stretches[a].from - LEAD)
  const end = Math.min(duration, stretches[b].to + TAIL)
  const file = path.join(dir, `${String(i + 1).padStart(2, '0')}.wav`)
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    takeFile,
    '-ss',
    String(start),
    '-to',
    String(end),
    file,
  ])
  return {
    text: NARRATION[i],
    src: `demo/vo/${path.basename(file)}`,
    from: +start.toFixed(3),
    to: +end.toFixed(3),
    seconds: +(end - start).toFixed(3),
    expected: +(words[i] * perWord).toFixed(2),
    pauseAfter: i < n - 1 ? +pauseAfter(b).toFixed(2) : null,
  }
})

const reelList = path.join(dir, 'reel.txt')
const gap = path.join(dir, 'gap.wav')
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  `anullsrc=r=${SR}:cl=mono`,
  '-t',
  '2',
  gap,
])
writeFileSync(
  reelList,
  lines.flatMap((l) => [`file '${path.basename(l.src)}'`, `file 'gap.wav'`]).join('\n') + '\n',
)
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  reelList,
  '-c',
  'copy',
  path.join(dir, 'check-reel.wav'),
])

writeFileSync(
  path.join(dir, 'narration.json'),
  `${JSON.stringify({ source: path.basename(source), made: new Date().toISOString(), lines }, null, 2)}\n`,
)

console.log(`  ${k} stretches of speech for ${n} lines; ${perWord.toFixed(2)} s a word`)
for (const [i, l] of lines.entries()) {
  const off = l.seconds - LEAD - TAIL - l.expected
  console.log(
    `  ${String(i + 1).padStart(2)}  ${l.from.toFixed(2).padStart(6)}s  ${l.seconds.toFixed(2)}s (expected ${l.expected.toFixed(2)}, ${off >= 0 ? '+' : ''}${off.toFixed(2)})  pause after ${l.pauseAfter ?? '—'}  ${l.text}`,
  )
}
console.log(
  `\n  Listen before using it: ${path.join(dir, 'check-reel.wav')} (each line, two seconds apart)`,
)
