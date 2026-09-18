import { describe as suite, expect, it } from 'vitest'
import { describe } from './describe'
import type { GameEvent } from './game'

const throwOf = (attackerLoss: number, defenderLoss: number): GameEvent => ({
  kind: 'battle',
  player: 1,
  from: 'peru',
  to: 'brazil',
  defender: 0,
  roll: { attack: [], defend: [], attackerLoss, defenderLoss },
})

suite('the log', () => {
  it('folds a run of throws into one line', () => {
    const lines = describe([throwOf(1, 1), throwOf(2, 0), { kind: 'card', player: 1 }], 0)
    expect(lines.map((l) => l.text)).toEqual(['Cobalt attacked Brazil from Peru: lost 3, killed 1.'])
  })

  it('lets a conquest speak for the fight that won it', () => {
    const lines = describe(
      [throwOf(0, 2), throwOf(1, 1), { kind: 'conquer', player: 1, from: 'peru', to: 'brazil', loser: 0 }],
      0,
    )
    expect(lines.map((l) => l.text)).toEqual(['Cobalt took Brazil from you (lost 1, killed 3).'])
  })

  it('speaks to the player in the second person', () => {
    const lines = describe([{ kind: 'eliminate', player: 3, loser: 0, cards: 2 }], 0)
    expect(lines[0].text).toBe('You are out, finished by Jade, who takes 2 cards.')
  })
})
