/**
 * The voiceover for "Next week" — one take, cut into lines, laid on the film's beats.
 *
 *   node scripts/voiceover.mjs                  # needs GEMINI_API_KEY; voice from voice.ts
 *   node scripts/voiceover.mjs --voice Algieba  # another prebuilt voice (its own folder)
 *   node scripts/voiceover.mjs --model gemini-3.8-flash-tts
 *   node scripts/voiceover.mjs --fresh          # a new take even if the script is unchanged
 *   node scripts/voiceover.mjs --preview        # macOS `say` instead: timing checks only
 *
 * The whole script goes to the voice in a SINGLE request. Lines generated one by one come back
 * as different reads — pitch, pace and level drift from line to line — so they are never
 * generated separately. The one take is cleaned and levelled as a whole, then cut into lines,
 * so every line keeps the same voice and the same loudness.
 *
 * Cutting it, and checking the cut (each step prints what it found):
 *   1. Gemini listens to the whole take and says where each line is and what was said. The
 *      voice model reads its direction out loud more often than not; that is left out.
 *   2. The joins are the longest pauses: this voice stops for longer between sentences than at a
 *      comma, if sometimes only just (0.51 s against 0.47 s in one take) — so step 3 is what
 *      settles it. Gemini's timings drift too much to cut by; they only cross-check.
 *   3. The cut lines go back as one recording, two seconds apart, and are transcribed without
 *      the script, so a clipped word or a stray one from the next line shows up.
 *   4. Each line is timed against its beat at the fastest tempo, where there is least room.
 *
 * The take (take-raw.wav) and both listens (heard.json, check.json) are kept and reused: moving
 * a line to another beat, or levelling it differently, asks Gemini for nothing new.
 *
 * Writes public/next-week/vo/<voice>/NN.wav and take.json, which the NextWeek-*-vo
 * compositions read. Needs ffmpeg.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { TOTAL_BEATS } from '../src/next-week/cues.ts'
import { DEFAULT_VOICE, DIRECTION, LINES } from '../src/next-week/voice.ts'

const SR = 48000
const API = 'https://generativelanguage.googleapis.com/v1beta'
// NastelBom – Product (tracks.ts), the fastest track: every line has the least room there, so
// a script that fits at this tempo fits on every slower one.
const TIGHTEST_BPM = 140.1
const TAIL_SECONDS = 1.5

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const preview = flag('preview')
const voice = preview ? 'preview' : (option('voice') ?? DEFAULT_VOICE)
const dir = path.resolve('public', 'next-week', 'vo', voice)
mkdirSync(dir, { recursive: true })

// ── The take ─────────────────────────────────────────────────────────────────────────────

const script = LINES.map((line) => line.text)

async function pickModel(key) {
  const res = await fetch(`${API}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw new Error(`Listing Gemini models failed: ${res.status} ${await res.text()}`)
  const { models = [] } = await res.json()
  const tts = models
    .filter((m) => /tts/.test(m.name) && m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
  if (tts.length === 0) throw new Error('This key sees no Gemini TTS model. Pass one with --model.')
  // The newest generation first; within one, Pro over Flash over Lite, and releases over previews.
  const tier = (name) => (/pro/.test(name) ? 0 : /lite/.test(name) ? 2 : 1)
  const version = (name) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0)
  const preview = (name) => (/preview/.test(name) ? 1 : 0)
  tts.sort((a, b) => version(b) - version(a) || tier(a) - tier(b) || preview(a) - preview(b))
  console.log(`  TTS models: ${tts.join(', ')}`)
  return tts
}

async function geminiTake(key, model) {
  const text = script.join('\n\n')
  // The direction as a system instruction keeps it out of the words to read. A model that will
  // not take one gets it ahead of the script; the listener cuts off whatever of it is read aloud.
  const request = (system) =>
    fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: DIRECTION }] } } : {}),
        contents: [{ parts: [{ text: system ? text : `${DIRECTION}\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    })
  let res = await request(true)
  if (res.status === 400) {
    const reason = (await res.text()).replace(/\s+/g, ' ').slice(0, 160)
    console.log(
      `    no system instruction on ${model} (${reason}) — direction goes ahead of the script`,
    )
    res = await request(false)
  }
  if (!res.ok) throw new Error(`Gemini TTS failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
  if (!part) {
    throw new Error(
      `No audio came back (finishReason: ${json.candidates?.[0]?.finishReason ?? 'none'}).`,
    )
  }
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000)
  return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate }
}

function sayTake(file) {
  // The same single take, from the Mac's own voice — only to check the pipeline and the fit.
  const aiff = path.join(dir, 'take-raw.aiff')
  execFileSync('say', ['-v', 'Samantha', '-r', '175', '-o', aiff, script.join(' [[slnc 2000]] ')])
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '24000', file])
}

const rawFile = path.join(dir, 'take-raw.wav')
const manifestFile = path.join(dir, 'take.json')
const previous = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null

let model = preview ? 'macos-say' : option('model')
if (!preview && !model && previous?.model && !flag('fresh')) model = previous.model

const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
const hashOf = (m) =>
  createHash('sha256')
    .update(JSON.stringify({ m, voice, DIRECTION, script }))
    .digest('hex')
    .slice(0, 16)

let hash = model ? hashOf(model) : null
if (!flag('fresh') && hash && previous?.hash === hash && existsSync(rawFile)) {
  console.log(
    `  Reusing the take in ${path.relative(process.cwd(), rawFile)} (same words, voice and model).`,
  )
} else if (preview) {
  sayTake(rawFile)
  hash = hashOf(model)
} else {
  if (!key) {
    console.error(
      'No GEMINI_API_KEY in the environment. Export it (e.g. in ~/.zshenv) and run again.',
    )
    process.exit(1)
  }
  // Still one request for the whole script — a model is only passed over when it refuses
  // outright (no quota on this key), never to stitch lines from different models.
  const candidates = model ? [model] : await pickModel(key)
  let result
  for (const candidate of candidates) {
    console.log(`  One take: ${script.length} lines, voice ${voice}, ${candidate}`)
    try {
      result = await geminiTake(key, candidate)
      model = candidate
      break
    } catch (error) {
      if (!/\b429\b/.test(error.message) || candidates.length === 1) throw error
      console.log(`    no quota for ${candidate} on this key — next model`)
    }
  }
  if (!result) throw new Error('No TTS model on this key has quota left.')
  hash = hashOf(model)
  writeWav(rawFile, pcmToFloat(result.pcm), result.rate)
}

// ── Clean and level the take as a whole ──────────────────────────────────────────────────

const CHAIN = 'highpass=f=70,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:makeup=1.5'
// Loud enough to sit about 9 LU over the music ducked under it (see sound.tsx).
const LOUDNESS_I = -12
const LOUDNESS = `I=${LOUDNESS_I}:TP=-1:LRA=11`

const measure = spawnSync('ffmpeg', [
  '-hide_banner',
  '-i',
  rawFile,
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
  rawFile,
  '-af',
  `${CHAIN},loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
  '-ac',
  '1',
  '-ar',
  String(SR),
  takeFile,
])
const take = readFloat(takeFile)

// ── Find each line in the take ───────────────────────────────────────────────────────────
//
// The voice pauses after every sentence, but not by a reliable amount — sometimes 0.2 s between
// lines and 0.3 s at a comma — so pause length alone cannot say where a line ends. Gemini
// listens to the take and says roughly where each line is; each cut then snaps to the nearest
// real silence, so no cut ever lands in a word.

const WIN = SR / 100 // 10 ms
// Silence is relative to how loud the take was made, so levelling it never moves a cut.
const SILENT_DB = LOUDNESS_I - 24
const levels = []
for (let i = 0; i + WIN <= take.length; i += WIN) {
  let sum = 0
  for (let j = i; j < i + WIN; j++) sum += take[j] * take[j]
  levels.push(10 * Math.log10(sum / WIN + 1e-12))
}
const voiced = levels.map((db) => db > SILENT_DB)
// A click or a breath under 50 ms inside a pause is still the pause.
for (let i = 0; i < voiced.length; i++) {
  if (!voiced[i]) continue
  let j = i
  while (j < voiced.length && voiced[j]) j++
  if (j - i < 5 && i > 0 && j < voiced.length) voiced.fill(false, i, j)
  i = j
}
const first = voiced.indexOf(true)
const last = voiced.lastIndexOf(true)

// Every pause of 60 ms or more is somewhere a cut could go.
const gaps = []
for (let i = first; i <= last; i++) {
  if (voiced[i]) continue
  let j = i
  while (j <= last && !voiced[j]) j++
  if (j - i >= 6) gaps.push({ from: i, to: j })
  i = j
}
if (gaps.length < script.length - 1) {
  console.error(
    `The take has ${gaps.length + 1} phrases for ${script.length} lines. Run again with --fresh.`,
  )
  process.exit(1)
}

const takeId = createHash('sha256').update(readFileSync(rawFile)).digest('hex').slice(0, 16)
// What Gemini heard is kept beside the take, so a cut that goes wrong never costs another request.
const heardFile = path.join(dir, 'heard.json')
const cached = existsSync(heardFile) ? JSON.parse(readFileSync(heardFile, 'utf8')) : null
let heard = cached?.takeId === takeId ? cached : null
if (!heard && !preview && key) {
  heard = { takeId, ...(await listen(key)) }
  writeFileSync(heardFile, `${JSON.stringify(heard, null, 2)}\n`)
}

// Where the script starts in the take. The voice often reads its direction out loud first;
// the longest pause near where Gemini heard line 1 begin is the join, and what is before it goes.
let begin = first
if (heard) {
  const opening = heard.lines[0].start * 100
  const near = gaps.filter((g) => Math.abs(g.to - opening) < 150)
  if (near.length) begin = near.reduce((x, y) => (y.to - y.from > x.to - x.from ? y : x)).to
}
const end = last + 1

// The joins are the longest pauses after that. Between sentences the voice pauses for 0.6 s or
// more, inside one for a few hundredths — so length alone finds them. Gemini's timings drift
// by up to a second over a minute of audio, so they only cross-check.
const inside = gaps.filter((g) => g.from > begin && g.to < end)
if (inside.length < script.length - 1) {
  console.error(
    `The take has ${inside.length + 1} phrases for ${script.length} lines. Run again with --fresh.`,
  )
  process.exit(1)
}
const byLength = [...inside].sort((x, y) => y.to - y.from - (x.to - x.from))
const cuts = byLength.slice(0, script.length - 1).sort((x, y) => x.from - y.from)
const length = (g) => (g ? (g.to - g.from) / 100 : 0)
const shortestJoin = Math.min(...cuts.map(length))
const longestInside = length(byLength[script.length - 1])
console.log(
  `  Pauses: between lines ${shortestJoin.toFixed(2)}s or more, inside a line ${longestInside.toFixed(2)}s or less`,
)
if (longestInside > shortestJoin * 0.6) {
  console.warn('  ⚠ Those are close — a line may be cut in the wrong place. Listen to the clips.')
}

if (heard) {
  const wrong = heard.lines.filter((l, i) => normal(l.heard) !== normal(script[i]))
  console.log(
    `  Heard back by ${heard.listener}: ${wrong.length ? `${wrong.length} line(s) differ` : 'every line as written'}`,
  )
  for (const l of wrong) console.log(`    ⚠ line ${l.n}: heard "${l.heard}"`)
  if (heard.extra?.length) {
    console.log(`    also said, and left out: ${heard.extra.join(' / ').slice(0, 90)}…`)
  }
  // Each join against where Gemini heard the change of line, once its drift is taken out.
  const said = cuts.map((_, i) => (heard.lines[i].end + heard.lines[i + 1].start) / 2)
  const found = cuts.map((c) => (c.from + c.to) / 200)
  const n = said.length
  const mx = said.reduce((s, x) => s + x, 0) / n
  const my = found.reduce((s, y) => s + y, 0) / n
  const slope =
    said.reduce((s, x, i) => s + (x - mx) * (found[i] - my), 0) /
    said.reduce((s, x) => s + (x - mx) ** 2, 0)
  const worst = Math.max(...said.map((x, i) => Math.abs(my + slope * (x - mx) - found[i])))
  console.log(`  Joins against Gemini's timings: ${worst.toFixed(2)}s at worst, drift removed`)
  if (worst > 0.8)
    console.warn('  ⚠ A join is far from where Gemini heard it. Listen to the clips.')
}

const LEAD = 0.03 // before the first word
const TAIL = 0.18 // after the last, for the breath and the room
const bounds = []
let start = begin
for (const gap of [...cuts, { from: end, to: end }]) {
  bounds.push([start, gap.from])
  start = gap.to
}

const lines = bounds.map(([a, b], i) => {
  const from = Math.max(0, Math.round((a / 100 - LEAD) * SR))
  const to = Math.min(take.length, Math.round((b / 100 + TAIL) * SR))
  const clip = take.slice(from, to)
  const fadeIn = Math.round(0.005 * SR)
  const fadeOut = Math.round(0.06 * SR)
  for (let k = 0; k < fadeIn; k++) clip[k] *= k / fadeIn
  for (let k = 0; k < fadeOut; k++) clip[clip.length - 1 - k] *= k / fadeOut
  const name = `${String(i + 1).padStart(2, '0')}.wav`
  writeWav(path.join(dir, name), clip, SR)
  return {
    at: LINES[i].at,
    text: LINES[i].text,
    src: `next-week/vo/${voice}/${name}`,
    lead: LEAD,
    speech: +(clip.length / SR - LEAD - TAIL).toFixed(3),
    seconds: clip.length / SR,
  }
})

writeFileSync(
  manifestFile,
  `${JSON.stringify({ voice, model, hash, takeId, made: new Date().toISOString(), lines }, null, 2)}\n`,
)

// ── Listen to every cut line on its own ──────────────────────────────────────────────────

const clipFiles = lines.map((line) => path.resolve('public', line.src))
// Keyed to where the take was cut, not to the audio, so levelling it again costs no request.
const signature = createHash('sha256')
  .update(JSON.stringify({ takeId, bounds }))
  .digest('hex')
  .slice(0, 16)
const checkFile = path.join(dir, 'check.json')
let checked = existsSync(checkFile) ? JSON.parse(readFileSync(checkFile, 'utf8')) : null
if (checked?.signature !== signature) checked = null
if (!checked && heard && key) {
  checked = { signature, ...(await check(key, clipFiles)) }
  writeFileSync(checkFile, `${JSON.stringify(checked, null, 2)}\n`)
}
if (checked) {
  const bad = lines.filter((line, i) => normal(checked.clips[i]?.heard ?? '') !== normal(line.text))
  if (checked.clips.length !== lines.length) {
    console.log(`    ⚠ heard ${checked.clips.length} phrases for ${lines.length} clips`)
  }
  console.log(
    `  Each cut line, heard on its own by ${checked.model}: ${bad.length ? `${bad.length} differ` : `all ${lines.length} match the script`}`,
  )
  for (const line of bad) {
    console.log(
      `    ⚠ ${line.src.split('/').pop()}  "${line.text}"  →  heard "${checked.clips[lines.indexOf(line)]?.heard}"`,
    )
  }
}

/** One request to a Gemini model that listens. Busy models are retried, then skipped. */
async function ask(key, parts, schema) {
  const models = option('listener')
    ? [option('listener')]
    : ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  })
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body,
      })
      if (res.ok) {
        const json = await res.json()
        const text = json.candidates[0].content.parts.map((p) => p.text ?? '').join('')
        return { model, result: JSON.parse(text) }
      }
      if (res.status !== 503 && res.status !== 429) {
        throw new Error(`Gemini (${model}) failed: ${res.status} ${await res.text()}`)
      }
      console.log(`    ${model} busy (${res.status}), ${attempt < 2 ? 'retrying' : 'next model'}`)
      await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)))
    }
  }
  throw new Error('Every listener is busy — run again in a minute (the take is kept).')
}

