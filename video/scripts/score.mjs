/**
 * The score for "Next week", and its sound effects — synthesised, not sampled.
 *
 *   node scripts/score.mjs
 *
 * Writes public/next-week/score.wav (the music) and public/next-week/sfx/*.wav (one-shots the
 * film places on its own cues; see src/next-week/sound.tsx).
 *
 * The music is composed against the same cue sheet the picture uses — it imports
 * src/next-week/cues.ts directly — so the hard stop, the drop, the Kept downbeat and the three
 * closing hits are where the picture has them by construction, not by nudging.
 *
 * No dependencies: plain Float32Arrays, a few biquads, a Schroeder reverb, and a WAV writer.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { HITS, SCORE_BPM, SECTION, TOTAL_BEATS } from '../src/next-week/cues.ts'

const SR = 48000
const SPB = 60 / SCORE_BPM
const at = (beat) => beat * SPB
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)

// ── Noise, deterministic ─────────────────────────────────────────────────────────────────
let seed = 1234567
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2147483648 - 1
}

// ── Buses ────────────────────────────────────────────────────────────────────────────────
function bus(seconds) {
  const n = Math.ceil(seconds * SR)
  return { L: new Float32Array(n), R: new Float32Array(n) }
}

function add(b, start, fn, seconds, pan = 0) {
  const s0 = Math.round(start * SR)
  const n = Math.round(seconds * SR)
  const gl = Math.cos(((pan + 1) * Math.PI) / 4)
  const gr = Math.sin(((pan + 1) * Math.PI) / 4)
  for (let i = 0; i < n; i++) {
    const j = s0 + i
    if (j < 0 || j >= b.L.length) continue
    const v = fn(i / SR, i)
    b.L[j] += v * gl * Math.SQRT2
    b.R[j] += v * gr * Math.SQRT2
  }
}

/** Direct-form biquad (RBJ cookbook). Coefficients can move; the state carries over. */
function makeBiquad(type, q) {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    a1 = 0,
    a2 = 0
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  return {
    set(f) {
      const w = (2 * Math.PI * Math.min(Math.max(f, 20), SR * 0.45)) / SR
      const cos = Math.cos(w)
      const alpha = Math.sin(w) / (2 * q)
      let n0, n1, n2
      if (type === 'lp') [n0, n1, n2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
      else if (type === 'hp') [n0, n1, n2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
      else [n0, n1, n2] = [alpha, 0, -alpha] // band-pass, constant peak gain
      const a0 = 1 + alpha
      b0 = n0 / a0
      b1 = n1 / a0
      b2 = n2 / a0
      a1 = (-2 * cos) / a0
      a2 = (1 - alpha) / a0
    },
    run(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      return y
    },
  }
}

function biquad(type, f, q = 0.707) {
  const filter = makeBiquad(type, q)
  filter.set(f)
  return (x) => filter.run(x)
}

/** A filter whose cutoff moves over time, recomputed every 16 samples. */
function sweep(type, fOf, q = 0.707) {
  const filter = makeBiquad(type, q)
  filter.set(fOf(0))
  let count = 0
  return (x, t) => {
    if (++count % 16 === 0) filter.set(fOf(t))
    return filter.run(x)
  }
}

/** Schroeder reverb: four combs and two all-passes per side, decorrelated delays. */
function reverb(b, { size = 1, damp = 0.35, wet = 0.3, decay = 0.84 } = {}) {
  const side = (input, offset) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({
      buf: new Float32Array(Math.round((d + offset) * size * (SR / 44100))),
      i: 0,
      lp: 0,
    }))
    const aps = [225, 556].map((d) => ({
      buf: new Float32Array(Math.round((d + offset) * (SR / 44100))),
      i: 0,
    }))
    const out = new Float32Array(input.length)
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.2
      let y = 0
      for (const c of combs) {
        const v = c.buf[c.i]
        c.lp = v * (1 - damp) + c.lp * damp
        c.buf[c.i] = x + c.lp * decay
        c.i = (c.i + 1) % c.buf.length
        y += v
      }
      for (const a of aps) {
        const v = a.buf[a.i]
        const o = -y + v
        a.buf[a.i] = y + v * 0.5
        a.i = (a.i + 1) % a.buf.length
        y = o
      }
      out[n] = y
    }
    return out
  }
  const l = side(b.L, 0)
  const r = side(b.R, 23)
  for (let n = 0; n < b.L.length; n++) {
    b.L[n] = b.L[n] * (1 - wet * 0.5) + l[n] * wet
    b.R[n] = b.R[n] * (1 - wet * 0.5) + r[n] * wet
  }
}

