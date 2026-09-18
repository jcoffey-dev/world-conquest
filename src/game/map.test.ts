import { describe, expect, it } from 'vitest'
import board from './board.json'
import { ADJACENT, BORDERS, CONTINENTS, CONTINENT_IDS, LINK_LIST, TERRITORY_IDS, inContinent } from './map'

describe('the board', () => {
  it('has the classic forty-two territories in six continents', () => {
    expect(TERRITORY_IDS).toHaveLength(42)
    expect(CONTINENT_IDS.map((c) => inContinent(c).length)).toEqual([9, 4, 7, 6, 12, 4])
    expect(CONTINENT_IDS.map((c) => CONTINENTS[c].bonus)).toEqual([5, 2, 5, 3, 7, 2])
  })

  it('has the classic eighty-three links, none twice', () => {
    expect(LINK_LIST).toHaveLength(83)
    const keys = LINK_LIST.map(([a, b]) => [a, b].sort().join('|'))
    expect(new Set(keys).size).toBe(83)
  })

  it('is symmetric, and nothing borders itself', () => {
    for (const t of TERRITORY_IDS) {
      expect(ADJACENT[t]).not.toContain(t)
      for (const n of ADJACENT[t]) expect(ADJACENT[n]).toContain(t)
    }
  })

  it('is one connected world', () => {
    const seen = new Set([TERRITORY_IDS[0]])
    const queue = [TERRITORY_IDS[0]]
    while (queue.length) {
      for (const n of ADJACENT[queue.shift()!]) {
        if (seen.has(n)) continue
        seen.add(n)
        queue.push(n)
      }
    }
    expect(seen.size).toBe(42)
  })

  // The doors are the strategy. If one of these moves, the game has changed.
  it('keeps the doors where every player expects them', () => {
    expect([...BORDERS['australia']]).toEqual(['indonesia'])
    expect([...BORDERS['south-america']].sort()).toEqual(['brazil', 'venezuela'])
    expect([...BORDERS['north-america']].sort()).toEqual(['alaska', 'central-america', 'greenland'])
    expect([...BORDERS['africa']].sort()).toEqual(['east-africa', 'egypt', 'north-africa'])
    expect([...BORDERS['europe']].sort()).toEqual(['iceland', 'southern-europe', 'ukraine', 'western-europe'])
    expect([...BORDERS['asia']].sort()).toEqual(['afghanistan', 'kamchatka', 'middle-east', 'siam', 'ural'])
  })
})

describe('the drawing', () => {
  const drawn = board.territories as Record<string, { d: string; label: number[] }>

  it('draws every territory and nothing else', () => {
    expect(Object.keys(drawn).sort()).toEqual([...TERRITORY_IDS].sort())
  })

  it('can draw a lane for every link that is not a shared border', () => {
    const touching = new Set(board.touching.map((p) => [...p].sort().join('|')))
    const near = board.near as Record<string, number[]>
    for (const [a, b] of LINK_LIST) {
      const key = [a, b].sort().join('|')
      if (touching.has(key) || key === 'alaska|kamchatka') continue
      expect(near[key], key).toBeDefined()
    }
  })
})