/** A file as 16 kHz mono WAV, base64 — plenty to hear words by, and a third of the size. */
function speech(file) {
  const wav = execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'wav', '-'],
    {
      maxBuffer: 1 << 28,
    },
  )
  return { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }
}

/** Where each line is in the whole take, roughly, and whether it was said as written. */
async function listen(key) {
  const prompt = [
    'This is one take of a narrator reading the numbered lines below, in order.',
    'For every line, give the time in seconds, to the hundredth, where its first word begins and where its last word ends,',
    'and write down exactly what you heard for it. If a line was not spoken, give -1 for both times.',
    'In "extra", list anything spoken that is not one of these lines.',
    '',
    ...script.map((text, i) => `${i + 1}. ${text}`),
  ].join('\n')
  const { model: listener, result } = await ask(key, [speech(takeFile), { text: prompt }], {
    type: 'OBJECT',
    properties: {
      lines: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            n: { type: 'INTEGER' },
            start: { type: 'NUMBER' },
            end: { type: 'NUMBER' },
            heard: { type: 'STRING' },
          },
          required: ['n', 'start', 'end', 'heard'],
        },
      },
      extra: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['lines', 'extra'],
  })
  if (result.lines.length !== script.length || result.lines.some((l) => l.start < 0)) {
    throw new Error(
      `Gemini heard ${result.lines.filter((l) => l.start >= 0).length} of ${script.length} lines. Run again with --fresh.`,
    )
  }
  return { listener, ...result }
}

