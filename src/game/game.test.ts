import { describe, expect, it } from 'vitest'
import { Game, STARTING_ARMIES } from './game'
import { TERRITORY_IDS, type Territory } from './map'

/** Place every setup army wherever it is legal, so a test can start at turn one. */
function pastSetup(g: Game) {
  while (g.phase === 'setup') g.place(g.territoriesOf(g.current)[0])
}

describe('the deal', () => {
  it('shares the world out seven each, with twenty armies apiece', () => {
    const g = new Game(1)
    for (const p of g.players) expect(g.territoriesOf(p.id)).toHaveLength(7)
    pastSetup(g)
    for (const p of g.players) expect(g.armiesOf(p.id)).toBe(STARTING_ARMIES)
    expect(g.phase).toBe('reinforce')
    expect(g.current).toBe(g.first)
    expect(g.round).toBe(1)
  })

  it('is the same deal for the same seed', () => {
    const a = new Game(42)
    const b = new Game(42)
    expect(TERRITORY_IDS.map((t) => a.owner[t])).toEqual(TERRITORY_IDS.map((t) => b.owner[t]))
  })
})

describe('reinforcements', () => {
  it('are a third of your territories, at least three, plus whole continents', () => {
    const g = new Game(1)
    const p = 0
    for (const t of TERRITORY_IDS) g.owner[t] = 1
    expect(g.income(p)).toBe(3)
    for (const t of ['indonesia', 'new-guinea', 'western-australia', 'eastern-australia'] as Territory[])
      g.owner[t] = p
    expect(g.income(p)).toBe(3 + 2)
    for (const t of TERRITORY_IDS.slice(0, 15)) g.owner[t] = p
    // 19 territories, North and South America and Australia.
    expect(g.territoriesOf(p)).toHaveLength(19)
    expect(g.income(p)).toBe(6 + 5 + 2 + 2)
  })
})

describe('a battle', () => {
  function staged(attackers: number, defenders: number) {
    const g = new Game(3)
    pastSetup(g)
    for (const t of TERRITORY_IDS) {
      g.owner[t] = 1
      g.armies[t] = 1
    }
    g.current = 0
    g.owner.brazil = 0
    g.armies.brazil = attackers
    g.armies['north-africa'] = defenders
    g.reinforcements = 0
    g.beginAttack()
    return g
  }

  it('refuses what the rules refuse', () => {
    const g = staged(5, 2)
    expect(() => g.attack('brazil', 'china')).toThrow(/border/)
    expect(() => g.attack('peru', 'brazil')).toThrow(/not yours/)
    g.armies.brazil = 1
    expect(() => g.attack('brazil', 'north-africa')).toThrow(/spare/)
  })

  it('takes a territory, marches in, and earns a card', () => {
    const g = staged(40, 1)
    while (g.phase === 'attack') g.attack('brazil', 'north-africa')
    expect(g.phase).toBe('occupy')
    expect(g.owner['north-africa']).toBe(0)
    const o = g.occupation!
    expect(o.min).toBe(3)
    expect(() => g.occupy(o.min - 1)).toThrow()
    g.occupy(o.max)
    expect(g.armies.brazil).toBe(1)
    g.endAttack()
    g.endTurn()
    expect(g.players[0].cards).toHaveLength(1)
  })

  it('hands over the loser\'s cards and forces a trade at six', () => {
    const g = staged(40, 1)
    for (const t of TERRITORY_IDS) if (t !== 'north-africa' && t !== 'brazil') g.owner[t] = 2
    g.players[0].cards = [
      { territory: 'china', mark: 'infantry' },
      { territory: 'peru', mark: 'cavalry' },
      { territory: 'egypt', mark: 'infantry' },
    ]
    g.players[1].cards = [
      { territory: 'japan', mark: 'cavalry' },
      { territory: 'siam', mark: 'cavalry' },
      { territory: 'ural', mark: 'artillery' },
    ]
    while (g.phase === 'attack') g.attack('brazil', 'north-africa')
    expect(g.players[1].alive).toBe(false)
    g.occupy(3)
    expect(g.phase).toBe('reinforce')
    expect(g.mustTrade).toBe(true)
    expect(() => g.beginAttack()).toThrow(/trade/)
    g.trade([0, 1, 5])
    expect(g.hand).toHaveLength(3)
    g.place('brazil', g.reinforcements)
    g.beginAttack()
    expect(g.phase).toBe('attack')
  })
})

describe('fortifying', () => {
  it('moves once, along a chain of your own, and ends the turn', () => {
    const g = new Game(5)
    pastSetup(g)
    for (const t of TERRITORY_IDS) g.owner[t] = 1
    const me = g.current
    for (const t of ['alaska', 'alberta', 'western-us'] as Territory[]) g.owner[t] = me
    g.armies.alaska = 6
    g.place('alaska', g.reinforcements)
    g.beginAttack()
    g.endAttack()
    expect(g.fortifyTargets('alaska').sort()).toEqual(['alberta', 'western-us'])
    expect(() => g.fortify('alaska', 'ontario', 1)).toThrow()
    const before = g.current
    g.fortify('alaska', 'western-us', 3)
    expect(g.current).not.toBe(before)
  })
})
