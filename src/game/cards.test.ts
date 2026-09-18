import { describe, expect, it } from 'vitest'
import { fullDeck, isSet, setValue, setsIn, type Card } from './cards'

const c = (mark: Card['mark']): Card => ({ territory: null, mark })

describe('the deck', () => {
  it('is forty-two territories, fourteen of each mark, and two wild', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(44)
    for (const m of ['infantry', 'cavalry', 'artillery'] as const)
      expect(deck.filter((x) => x.mark === m)).toHaveLength(14)
    expect(deck.filter((x) => x.mark === 'wild')).toHaveLength(2)
  })
})

describe('sets', () => {
  it('are three alike, one of each, or anything with a wild', () => {
    expect(isSet([c('infantry'), c('infantry'), c('infantry')])).toBe(true)
    expect(isSet([c('infantry'), c('cavalry'), c('artillery')])).toBe(true)
    expect(isSet([c('infantry'), c('infantry'), c('wild')])).toBe(true)
    expect(isSet([c('infantry'), c('infantry'), c('cavalry')])).toBe(false)
  })

  it('five cards always hold one', () => {
    const marks = ['infantry', 'cavalry', 'artillery'] as const
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let d = 0; d < 3; d++)
          for (let e = 0; e < 3; e++)
            for (let f = 0; f < 3; f++)
              expect(setsIn([a, b, d, e, f].map((i) => c(marks[i]))).length).toBeGreaterThan(0)
  })

  it('are worth more each time anybody trades one', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(setValue)).toEqual([4, 6, 8, 10, 12, 15, 20, 25, 30])
  })
})