function mixInto(dest, src, gain = 1, duck = null) {
  for (let n = 0; n < dest.L.length && n < src.L.length; n++) {
    const g = gain * (duck ? duck[n] : 1)
    dest.L[n] += src.L[n] * g
    dest.R[n] += src.R[n] * g
  }
}

function writeWav(path, b, peak = 0.89) {
  let max = 1e-9
  for (let n = 0; n < b.L.length; n++) max = Math.max(max, Math.abs(b.L[n]), Math.abs(b.R[n]))
  const gain = peak / max
  const n = b.L.length
  const data = Buffer.alloc(44 + n * 4)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + n * 4, 4)
  data.write('WAVE', 8)
  data.write('fmt ', 12)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(2, 22)
  data.writeUInt32LE(SR, 24)
  data.writeUInt32LE(SR * 4, 28)
  data.writeUInt16LE(4, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    const soft = (v) => Math.tanh(v * gain * 1.05) / Math.tanh(1.05)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(b.L[i]))) * 32767), 44 + i * 4)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(b.R[i]))) * 32767), 46 + i * 4)
  }
  writeFileSync(path, data)
}

// ── Instruments ──────────────────────────────────────────────────────────────────────────
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d))

function kick(b, start, vol = 1) {
  let ph = 0
  add(
    b,
    start,
    (t) => {
      const f = 46 + 120 * Math.exp(-t * 30)
      ph += (2 * Math.PI * f) / SR
      return (Math.sin(ph) * Math.exp(-t * 6.5) + noise() * Math.exp(-t * 400) * 0.25) * vol
    },
    0.5,
  )
}

function clap(b, start, vol = 1) {
  const bp = biquad('bp', 1400, 0.9)
  add(
    b,
    start,
    (t) => {
      const bursts = [0, 0.011, 0.023].reduce(
        (s, o) => s + (t >= o ? Math.exp(-(t - o) * 140) : 0),
        0,
      )
      return bp(noise()) * (bursts * 0.6 + Math.exp(-t * 16) * 0.5) * vol * 1.6
    },
    0.35,
    0.05,
  )
}

function hat(b, start, vol = 1, open = false) {
  const hp = biquad('hp', 7500, 0.8)
  add(b, start, (t) => hp(noise()) * Math.exp(-t * (open ? 11 : 60)) * vol, open ? 0.35 : 0.08, 0.2)
}

function sub(b, start, dur, midi, vol = 1, decay = 0) {
  const f = hz(midi)
  add(
    b,
    start,
    (t) => {
      const a = Math.min(1, t / 0.006) * Math.min(1, (dur - t) / 0.04) * Math.exp(-t * decay)
      const p = 2 * Math.PI * f * t
      return (Math.sin(p) + 0.18 * Math.sin(2 * p)) * a * vol
    },
    dur,
  )
}

function saw(phase) {
  return 2 * (phase - Math.floor(phase + 0.5))
}

function pluck(b, start, midi, vol = 1, pan = 0, bright = 1) {
  const f = hz(midi)
  const lp = sweep('lp', (t) => 500 + 5200 * bright * Math.exp(-t * 13), 0.9)
  add(
    b,
    start,
    (t) => {
      const x = saw(f * t) * 0.6 + saw(f * 1.004 * t) * 0.4
      return lp(x, t) * env(t, 0.003, 5.2) * vol
    },
    0.9,
    pan,
  )
}

function pad(b, start, dur, midis, vol = 1, cutoff = 1800) {
  for (const [k, midi] of midis.entries()) {
    const f = hz(midi)
    for (const [d, pan] of [
      [-0.09, -0.6],
      [0, 0],
      [0.09, 0.6],
    ]) {
      const lp = biquad('lp', cutoff, 0.6)
      const ff = f * Math.pow(2, d / 12)
      const off = (k * 0.37 + d) % 1
      add(
        b,
        start,
        (t) => {
          const a = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (dur + 0.9 - t) / 0.9))
          return lp(saw(ff * t + off)) * a * vol * 0.22
        },
        dur + 0.9,
        pan,
      )
    }
  }
}

