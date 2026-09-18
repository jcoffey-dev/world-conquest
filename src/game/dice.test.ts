import { describe, expect, it } from 'vitest'
import { OUTCOMES, compare, roll, winChance } from './dice'
import { makeRng } from './rng'

describe('one throw', () => {
  it('matches highest against highest, and a tie goes to the defender', () => {
    expect(compare([6, 1, 3], [6, 2])).toMatchObject({ attackerLoss: 1, defenderLoss: 1 })
    expect(compare([5, 5, 5], [4, 4])).toMatchObject({ attackerLoss: 0, defenderLoss: 2 })
    expect(compare([2], [2, 1])).toMatchObject({ attackerLoss: 1, defenderLoss: 0 })
  })

  it('rolls the dice it was asked for', () => {
    const r = roll(makeRng(1), 3, 2)
    expect(r.attack).toHaveLength(3)
    expect(r.defend).toHaveLength(2)
    expect(r.attackerLoss + r.defenderLoss).toBe(2)
  })
})

describe('the odds', () => {
  // The figures everybody quotes, to four places.
  it('agrees with the published exchange tables', () => {
    const three = OUTCOMES['3v2']
    expect(three.get(0)).toBeCloseTo(2890 / 7776, 10)
    expect(three.get(1)).toBeCloseTo(2611 / 7776, 10)
    expect(three.get(2)).toBeCloseTo(2275 / 7776, 10)
    expect(OUTCOMES['1v1'].get(0)).toBeCloseTo(15 / 36, 10)
    expect(OUTCOMES['3v1'].get(0)).toBeCloseTo(855 / 1296, 10)
    expect(OUTCOMES['2v2'].get(0)).toBeCloseTo(295 / 1296, 10)
  })

  it('knows what a whole battle is worth', () => {
    expect(winChance(1, 1)).toBeCloseTo(0.4167, 3)
    expect(winChance(3, 2)).toBeCloseTo(0.6560, 3)
    // Two against one: win the first exchange, or lose it and win one-on-one.
    expect(winChance(2, 1)).toBeCloseTo(125 / 216 + (91 / 216) * (15 / 36), 12)
    expect(winChance(10, 10)).toBeGreaterThan(0.5)
    expect(winChance(5, 0)).toBe(1)
    expect(winChance(0, 3)).toBe(0)
  })

  it('agrees with the dice when they are actually thrown', () => {
    const rng = makeRng(99)
    let wins = 0
    const games = 20000
    for (let i = 0; i < games; i++) {
      let a = 5
      let d = 4
      while (a > 0 && d > 0) {
        const r = roll(rng, Math.min(3, a), Math.min(2, d))
        a -= r.attackerLoss
        d -= r.defenderLoss
      }
      if (d === 0) wins++
    }
    expect(wins / games).toBeCloseTo(winChance(5, 4), 1)
  })
})