/**
 * Every cut line, transcribed without being told what it should say, so a clipped word or a
 * stray one from the next line shows up as what it is. The clips go as ONE recording with two
 * seconds of silence between them: sent as separate labelled clips, the listener lost count and
 * gave clips the words of their neighbours.
 */
async function check(key, clips) {
  const gap = new Float32Array(SR * 2)
  const reel = [gap]
  for (const file of clips) reel.push(readFloat(file), gap)
  const joined = new Float32Array(reel.reduce((n, part) => n + part.length, 0))
  let at = 0
  for (const part of reel) {
    joined.set(part, at)
    at += part.length
  }
  const reelFile = path.join(dir, 'check-reel.wav')
  writeWav(reelFile, joined, SR)
  const prompt =
    `This recording is ${clips.length} short phrases, one after another, with two seconds of silence between them. ` +
    'Transcribe each phrase exactly, in order, one entry per phrase: every word you hear, including any partial word at its start or end.'
  const { model, result } = await ask(key, [speech(reelFile), { text: prompt }], {
    type: 'ARRAY',
    items: { type: 'STRING' },
  })
  return { model, clips: result.map((heard) => ({ heard })) }
}

function normal(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Does it fit? ─────────────────────────────────────────────────────────────────────────

const spb = 60 / TIGHTEST_BPM
const filmEnd = TOTAL_BEATS * spb + TAIL_SECONDS
const clock = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
let tight = 0
console.log(`\n  At ${TIGHTEST_BPM} BPM (the fastest track):`)
lines.forEach((line, i) => {
  const from = line.at * spb
  const until = from + line.seconds - line.lead - TAIL
  const next = lines[i + 1] ? lines[i + 1].at * spb : filmEnd
  const room = next - until
  const words = line.text.split(/\s+/).length
  const rate = words / (line.seconds - LEAD - TAIL)
  const note =
    room < 0.12
      ? `  ⚠ runs ${(-room + 0.12).toFixed(2)}s into the next line`
      : rate < 1.2 || rate > 5
        ? `  ⚠ ${rate.toFixed(1)} words/s — cut in the wrong place?`
        : ''
  if (note) tight++
  console.log(
    `  ${clock(from)}–${clock(until)}  ${(line.seconds - LEAD - TAIL).toFixed(2)}s  ${line.text}${note}`,
  )
})
console.log(
  `\n  ${lines.length} lines → ${path.relative(process.cwd(), dir)}/  ${tight ? `${tight} to look at` : 'all fit'}`,
)

// ── WAV in and out ───────────────────────────────────────────────────────────────────────

function pcmToFloat(pcm) {
  const out = new Float32Array(pcm.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = pcm.readInt16LE(i * 2) / 32768
  return out
}

function readFloat(file) {
  const raw = execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'],
    {
      maxBuffer: 1 << 30,
    },
  )
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4).slice()
}

function writeWav(file, samples, rate) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(file, Buffer.concat([header, data]))
}
