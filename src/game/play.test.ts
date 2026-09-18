import { describe, expect, it } from 'vitest'
import { apply, decide, leanings } from './bot'
import { Game, PLAYER_COUNT } from './game'

/**
 * Six bots left alone, to the end.
 *
 * The question that matters about the bots is not whether each move looks
 * sensible but whether a table of them ever finishes. A game that cannot be
 * won is not a hard game, it is a broken one -- so these play out in full,
 * on thirty seeds, and every one of them has to end in a winner.
 */
export function playOut(seed: number, limit = 20000) {
  const g = new Game(seed, null)
  const lean = leanings(seed, PLAYER_COUNT)
  let actions = 0
  while (g.phase !== 'over' && actions < limit) {
    apply(g, decide(g, lean[g.current]))
    actions++
  }
  return { g, actions }
}

describe('a table of bots', () => {
  it('plays every seed through to a winner', () => {
    const rounds: number[] = []
    for (let seed = 1; seed <= 30; seed++) {
      const { g } = playOut(seed)
      expect(g.phase, `seed ${seed}`).toBe('over')
      expect(g.winner).not.toBeNull()
      expect(g.territoriesOf(g.winner!)).toHaveLength(42)
      rounds.push(g.round)
    }
    const mean = rounds.reduce((a, b) => a + b, 0) / rounds.length
    console.log(`rounds: mean ${mean.toFixed(1)}, min ${Math.min(...rounds)}, max ${Math.max(...rounds)}`)
    expect(Math.max(...rounds)).toBeLessThan(80)
  })

  it('does not always hand it to the same seat', () => {
    const winners = new Set<number>()
    for (let seed = 1; seed <= 30; seed++) winners.add(playOut(seed).g.winner!)
    expect(winners.size).toBeGreaterThan(3)
  })

  it('replays exactly from the same seed', () => {
    const a = playOut(7).g
    const b = playOut(7).g
    expect(a.events.length).toBe(b.events.length)
    expect(a.winner).toBe(b.winner)
  })
})
