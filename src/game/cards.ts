import { TERRITORY_IDS, type Territory } from './map'

/**
 * The deck: one card per territory, each carrying one of three marks, and two
 * wild cards that stand for any of them.
 *
 * The marks are ours. The published game draws a soldier, a horseman and a
 * cannon; what matters to the rules is only that there are three kinds,
 * fourteen of each, so they are named for what they are and drawn as plain
 * shapes.
 */

export type Mark = 'infantry' | 'cavalry' | 'artillery'

export interface Card {
  /** Null for a wild card. */
  territory: Territory | null
  mark: Mark | 'wild'
}

const MARKS: Mark[] = ['infantry', 'cavalry', 'artillery']

export function fullDeck(): Card[] {
  const cards: Card[] = TERRITORY_IDS.map((territory, i) => ({ territory, mark: MARKS[i % 3] }))
  cards.push({ territory: null, mark: 'wild' }, { territory: null, mark: 'wild' })
  return cards
}

/** Three of a kind, one of each, or anything with a wild card in it. */
export function isSet(cards: readonly Card[]): boolean {
  if (cards.length !== 3) return false
  if (cards.some((c) => c.mark === 'wild')) return true
  const marks = new Set(cards.map((c) => c.mark))
  return marks.size === 1 || marks.size === 3
}

/**
 * What the nth set traded in by anybody is worth: 4, 6, 8, 10, 12, 15, and
 * five more each time after that. The count is shared by the whole table,
 * which is why the value of holding cards rises while nobody else trades.
 */
export function setValue(tradesSoFar: number): number {
  const early = [4, 6, 8, 10, 12, 15]
  if (tradesSoFar < early.length) return early[tradesSoFar]
  return 15 + 5 * (tradesSoFar - early.length + 1)
}

/** Every set that can be made from a hand, as index triples. */
export function setsIn(hand: readonly Card[]): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < hand.length; i++)
    for (let j = i + 1; j < hand.length; j++)
      for (let k = j + 1; k < hand.length; k++)
        if (isSet([hand[i], hand[j], hand[k]])) out.push([i, j, k])
  return out
}
