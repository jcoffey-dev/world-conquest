/**
 * The synth, shared with its siblings.
 *
 * The engine below -- the scheduler, the six voices and the small kit -- is
 * the one written for the lemonade stand and carried through the cave game,
 * the starship and the seven powers. Same author, same license, and
 * deliberately not forked: a look-ahead scheduler is not the part of a game
 * worth writing five times.
 *
 * What is written *for this game* is everything under "the war", and the
 * score in `score.ts`. This is a game of dice, so the dice get the most care:
 * a throw is heard as the number of dice actually thrown.
 */

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

/** "C#4" -> Hz. A4 = 440. */
export function noteToFreq(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return 0
  const semis = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12
  return 440 * Math.pow(2, (semis - 69) / 12)
}

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw' | 'noise'

export interface Track {
  wave: Wave
  gain: number
  /**
   * One entry per step. '.' rest, '=' sustain previous, otherwise a note.
   * Slashes stack notes into a chord: "F4/A4/C5". On a noise track the
   * letter picks the drum: K kick, S snare, C clap, H closed hat, O open hat.
   */
  notes: string[]
  /** Sweeping lowpass, the whole point of a funk bass. */
  filter?: { from: number; to: number; q?: number }
  /** Fraction of the note's length actually sounded; low values are stabs. */
  gate?: number
  /** Cents, for a fatter unison. */
  detune?: number
}

export interface Tune {
  bpm: number
  stepsPerBeat: number
  tracks: Track[]
  /** 0 is straight, ~0.15 is a light funk shuffle. Delays every other step. */
  swing?: number
}

/** Fourier series for a pulse wave of the given duty cycle. */
function pulseWave(ctx: AudioContext, duty: number, harmonics = 24): PeriodicWave {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
}

export class Synth {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private waves: Partial<Record<Wave, PeriodicWave>> = {}
  private noiseBuffer!: AudioBuffer

  private tune: Tune | null = null
  private step = 0
  private nextStepTime = 0
  private timer: number | null = null

  musicOn = true
  sfxOn = true

  /** Must be called from a user gesture the first time. */
  ensure(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(ctx.destination)

    /*
     * The buses open at whatever the toggles already say, not at full.
     * A one-shot calls `ensure` itself, so a game started with the sound
     * turned off would otherwise make exactly one noise -- the first one --
     * before anything got round to muting it.
     */
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicOn ? 0.55 : 0
    this.musicBus.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0
    this.sfxBus.connect(this.master)

    this.waves.pulse12 = pulseWave(ctx, 0.125)
    this.waves.pulse25 = pulseWave(ctx, 0.25)
    this.waves.pulse50 = pulseWave(ctx, 0.5)

    const len = Math.floor(ctx.sampleRate * 1.5)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf

    return ctx
  }

