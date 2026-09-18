import { fullDeck, isSet, setValue, type Card } from './cards'
import { roll, type Roll } from './dice'
import {
  ADJACENT,
  CONTINENTS,
  CONTINENT_IDS,
  TERRITORY_IDS,
  adjacent,
  inContinent,
  type Continent,
  type Territory,
} from './map'
import { makeRng, shuffle, type Rng } from './rng'

/**
 * The game, with no interface attached.
 *
 * Every rule lives here and nowhere else, and every move is checked here
 * whether a person or a bot is making it -- so the board can only ever offer
 * what this will accept, and a whole game can be played out in a test from
 * the deal to the last territory.
 *
 * It is a plain mutable object rather than a reducer. A game of this runs to
 * thousands of dice rolls, and copying forty-two territories on every one of
 * them buys nothing the event log does not already give: everything that has
 * ever happened is in `events`, in order, and the interface reads that.
 */

export const PLAYER_COUNT = 6
/** The classic allowance for a six-player table. */
export const STARTING_ARMIES = 20

export type Phase = 'setup' | 'reinforce' | 'attack' | 'occupy' | 'fortify' | 'over'

export interface Player {
  id: number
  human: boolean
  alive: boolean
  cards: Card[]
}

export type GameEvent =
  | { kind: 'deal'; first: number }
  | { kind: 'turn'; player: number; round: number; reinforcements: number }
  | { kind: 'place'; player: number; territory: Territory; count: number }
  | { kind: 'trade'; player: number; cards: Card[]; armies: number; bonus: Territory[] }
  | { kind: 'battle'; player: number; from: Territory; to: Territory; defender: number; roll: Roll }
  | { kind: 'conquer'; player: number; from: Territory; to: Territory; loser: number }
  | { kind: 'occupy'; player: number; from: Territory; to: Territory; count: number }
  | { kind: 'eliminate'; player: number; loser: number; cards: number }
  | { kind: 'fortify'; player: number; from: Territory; to: Territory; count: number }
  | { kind: 'card'; player: number }
  | { kind: 'win'; player: number }

export interface Occupation {
  from: Territory
  to: Territory
  min: number
  max: number
}

export class Game {
  readonly seed: number
  readonly players: Player[]
  readonly owner = {} as Record<Territory, number>
  readonly armies = {} as Record<Territory, number>
  readonly events: GameEvent[] = []

  phase: Phase = 'setup'
  current: number
  first: number
  round = 0
  /** Armies waiting to be placed, in setup or at the start of a turn. */
  reinforcements = 0
  /** In setup, what each player has still to place. */
  readonly toPlace: number[]
  /** Sets traded by anybody, which is what prices the next one. */
  trades = 0
  conquered = false
  occupation: Occupation | null = null
  winner: number | null = null
  /**
   * Set when an elimination handed over enough cards to force a trade in the
   * middle of an attack: the trade, and placing what it pays, then back to
   * attacking.
   */
  resume: 'attack' | null = null

  private deck: Card[]
  private discard: Card[] = []
  private readonly rng: Rng

  constructor(seed: number, human: number | null = 0) {
    this.seed = seed
    this.rng = makeRng(seed)
    this.players = Array.from({ length: PLAYER_COUNT }, (_, id) => ({
      id,
      human: id === human,
      alive: true,
      cards: [],
    }))

    // Deal the territories round the table, one army on each.
    this.first = Math.floor(this.rng() * PLAYER_COUNT)
    const dealt = shuffle(this.rng, TERRITORY_IDS)
    dealt.forEach((t, i) => {
      this.owner[t] = (this.first + i) % PLAYER_COUNT
      this.armies[t] = 1
    })
    this.toPlace = this.players.map((p) => STARTING_ARMIES - this.territoriesOf(p.id).length)
    this.current = this.first
    this.deck = shuffle(this.rng, fullDeck())
    this.events.push({ kind: 'deal', first: this.first })
  }

  // ------------------------------------------------------------- queries

  territoriesOf(player: number): Territory[] {
    return TERRITORY_IDS.filter((t) => this.owner[t] === player)
  }

  armiesOf(player: number): number {
    return this.territoriesOf(player).reduce((n, t) => n + this.armies[t], 0)
  }

  continentsOf(player: number): Continent[] {
    return CONTINENT_IDS.filter((c) => inContinent(c).every((t) => this.owner[t] === player))
  }

