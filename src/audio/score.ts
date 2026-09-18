import type { Tune } from './synth'

/**
 * The score: one march, and what it is.
 *
 * Not a quotation of anything. The idiom belongs to nobody -- a minor key, a
 * dotted figure, brass moving over a band that holds its chords a bar at a
 * time, and a side drum that never lets up -- and it is the same idiom the
 * seven-power game uses, so the two sound like the same site without either
 * borrowing a bar from the other.
 *
 * C minor, where that game is in D, and a little quicker: this is a game of
 * dice and it moves faster than a game of letters. It loops for as long as
 * the war does, and stops when somebody has the world.
 *
 * Eight bars. The first four climb the dotted figure twice and fall back;
 * the second four answer them from a fourth higher and come home on the
 * dominant borrowed from the harmonic minor -- the B natural in bar seven is
 * the only note that is not in the key, and it is the one that makes the
 * loop want to go round again.
 */

const bar = (...steps: string[]) => steps
const held = (chord: string) => [chord, '=', '=', '=', '=', '=', '=', '=']

export const MARCH: Tune = {
  bpm: 108,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'saw',
      gain: 0.11,
      gate: 0.92,
      detune: 6,
      filter: { from: 1700, to: 900, q: 1.3 },
      notes: [
        ...bar('C4', '=', '=', 'D4', 'D#4', '=', '=', '='),
        ...bar('D4', '=', '=', 'D#4', 'F4', '=', '=', '='),
        ...bar('G4', '=', '=', '=', 'F4', '=', 'D#4', '='),
        ...bar('D4', '=', '=', '=', '=', '=', '.', '.'),
        ...bar('F4', '=', '=', 'G4', 'G#4', '=', '=', '='),
        ...bar('G4', '=', '=', 'F4', 'D#4', '=', '=', '='),
        ...bar('D4', '=', '=', '=', 'B3', '=', 'D4', '='),
        ...bar('C4', '=', '=', '=', '=', '=', '=', '.'),
      ],
    },
    {
      wave: 'pulse50',
      gain: 0.04,
      gate: 1,
      notes: [
        ...held('C3/D#3/G3'),
        ...held('G#2/C3/D#3'),
        ...held('C3/D#3/G3'),
        ...held('G2/B2/D3'),
        ...held('F2/G#2/C3'),
        ...held('C3/D#3/G3'),
        ...held('G2/B2/D3'),
        ...held('C3/D#3/G3'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.22,
      gate: 1,
      notes: [
        ...held('C2'),
        ...held('G#1'),
        ...held('C2'),
        ...held('G1'),
        ...held('F1'),
        ...held('C2'),
        ...held('G1'),
        ...held('C2'),
      ],
    },
    {
      // The side drum, marking the end of each half rather than vamping.
      wave: 'noise',
      gain: 0.14,
      notes: [
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', 'S'),
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', '.'),
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', 'S'),
        ...bar('S', 'S', 'S', 'S', 'S', '.', 'S', '.'),
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', 'S'),
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', '.'),
        ...bar('S', '.', 'S', 'S', '.', 'S', '.', 'S'),
        ...bar('S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'),
      ],
    },
    {
      wave: 'noise',
      gain: 0.28,
      notes: Array.from({ length: 64 }, (_, i) => (i % 4 === 0 ? 'K' : '.')),
    },
  ],
}