  setMusic(on: boolean) {
    this.musicOn = on
    if (!this.ctx) return
    this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05)
  }

  setSfx(on: boolean) {
    this.sfxOn = on
    if (!this.ctx) return
    this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02)
  }

  // ---------------------------------------------------------------- voices

  private voice(
    dest: AudioNode,
    wave: Wave,
    freq: number,
    at: number,
    dur: number,
    gain: number,
    opts: { filter?: Track['filter']; detune?: number } = {},
  ) {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    if (wave === 'triangle') osc.type = 'triangle'
    else if (wave === 'saw') osc.type = 'sawtooth'
    else osc.setPeriodicWave(this.waves[wave] ?? this.waves.pulse50!)
    osc.frequency.setValueAtTime(freq, at)
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, at)

    const env = ctx.createGain()
    const peak = Math.max(0.0001, gain)
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    env.gain.setValueAtTime(peak, at + Math.max(0.02, dur * 0.6))
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    let node: AudioNode = osc
    if (opts.filter) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = opts.filter.q ?? 6
      lp.frequency.setValueAtTime(opts.filter.from, at)
      lp.frequency.exponentialRampToValueAtTime(
        Math.max(60, opts.filter.to),
        at + Math.max(0.05, dur),
      )
      osc.connect(lp)
      node = lp
    }

    node.connect(env).connect(dest)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  /** A small kit: pitched-sine kick, noise-and-tone snare, clap, two hats. */
  private drum(dest: AudioNode, kind: string, at: number, gain: number) {
    const ctx = this.ensure()

    if (kind === 'K') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(130, at)
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.11)
      const env = ctx.createGain()
      env.gain.setValueAtTime(gain * 1.5, at)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
      osc.connect(env).connect(dest)
      osc.start(at)
      osc.stop(at + 0.26)
      return
    }

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    const env = ctx.createGain()
    let dur = 0.05

    if (kind === 'S' || kind === 'C') {
      filter.type = 'bandpass'
      filter.frequency.value = kind === 'S' ? 1900 : 1300
      filter.Q.value = kind === 'S' ? 0.9 : 2.4
      dur = kind === 'S' ? 0.16 : 0.1
      if (kind === 'S') {
        // A little body under the crack.
        const tone = ctx.createOscillator()
        tone.type = 'triangle'
        tone.frequency.setValueAtTime(210, at)
        tone.frequency.exponentialRampToValueAtTime(150, at + 0.09)
        const tenv = ctx.createGain()
        tenv.gain.setValueAtTime(gain * 0.6, at)
        tenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
        tone.connect(tenv).connect(dest)
        tone.start(at)
        tone.stop(at + 0.12)
      }
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 7200
      dur = kind === 'O' ? 0.22 : 0.035
    }

    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    noise.connect(filter).connect(env).connect(dest)
    noise.start(at)
    noise.stop(at + dur + 0.02)
  }

  // ------------------------------------------------------------- sequencer

  playTune(tune: Tune, restart = true) {
    this.ensure()
    if (this.tune === tune && this.timer !== null && !restart) return
    this.stopTune()
    this.tune = tune
    this.step = 0
    this.nextStepTime = this.ctx!.currentTime + 0.08
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopTune() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.tune = null
  }

  get playing() {
    return this.timer !== null
  }

  private schedule() {
    const ctx = this.ctx
    const tune = this.tune
    if (!ctx || !tune) return
    const stepDur = 60 / tune.bpm / tune.stepsPerBeat
    const length = Math.max(...tune.tracks.map((t) => t.notes.length))
    const swing = tune.swing ?? 0

    while (this.nextStepTime < ctx.currentTime + 0.2) {
      // A shuffle pushes every other step late without moving the downbeats.
      const at = this.nextStepTime + (this.step % 2 === 1 ? swing * stepDur : 0)

      for (const track of tune.tracks) {
        const note = track.notes[this.step % track.notes.length]
        if (!note || note === '.' || note === '=') continue

        // A note runs until the next step that is not a sustain marker.
        let held = 1
        for (let i = 1; i < length; i++) {
          if (track.notes[(this.step + i) % track.notes.length] === '=') held++
          else break
        }
        const dur = held * stepDur * (track.gate ?? 0.95)

        if (track.wave === 'noise') {
          this.drum(this.musicBus, note, at, track.gain)
          continue
        }

        for (const part of note.split('/')) {
          const f = noteToFreq(part)
          if (!f) continue
          this.voice(this.musicBus, track.wave, f, at, dur, track.gain, {
            filter: track.filter,
            detune: track.detune,
          })
        }
      }
      this.nextStepTime += stepDur
      this.step = (this.step + 1) % length
    }
  }

  // ------------------------------------------------------------------ sfx

  private seq(notes: [string, number][], wave: Wave = 'pulse25', gain = 0.22) {
    const ctx = this.ensure()
    let t = ctx.currentTime + 0.01
    for (const [note, dur] of notes) {
      if (note !== '.') this.voice(this.sfxBus, wave, noteToFreq(note), t, dur, gain)
      t += dur
    }
  }

  /** A click on the map. Small, dry, and not a musical note. */
  tap() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 1.4
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.1, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.035)
    src.connect(bp).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 0.05)
  }

  /** A choice made: a territory picked, a number settled. */
  written() {
    this.seq([['B4', 0.045], ['E5', 0.08]], 'triangle', 0.14)
  }

  /** Something the rules will not take. */
  reject() {
    this.seq([['A3', 0.09], ['D#3', 0.18]], 'saw', 0.16)
  }

  // -------------------------------------------------------------- the war

  /**
   * Dice on a table.
   *
   * A die is a handful of short bright knocks at uneven spacing, slowing as
   * it loses energy, and then it stops -- so the gaps grow and the knocks
   * quieten, which between them is the whole illusion. As many as were
   * thrown, up to five, each a hair behind the last so they do not merge.
   */
  dice(count = 2) {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01

    for (let die = 0; die < Math.min(5, count); die++) {
      let t = at + die * 0.035
      let gap = 0.035
      for (let i = 0; i < 8; i++) {
        const knock = ctx.createBufferSource()
        knock.buffer = this.noiseBuffer
        knock.playbackRate.value = 1.3 + die * 0.15
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1500 + ((i * 7 + die * 11) % 5) * 260
        bp.Q.value = 3
        const env = ctx.createGain()
        const gain = 0.1 * (1 - i / 9)
        env.gain.setValueAtTime(gain, t)
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
        knock.connect(bp).connect(env).connect(this.sfxBus)
        knock.start(t)
        knock.stop(t + 0.04)
        t += gap
        gap *= 1.2
      }
    }
  }

  /**
   * A field gun, and the shell landing.
   *
   * A crack with almost no body, then a lowpassed thump a beat later with
   * plenty. Artillery at a distance is mostly the second one, so the first is
   * kept quiet and quick -- turn it up and the whole thing becomes a drum.
   */
  private gun(at: number, gain: number, pitch: number) {
    const ctx = this.ensure()

    const crack = ctx.createBufferSource()
    crack.buffer = this.noiseBuffer
    crack.playbackRate.value = 1.2
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1100
    const cenv = ctx.createGain()
    cenv.gain.setValueAtTime(gain * 0.5, at)
    cenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
    crack.connect(hp).connect(cenv).connect(this.sfxBus)
    crack.start(at)
    crack.stop(at + 0.11)

    const body = ctx.createBufferSource()
    body.buffer = this.noiseBuffer
    body.playbackRate.value = 0.45
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 1.2
    lp.frequency.setValueAtTime(900, at + 0.02)
    lp.frequency.exponentialRampToValueAtTime(110, at + 0.5)
    const benv = ctx.createGain()
    benv.gain.setValueAtTime(0.0001, at + 0.02)
    benv.gain.exponentialRampToValueAtTime(gain, at + 0.05)
    benv.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
    body.connect(lp).connect(benv).connect(this.sfxBus)
    body.start(at + 0.02)
    body.stop(at + 0.6)

    const boom = ctx.createOscillator()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(pitch, at + 0.03)
    boom.frequency.exponentialRampToValueAtTime(pitch * 0.35, at + 0.4)
    const oenv = ctx.createGain()
    oenv.gain.setValueAtTime(gain * 0.8, at + 0.03)
    oenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.45)
    boom.connect(oenv).connect(this.sfxBus)
    boom.start(at + 0.03)
    boom.stop(at + 0.5)
  }

  /**
   * A territory changing hands.
   *
   * Three guns and a bugle going up. The dice are the fight; this is the
   * moment it is over, so it is shorter than a barrage and ends on the
   * rising interval that has meant "forward" since there were bugles.
   */
  conquest() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, offset] of [0, 0.14, 0.31].entries()) this.gun(at + offset, 0.2 - i * 0.03, 88 - i * 8)
    const t = 0.42
    for (const [i, note] of ['C4', 'G4'].entries()) {
      this.voice(this.sfxBus, 'saw', noteToFreq(note), at + t + i * 0.13, i ? 0.32 : 0.12, 0.1, {
        filter: { from: 2400, to: 1200, q: 1 },
      })
    }
  }

  /** Armies raised: a drum and a short rising figure, quieter the more often it plays. */
  muster() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    this.drum(this.sfxBus, 'K', at, 0.22)
    this.seq([['G3', 0.06], ['C4', 0.1]], 'triangle', 0.1)
  }

  /**
   * Cards traded in.
   *
   * A fanfare, because it is the one moment in the game when armies appear
   * out of nowhere and everybody at the table notices. Three notes up and a
   * held fourth; the later the set, the more it is worth, and the higher it
   * starts.
   */
  fanfare(worth: number) {
    const lift = Math.min(7, Math.floor(worth / 5))
    const root = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'][lift]
    const f = noteToFreq(root)
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, [ratio, dur]] of [[1, 0.12], [1.25, 0.12], [1.5, 0.12], [2, 0.5]].entries()) {
      this.voice(this.sfxBus, 'saw', f * ratio, at + i * 0.14, dur, 0.09, {
        filter: { from: 2600, to: 1400, q: 1 },
        detune: 5,
      })
    }
  }

  /** A player gone from the board, and not you: the drum stopping. */
  fallen() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    this.drum(this.sfxBus, 'K', at, 0.3)
    this.drum(this.sfxBus, 'K', at + 0.3, 0.2)
    this.seq([['.', 0.3], ['E4', 0.18], ['D#4', 0.6]], 'triangle', 0.12)
  }

  // ---------------------------------------------------------- the endings

  private bell(at: number, note: string, partials: readonly (readonly [number, number, number])[]) {
    const ctx = this.ensure()
    const f = noteToFreq(note)
    for (const [mult, gain, dur] of partials) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f * mult
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, at)
      env.gain.exponentialRampToValueAtTime(gain, at + 0.01)
      env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      osc.connect(env).connect(this.sfxBus)
      osc.start(at)
      osc.stop(at + dur + 0.05)
    }
  }

  /** The world. Bells, and guns firing at nothing. */
  victory() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, note] of ['C5', 'G4', 'E4', 'C4', 'G4', 'C5'].entries()) {
      this.bell(at + i * 0.42, note, [[1, 0.13, 2.6], [2.76, 0.05, 1.1], [5.4, 0.025, 0.5]])
    }
    for (const offset of [0.6, 1.4, 2.1]) this.gun(at + offset, 0.12, 80)
  }

  /** Somebody else's world: the same bells, in a minor key, for a flag that is not yours. */
  defeat() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, note] of ['C4', 'D#4', 'G3', 'C3'].entries()) {
      this.bell(at + i * 0.5, note, [[1, 0.13, 3], [2.76, 0.04, 1.2]])
    }
  }

  /** Your last territory. A single low bell and nothing after it. */
  eliminated() {
    const ctx = this.ensure()
    this.bell(ctx.currentTime + 0.01, 'C2', [[1, 0.16, 4], [2.76, 0.05, 1.6]])
  }
}

export const synth = new Synth()