function piano(b, start, midi, vol = 1, pan = 0, length = 3.5) {
  const f = hz(midi)
  add(
    b,
    start,
    (t) => {
      let v = 0
      for (let k = 1; k <= 6; k++) {
        const fk = k * f * Math.sqrt(1 + 0.0004 * k * k)
        v += (Math.sin(2 * Math.PI * fk * t) / Math.pow(k, 1.4)) * Math.exp(-t * (0.9 + k * 0.7))
      }
      return v * Math.min(1, t / 0.004) * vol * 0.5
    },
    length,
    pan,
  )
}

function lead(b, start, dur, midi, vol = 1) {
  const f = hz(midi)
  const lp = biquad('lp', 3200, 0.7)
  let ph = 0
  add(
    b,
    start,
    (t) => {
      const vib = t > 0.18 ? Math.sin(2 * Math.PI * 5.2 * t) * 0.004 : 0
      ph += (f * (1 + vib)) / SR
      const sq = Math.tanh(Math.sin(2 * Math.PI * ph) * 2.2) * 0.7 + saw(ph * 2) * 0.12
      const a = Math.min(1, t / 0.012) * Math.min(1, Math.max(0, (dur - t) / 0.09))
      return lp(sq) * a * vol * 0.55
    },
    dur + 0.02,
  )
}

function riser(b, start, dur, vol = 1) {
  const bp = sweep('bp', (t) => 250 * Math.pow(22, t / dur), 1.4)
  add(
    b,
    start,
    (t) => {
      const p = t / dur
      return (
        (bp(noise(), t) * 1.6 + Math.sin(2 * Math.PI * (200 + 700 * p * p) * t) * 0.08) *
        p *
        p *
        vol
      )
    },
    dur,
  )
}

function crash(b, start, vol = 1, length = 2.2) {
  const hp = biquad('hp', 4200, 0.7)
  add(b, start, (t) => hp(noise()) * Math.exp(-t * 2.2) * vol * 0.8, length, -0.2)
  const hp2 = biquad('hp', 4600, 0.7)
  add(b, start, (t) => hp2(noise()) * Math.exp(-t * 2.4) * vol * 0.8, length, 0.2)
}

function tick(b, start, midi, vol = 1) {
  const f = hz(midi)
  add(
    b,
    start,
    (t) =>
      (Math.sin(2 * Math.PI * f * t) * 0.7 + Math.sin(4 * Math.PI * f * t) * 0.2) *
      Math.exp(-t * 38) *
      vol,
    0.2,
    0.1,
  )
}

// ── Harmony ──────────────────────────────────────────────────────────────────────────────
// D major: I – V – vi – IV, one bar each.
const CHORDS = [
  { root: 38, tones: [62, 66, 69] }, // D
  { root: 45, tones: [61, 64, 69] }, // A
  { root: 47, tones: [62, 66, 71] }, // Bm
  { root: 43, tones: [62, 67, 71] }, // G
]
const chordAt = (beat, from) => CHORDS[Math.floor((beat - from) / 4) % 4]

// A sixteen-beat phrase, and its answer. [beat, length, midi]
const PHRASE_A = [
  [0, 1, 78],
  [1, 0.5, 81],
  [1.5, 0.5, 78],
  [2, 1, 76],
  [3, 1, 74],
  [4, 1, 73],
  [5, 1, 76],
  [6, 1.5, 81],
  [8, 1, 83],
  [9, 0.5, 81],
  [9.5, 0.5, 78],
  [10, 1, 74],
  [11, 1, 78],
  [12, 2, 76],
  [14, 1.5, 74],
]
const PHRASE_B = [...PHRASE_A.slice(0, 12), [12, 1, 79], [13, 1, 78], [14, 1, 76], [15, 1, 74]]