  /** A third of your territories, never less than three, and your continents. */
  income(player: number): number {
    const base = Math.max(3, Math.floor(this.territoriesOf(player).length / 3))
    return base + this.continentsOf(player).reduce((n, c) => n + CONTINENTS[c].bonus, 0)
  }

  get alive(): Player[] {
    return this.players.filter((p) => p.alive)
  }

  get hand(): Card[] {
    return this.players[this.current].cards
  }

  /** Five cards in hand at the start of a turn, or after taking a loser's, and you must trade. */
  get mustTrade(): boolean {
    return this.phase === 'reinforce' && this.hand.length >= 5
  }

  get nextSetValue(): number {
    return setValue(this.trades)
  }

  canAttackFrom(t: Territory): boolean {
    return (
      this.phase === 'attack' &&
      this.owner[t] === this.current &&
      this.armies[t] >= 2 &&
      ADJACENT[t].some((n) => this.owner[n] !== this.current)
    )
  }

  attackTargets(t: Territory): Territory[] {
    if (!this.canAttackFrom(t)) return []
    return ADJACENT[t].filter((n) => this.owner[n] !== this.current)
  }

  /** Everywhere reachable from `t` through territories of the same owner. */
  connected(t: Territory): Territory[] {
    const who = this.owner[t]
    const seen = new Set<Territory>([t])
    const queue = [t]
    while (queue.length) {
      const at = queue.shift()!
      for (const n of ADJACENT[at]) {
        if (this.owner[n] === who && !seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
      }
    }
    seen.delete(t)
    return [...seen]
  }

  fortifyTargets(t: Territory): Territory[] {
    if (this.phase !== 'fortify' || this.owner[t] !== this.current || this.armies[t] < 2) return []
    return this.connected(t)
  }

  // ------------------------------------------------------------ actions

  place(t: Territory, count = 1) {
    if (this.owner[t] !== this.current) throw new Error(`${t} is not yours to reinforce`)
    if (count < 1 || !Number.isInteger(count)) throw new Error(`cannot place ${count}`)

    if (this.phase === 'setup') {
      if (count !== 1) throw new Error('setup places one army at a time')
      this.armies[t] += 1
      this.toPlace[this.current]--
      this.events.push({ kind: 'place', player: this.current, territory: t, count: 1 })
      this.advanceSetup()
      return
    }

    if (this.phase !== 'reinforce') throw new Error(`cannot place during ${this.phase}`)
    if (this.mustTrade) throw new Error('trade cards first')
    if (count > this.reinforcements) throw new Error(`only ${this.reinforcements} to place`)
    this.armies[t] += count
    this.reinforcements -= count
    this.events.push({ kind: 'place', player: this.current, territory: t, count })
  }

  /** Hand in three cards, by their positions in the hand. */
  trade(indices: readonly number[]) {
    if (this.phase !== 'reinforce') throw new Error('cards are traded while reinforcing')
    const hand = this.hand
    const unique = [...new Set(indices)]
    if (unique.length !== 3 || unique.some((i) => i < 0 || i >= hand.length))
      throw new Error('a trade is three cards from the hand')
    const cards = unique.map((i) => hand[i])
    if (!isSet(cards)) throw new Error('those three are not a set')

    const armies = setValue(this.trades)
    this.trades++
    this.reinforcements += armies

    // Two extra on one territory you hold that is pictured on the set.
    // Only one of them, however many match.
    const bonus: Territory[] = []
    const pictured = cards.find((c) => c.territory && this.owner[c.territory] === this.current)
    if (pictured?.territory) {
      this.armies[pictured.territory] += 2
      bonus.push(pictured.territory)
    }

    this.players[this.current].cards = hand.filter((_, i) => !unique.includes(i))
    this.discard.push(...cards)
    this.events.push({ kind: 'trade', player: this.current, cards, armies, bonus })
  }

  /** Done placing; on to the fighting (or back to it). */
  beginAttack() {
    if (this.phase !== 'reinforce') throw new Error(`not reinforcing`)
    if (this.mustTrade) throw new Error('trade cards first')
    if (this.reinforcements > 0) throw new Error(`${this.reinforcements} armies still to place`)
    this.phase = 'attack'
    this.resume = null
  }

  /** One throw of the dice. Returns it, and the territory may change hands. */
  attack(from: Territory, to: Territory, dice = 3): Roll {
    if (this.phase !== 'attack') throw new Error(`cannot attack during ${this.phase}`)
    if (this.owner[from] !== this.current) throw new Error(`${from} is not yours`)
    if (this.owner[to] === this.current) throw new Error(`${to} is already yours`)
    if (!adjacent(from, to)) throw new Error(`${from} does not border ${to}`)
    if (this.armies[from] < 2) throw new Error(`${from} has nobody to spare`)

    const attackDice = Math.max(1, Math.min(3, dice, this.armies[from] - 1))
    const defendDice = Math.min(2, this.armies[to])
    const defender = this.owner[to]
    const r = roll(this.rng, attackDice, defendDice)
    this.armies[from] -= r.attackerLoss
    this.armies[to] -= r.defenderLoss
    this.events.push({ kind: 'battle', player: this.current, from, to, defender, roll: r })

    if (this.armies[to] === 0) {
      this.owner[to] = this.current
      this.conquered = true
      this.events.push({ kind: 'conquer', player: this.current, from, to, loser: defender })
      this.occupation = { from, to, min: attackDice, max: this.armies[from] - 1 }
      this.phase = 'occupy'

      if (this.territoriesOf(defender).length === 0) {
        const loser = this.players[defender]
        loser.alive = false
        const taken = loser.cards.length
        this.players[this.current].cards.push(...loser.cards)
        loser.cards = []
        this.events.push({ kind: 'eliminate', player: this.current, loser: defender, cards: taken })
      }
    }
    return r
  }

  /** March into the territory just taken: at least as many as rolled, at most all but one. */
  occupy(count: number) {
    const o = this.occupation
    if (this.phase !== 'occupy' || !o) throw new Error('nothing to occupy')
    if (count < o.min || count > o.max) throw new Error(`move between ${o.min} and ${o.max}`)
    this.armies[o.from] -= count
    this.armies[o.to] = count
    this.events.push({ kind: 'occupy', player: this.current, from: o.from, to: o.to, count })
    this.occupation = null
    this.phase = 'attack'

    if (this.territoriesOf(this.current).length === TERRITORY_IDS.length) {
      this.winner = this.current
      this.phase = 'over'
      this.events.push({ kind: 'win', player: this.current })
      return
    }
    if (this.hand.length >= 6) {
      this.phase = 'reinforce'
      this.resume = 'attack'
      this.reinforcements = 0
    }
  }

  endAttack() {
    if (this.phase !== 'attack') throw new Error(`not attacking`)
    this.phase = 'fortify'
  }

  /** One move between two of your territories joined by your own, and the turn ends. */
  fortify(from: Territory, to: Territory, count: number) {
    if (this.phase !== 'fortify') throw new Error(`not fortifying`)
    if (!this.fortifyTargets(from).includes(to)) throw new Error(`${from} cannot reach ${to}`)
    if (count < 1 || count > this.armies[from] - 1) throw new Error(`cannot move ${count}`)
    this.armies[from] -= count
    this.armies[to] += count
    this.events.push({ kind: 'fortify', player: this.current, from, to, count })
    this.endTurn()
  }

  endTurn() {
    if (this.phase !== 'attack' && this.phase !== 'fortify') throw new Error(`cannot end turn during ${this.phase}`)
    if (this.conquered) {
      if (this.deck.length === 0) {
        this.deck = shuffle(this.rng, this.discard)
        this.discard = []
      }
      const card = this.deck.pop()
      if (card) {
        this.players[this.current].cards.push(card)
        this.events.push({ kind: 'card', player: this.current })
      }
    }
    // A round is counted each time play comes back past the seat that went
    // first, whether or not that player is still at the table.
    let next = this.current
    do {
      next = (next + 1) % PLAYER_COUNT
      if (next === this.first) this.round++
    } while (!this.players[next].alive)
    this.startTurn(next)
  }

  // ------------------------------------------------------------ internals

  private advanceSetup() {
    if (this.toPlace.every((n) => n === 0)) {
      this.round = 1
      this.startTurn(this.first)
      return
    }
    let next = this.current
    do next = (next + 1) % PLAYER_COUNT
    while (this.toPlace[next] === 0)
    this.current = next
  }

  private startTurn(player: number) {
    this.current = player
    this.phase = 'reinforce'
    this.resume = null
    this.conquered = false
    this.reinforcements = this.income(player)
    this.events.push({ kind: 'turn', player, round: this.round, reinforcements: this.reinforcements })
  }
}