// ── The score ────────────────────────────────────────────────────────────────────────────
function compose() {
  const seconds = at(TOTAL_BEATS) + 4
  const drums = bus(seconds)
  const bass = bus(seconds)
  const keys = bus(seconds) // plucks, pads, piano — reverb and sidechain
  const leadBus = bus(seconds)
  const intro = bus(seconds)
  const fx = bus(seconds)

  // 0:00 – 0:11. Restless: a tick on every beat, a low piano each bar, hats creeping in.
  const introBars = [
    [47, 54],
    [43, 50],
    [50, 57],
    [45, 52],
    [47, 54],
    [43, 50],
  ]
  for (let beat = 0; beat < SECTION.stop; beat++) {
    tick(intro, at(beat), 78, 0.32 + beat * 0.012)
    if (beat >= 16) tick(intro, at(beat + 0.5), 78, 0.25)
  }
  for (let q = 19; q < SECTION.stop; q += 0.25)
    tick(intro, at(q + 0.125), 81, 0.1 + (q - 19) * 0.07)
  introBars.forEach(([lo, hi], bar) => {
    if (bar * 4 >= SECTION.stop) return
    piano(intro, at(bar * 4), lo, 0.9, -0.1)
    piano(intro, at(bar * 4 + 0.02), hi, 0.55, 0.1)
    if (bar >= 2) sub(intro, at(bar * 4), at(4) - 0.05, lo - 12, 0.35)
  })
  for (let e = 12; e < SECTION.stop; e += 0.5) hat(intro, at(e), 0.12 + (e >= 16 ? 0.08 : 0))
  for (let s = 18; s < SECTION.stop; s += 0.25) hat(intro, at(s + 0.25 / 2), 0.08)
  pad(intro, at(4), at(SECTION.stop - 4), [59, 62, 66], 0.35, 1100)
  riser(intro, at(18.75), at(SECTION.stop - 18.75), 0.5)
  reverb(intro, { wet: 0.28 })
  // The hard stop: everything, including its own reverb, cut dead.
  const stopAt = Math.round(at(SECTION.stop) * SR)
  for (let n = stopAt; n < intro.L.length; n++) {
    const g = Math.max(0, 1 - (n - stopAt) / (SR * 0.004))
    intro.L[n] *= g
    intro.R[n] *= g
  }

  // 0:11 – 0:18. Near silence, then the swell.
  pad(fx, at(SECTION.stop + 1), at(SECTION.drop - SECTION.stop - 1), [59, 62, 66, 73], 0.12, 900)
  pad(fx, at(30), at(SECTION.drop - 30), [62, 66, 69, 74], 0.22, 1400)
  riser(fx, at(31), at(SECTION.drop - 31), 0.7)

  // The groove, with the sections the picture needs. It stops two beats before the three hits.
  const BREAK = SECTION.end - 2
  const kickOff = (beat) =>
    (beat >= SECTION.through && beat < SECTION.promise) ||
    (beat >= 78 && beat < SECTION.kept) ||
    (beat >= 110 && beat < 112) ||
    (beat >= 118 && beat < SECTION.year) ||
    beat >= BREAK
  const duck = new Float32Array(drums.L.length).fill(1)

  for (let beat = SECTION.drop; beat < BREAK; beat++) {
    const chord = chordAt(beat, SECTION.drop)
    const inBar = (beat - SECTION.drop) % 4
    const big = beat >= SECTION.year
    if (!kickOff(beat)) {
      kick(drums, at(beat), 1)
      const s0 = Math.round(at(beat) * SR)
      for (let i = 0; i < SR * 0.3 && s0 + i < duck.length; i++)
        duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.55 * Math.exp(-(i / SR) * 11))
    }
    if (inBar === 1 || inBar === 3) clap(drums, at(beat), 0.75)
    hat(drums, at(beat + 0.5), 0.3, true)
    if (beat >= 80) {
      hat(drums, at(beat + 0.25), 0.12)
      hat(drums, at(beat + 0.75), 0.12)
    }
    if (inBar === 0) {
      sub(bass, at(beat), at(4) - 0.03, chord.root - 12, 0.9)
      pad(keys, at(beat), at(4), chord.tones, big ? 0.5 : 0.36, big ? 2600 : 1800)
      for (const o of [0, 0.75, 1.5, 2, 2.75, 3.5]) {
        chord.tones.forEach((m, k) =>
          pluck(keys, at(beat + o), m + 12, 0.16, (k - 1) * 0.35, big ? 1.2 : 0.9),
        )
      }
    }
    if (beat >= 80 && beat < BREAK && !(beat >= 110 && beat < 112)) {
      const arp = [...chord.tones, chord.tones[0] + 12]
      for (let s = 0; s < 4; s++)
        pluck(keys, at(beat + s * 0.25), arp[s] + 12, 0.06, s % 2 ? 0.5 : -0.5, 1.3)
    }
  }

  // Fills where the kick drops out.
  riser(fx, at(SECTION.through), at(2), 0.45)
  riser(fx, at(78), at(2), 0.55)
  for (let s = 78; s < SECTION.kept; s += 0.25) clap(drums, at(s), 0.15 + (s - 78) * 0.18)
  riser(fx, at(118), at(2), 0.45)
  riser(fx, at(BREAK), at(2), 0.6)

  // The Kept downbeat.
  crash(drums, at(SECTION.kept), 0.5)

  // The lead: enters after the fly-through, an octave up for the year.
  const phrases = [
    [SECTION.promise, PHRASE_A, 0],
    [SECTION.promise + 16, PHRASE_B, 0],
    [SECTION.kept + 8, PHRASE_A, 0],
    [SECTION.kept + 24, PHRASE_B, 0],
    [SECTION.year - 4 + 4, PHRASE_A, 12],
    [SECTION.money, PHRASE_B, 12],
  ]
  for (const [start, phrase, octave] of phrases) {
    for (const [o, len, m] of phrase) {
      const beat = start + o
      if (beat >= BREAK || (kickOff(beat) && beat >= 110 && beat < 112)) continue
      lead(leadBus, at(beat), at(len) - 0.02, m + octave, octave ? 0.8 : 1)
    }
  }

  // The end: IV – V – I on three hits, then the chord rings out.
  const endChords = [
    { root: 43, tones: [62, 67, 71, 74] }, // G
    { root: 45, tones: [61, 64, 69, 76] }, // A
    { root: 38, tones: [62, 66, 69, 74, 78] }, // D
  ]
  const tail = bus(seconds)
  HITS.forEach((beat, k) => {
    const c = endChords[k]
    const length = k === 2 ? at(SECTION.out - beat) : at(2)
    pad(k === 2 ? tail : keys, at(beat), length, c.tones, 0.6, 3000)
    c.tones.forEach((m, i) => piano(keys, at(beat) + i * 0.012, m, 0.55, (i - 2) * 0.2, 5))
    sub(bass, at(beat), k === 2 ? 4 : at(2) - 0.05, c.root - 12, 1.1, k === 2 ? 1.1 : 0)
    kick(drums, at(beat), 1.2)
    crash(drums, at(beat), 0.55)
  })
  // A last note under the logo.
  piano(keys, at(SECTION.logo), 86, 0.35, 0.2, 5)
  piano(keys, at(SECTION.logo) + 0.02, 74, 0.35, -0.2, 5)

  // The last chord blooms and then lets go, rather than holding and cutting.
  const bloom = Math.round(at(HITS[2]) * SR)
  for (let n = bloom; n < tail.L.length; n++) {
    const t = (n - bloom) / SR
    const g = Math.exp(-Math.max(0, t - 0.6) * 0.55)
    tail.L[n] *= g
    tail.R[n] *= g
  }
  mixInto(keys, tail, 1)

  reverb(keys, { wet: 0.34, decay: 0.86 })
  reverb(leadBus, { wet: 0.3, decay: 0.8 })
  reverb(fx, { wet: 0.4, decay: 0.88 })

  const master = bus(seconds)
  mixInto(master, intro, 1)
  mixInto(master, fx, 0.8)
  mixInto(master, drums, 0.85)
  mixInto(master, bass, 0.75, duck)
  mixInto(master, keys, 0.7, duck)
  mixInto(master, leadBus, 0.42, duck)

  // Fade the tail to silence.
  const end = Math.round((at(SECTION.out) + 1.5) * SR)
  for (let n = 0; n < master.L.length; n++) {
    const g = n < end ? 1 : Math.max(0, 1 - (n - end) / (SR * 2))
    master.L[n] *= g
    master.R[n] *= g
  }
  return master
}

// ── Effects ──────────────────────────────────────────────────────────────────────────────
function oneShot(seconds, draw, { verb = 0 } = {}) {
  const b = bus(seconds)
  draw(b)
  if (verb) reverb(b, { wet: verb })
  return b
}

const SFX = {
  whoosh: () =>
    oneShot(0.7, (b) => {
      const bp = sweep('bp', (t) => 350 + 2600 * Math.sin(Math.PI * Math.min(t / 0.55, 1)), 1.1)
      add(b, 0, (t) => bp(noise(), t) * Math.sin(Math.PI * Math.min(t / 0.6, 1)) ** 2 * 1.8, 0.7)
    }),
  streak: () =>
    oneShot(1.7, (b) => {
      const bp = sweep('bp', (t) => 300 * Math.pow(18, (t / 1.625) ** 2), 1.3)
      add(b, 0, (t) => (t < 1.625 ? bp(noise(), t) * (t / 1.625) ** 2 * 2.2 : 0), 1.7)
    }),
  stop: () =>
    oneShot(0.8, (b) => {
      let ph = 0
      const lp = biquad('lp', 900)
      add(
        b,
        0,
        (t) => {
          ph += (2 * Math.PI * (38 + 60 * Math.exp(-t * 25))) / SR
          return Math.sin(ph) * Math.exp(-t * 7) + lp(noise()) * Math.exp(-t * 90) * 0.5
        },
        0.8,
      )
    }),
  ...Object.fromEntries(
    [81, 86, 90].map((midi, k) => [
      `arrive${k + 1}`,
      () =>
        oneShot(
          1.8,
          (b) => {
            const f = hz(midi)
            add(
              b,
              0,
              (t) =>
                (Math.sin(2 * Math.PI * f * t) +
                  0.4 * Math.sin(2 * Math.PI * f * 2.01 * t) * Math.exp(-t * 4)) *
                env(t, 0.005, 3) *
                0.6,
              1.8,
              (k - 1) * 0.5,
            )
          },
          { verb: 0.45 },
        ),
    ]),
  ),
  riser: () => oneShot(3.1, (b) => riser(b, 0, 3, 1)),
  fly: () =>
    oneShot(1.2, (b) => {
      const bp = sweep('bp', (t) => 200 * Math.pow(25, Math.min(t / 1, 1)), 0.9)
      add(
        b,
        0,
        (t) => bp(noise(), t) * (t < 0.95 ? (t / 0.95) ** 1.5 : Math.exp(-(t - 0.95) * 25)) * 2,
        1.2,
      )
    }),
  grab: () =>
    oneShot(0.2, (b) =>
      add(b, 0, (t) => Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t * 60) * 0.7, 0.2),
    ),
  click: () =>
    oneShot(0.12, (b) =>
      add(
        b,
        0,
        (t) =>
          (Math.sin(2 * Math.PI * 2100 * t) * 0.6 + noise() * Math.exp(-t * 900) * 0.4) *
          Math.exp(-t * 85),
        0.12,
      ),
    ),
  drop: () =>
    oneShot(
      0.7,
      (b) => {
        let ph = 0
        add(
          b,
          0,
          (t) => {
            ph += (2 * Math.PI * (950 * Math.exp(-t * 3.2) + 180)) / SR
            return Math.sin(ph) * env(t, 0.004, 6) * 0.6
          },
          0.7,
        )
      },
      { verb: 0.2 },
    ),
  tick: () =>
    oneShot(0.1, (b) =>
      add(
        b,
        0,
        (t) =>
          (Math.sin(2 * Math.PI * 1750 * t) * 0.7 + Math.sin(2 * Math.PI * 3600 * t) * 0.2) *
          Math.exp(-t * 110),
        0.1,
      ),
    ),
  press: () =>
    oneShot(0.15, (b) => {
      let ph = 0
      add(
        b,
        0,
        (t) => {
          ph += (2 * Math.PI * (180 + 220 * Math.exp(-t * 60))) / SR
          return (Math.sin(ph) + noise() * Math.exp(-t * 500) * 0.3) * Math.exp(-t * 40)
        },
        0.15,
      )
    }),
  bend: () =>
    oneShot(1.2, (b) => {
      let ph = 0
      const bp = sweep('bp', (t) => 400 + 3000 * (t / 1), 1)
      add(
        b,
        0,
        (t) => {
          ph += (2 * Math.PI * (280 + 620 * (t / 1) ** 2)) / SR
          const a = t < 1 ? (t / 1) ** 1.2 : Math.exp(-(t - 1) * 30)
          return (Math.sin(ph) * 0.25 + bp(noise(), t) * 1.2) * a
        },
        1.2,
      )
    }),
  // A ceramic cup set down on wood: inharmonic ring, a low knock, a tick of contact.
  cup: () =>
    oneShot(
      1.6,
      (b) => {
        const partials = [
          [1, 1],
          [2.32, 0.5],
          [4.25, 0.28],
          [6.63, 0.16],
        ]
        add(
          b,
          0,
          (t) => {
            let v = 0
            for (const [r, a] of partials)
              v += Math.sin(2 * Math.PI * 1180 * r * t) * a * Math.exp(-t * (5 + r * 4))
            const knock = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t * 28) * 0.9
            return v * 0.55 + knock + noise() * Math.exp(-t * 700) * 0.3
          },
          1.6,
        )
      },
      { verb: 0.25 },
    ),
  sparkle: () =>
    oneShot(
      1.4,
      (b) => {
        for (let k = 0; k < 9; k++) {
          const f = 3000 + ((k * 1543) % 4000)
          add(
            b,
            k * 0.045,
            (t) => Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) * 0.2,
            1,
            ((k % 3) - 1) * 0.6,
          )
        }
      },
      { verb: 0.4 },
    ),
  swoosh: () =>
    oneShot(0.5, (b) => {
      const bp = sweep('bp', (t) => 700 + 3200 * (t / 0.45), 1.2)
      add(b, 0, (t) => bp(noise(), t) * Math.sin(Math.PI * Math.min(t / 0.45, 1)) ** 2 * 1.2, 0.5)
    }),
  shed: () =>
    oneShot(0.7, (b) => {
      const lp = sweep('lp', (t) => 6000 * Math.exp(-t * 4) + 300, 0.7)
      add(b, 0, (t) => lp(noise(), t) * (t < 0.1 ? t / 0.1 : Math.exp(-(t - 0.1) * 5)) * 0.8, 0.7)
    }),
  ding: () =>
    oneShot(
      1.4,
      (b) => {
        const tone = (f, delay, a) =>
          add(
            b,
            delay,
            (t) =>
              (Math.sin(2 * Math.PI * f * t) +
                0.3 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6)) *
              env(t, 0.003, 3.5) *
              a,
            1.2,
          )
        tone(1318.5, 0, 0.45)
        tone(1975.5, 0.09, 0.4)
      },
      { verb: 0.3 },
    ),
  pop: () =>
    oneShot(0.18, (b) => {
      let ph = 0
      add(
        b,
        0,
        (t) => {
          ph += (2 * Math.PI * (380 + 900 * (t / 0.05))) / SR
          return Math.sin(ph) * env(t, 0.002, 45) * 0.7
        },
        0.18,
      )
    }),
  hit: () =>
    oneShot(
      3,
      (b) => {
        let ph = 0
        add(
          b,
          0,
          (t) => {
            ph += (2 * Math.PI * (48 + 50 * Math.exp(-t * 14))) / SR
            return Math.sin(ph) * Math.exp(-t * 1.8)
          },
          3,
        )
        crash(b, 0, 0.45, 2.5)
      },
      { verb: 0.35 },
    ),
}

mkdirSync('public/next-week/sfx', { recursive: true })
const t0 = Date.now()
writeWav('public/next-week/score.wav', compose())
console.log(`score.wav  ${(Date.now() - t0) / 1000}s`)
for (const [name, make] of Object.entries(SFX)) {
  writeWav(`public/next-week/sfx/${name}.wav`, make(), 0.8)
}
console.log(`${Object.keys(SFX).length} effects`)
