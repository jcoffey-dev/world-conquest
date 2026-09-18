import { setsIn, type Card } from './cards'
import { winChance } from './dice'
import type { Game } from './game'
import {
  ADJACENT,
  BORDERS,
  CONTINENTS,
  CONTINENT_IDS,
  TERRITORIES,
  inContinent,
  type Continent,
  type Territory,
} from './map'
import { makeRng } from './rng'

/**
 * The five opponents.
 *
 * A bot keeps no plan between moves. Every time it is asked, it looks at the
 * board and answers with the one thing it would do next -- trade, place,
 * throw the dice, march in, move up, or stop -- so it can never be caught
 * holding a plan the dice have already made nonsense of, and a game can be
 * stopped and resumed anywhere without anybody's intentions going stale.
 *
 * What it wants comes down to three things, in this order: a continent it
 * can hold, a card for the turn, and nobody else holding a continent in
 * peace. Every attack is priced as what winning is worth times the exact
 * chance of winning it, from `dice.ts` -- not a rule of thumb about armies.
 * A player watching one of these turn on them is owed a reason, and "it had
 * a 71% chance at Brazil and Brazil finished South America" is one.
 */

export type Action =
  | { type: 'place'; territory: Territory; count: number }
  | { type: 'trade'; cards: [number, number, number] }
  | { type: 'beginAttack' }
  | { type: 'attack'; from: Territory; to: Territory }
  | { type: 'occupy'; count: number }
  | { type: 'endAttack' }
  | { type: 'fortify'; from: Territory; to: Territory; count: number }
  | { type: 'endTurn' }

export interface Leaning {
  /** 0 is careful, 1 is reckless. Moves the odds a bot will fight at. */
  nerve: number
  /** A small private taste for some continents over others. */
  taste: Record<Continent, number>
}

/**
 * Six minds reasoning identically play the same game every time. Each one
 * leans a little -- braver or more careful, fonder of one continent -- and
 * the lean comes from the seed, so a seed still replays a game exactly.
 */
export function leanings(seed: number, players: number): Leaning[] {
  return Array.from({ length: players }, (_, id) => {
    const rng = makeRng(seed * 31 + id * 7919 + 1)
    return {
      nerve: rng(),
      taste: Object.fromEntries(CONTINENT_IDS.map((c) => [c, 0.85 + rng() * 0.3])) as Record<
        Continent,
        number
      >,
    }
  })
}

// ------------------------------------------------------------ appraisal

/** How hard each continent would be to take from here, and what it pays. */
export function goal(g: Game, p: number, lean: Leaning): Continent | null {
  let best: Continent | null = null
  let bestScore = -Infinity
  for (const c of CONTINENT_IDS) {
    const land = inContinent(c)
    const mine = land.filter((t) => g.owner[t] === p)
    if (mine.length === land.length) continue
    if (mine.length === 0 && !land.some((t) => ADJACENT[t].some((n) => g.owner[n] === p))) continue
    const theirs = land.filter((t) => g.owner[t] !== p).reduce((n, t) => n + g.armies[t], 0)
    const ours = mine.reduce((n, t) => n + g.armies[t], 0)
    const held = mine.length / land.length
    // What it pays, made cheaper by what is already there and dearer by the
    // opposition and by every door that will need watching afterwards.
    const score =
      (CONTINENTS[c].bonus * (1 + held) ** 2 * lean.taste[c] * (1 + ours / 10)) /
      ((theirs + 1) * Math.sqrt(BORDERS[c].length))
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

const enemies = (g: Game, t: Territory) => ADJACENT[t].filter((n) => g.owner[n] !== g.owner[t])

const threat = (g: Game, t: Territory) => enemies(g, t).reduce((n, e) => n + g.armies[e], 0)

/** What taking `t` would be worth to `p`, before the odds. */
export function worth(g: Game, p: number, t: Territory, target: Continent | null): number {
  const c = TERRITORIES[t].continent
  const holder = g.owner[t]
  const land = inContinent(c)
  let v = 1
  if (c === target) v += 3
  // The last one in a continent pays out every turn.
  if (land.every((x) => x === t || g.owner[x] === p)) v += CONTINENTS[c].bonus * 2
  // Somebody else's continent stops paying the moment one territory goes.
  if (land.every((x) => g.owner[x] === holder)) v += CONTINENTS[c].bonus * 1.5
  // Finishing a player off hands over their cards.
  const left = g.territoriesOf(holder).length
  if (left <= 2) v += 2 + g.players[holder].cards.length * 2
  // A territory taken this turn is a card at the end of it; the first one
  // is worth more than any after.
  if (!g.conquered) v += 2
  return v
}

interface Plan {
  from: Territory
  to: Territory
  odds: number
  value: number
}

function bestAttack(g: Game, p: number, lean: Leaning): Plan | null {
  const target = goal(g, p, lean)
  // The odds a bot will fight at: between about 55% and 75%, by nerve. For
  // the first territory of the turn it will go lower, because the card is
  // on the line and a card is armies later.
  const floor = 0.75 - lean.nerve * 0.2
  let best: Plan | null = null
  for (const from of g.territoriesOf(p)) {
    if (g.armies[from] < 2) continue
    for (const to of enemies(g, from)) {
      const odds = winChance(g.armies[from] - 1, g.armies[to])
      const needed = g.conquered ? floor : floor - 0.1
      if (odds < needed) continue
      const value = worth(g, p, to, target) * odds
      if (!best || value > best.value) best = { from, to, odds, value }
    }
  }
  return best
}

/** Where the next army does most good: somewhere to attack from, or a door to hold. */
function stagingPoint(g: Game, p: number, lean: Leaning): Territory {
  const target = goal(g, p, lean)
  const held = g.continentsOf(p)
  let best: Territory | null = null
  let bestScore = -Infinity
  for (const t of g.territoriesOf(p)) {
    const foes = enemies(g, t)
    if (foes.length === 0) continue
    let score = 0
    // Attack: the best thing next door, cheapest to take.
    for (const n of foes) {
      const s = worth(g, p, n, target) / (1 + g.armies[n])
      if (s > score) score = s
    }
    // Defence: a door of a continent we hold, outnumbered.
    const door = held.some((c) => BORDERS[c].includes(t))
    if (door) score += Math.max(0, threat(g, t) - g.armies[t]) * 0.4 + 1
    // Pile up rather than spread thin: a stack attacks, a scatter does not.
    score += Math.min(g.armies[t], 12) * 0.05
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return best ?? g.territoriesOf(p)[0]
}

/** The set that pays most: one showing a territory we hold, and wild cards kept if possible. */
function bestSet(g: Game, p: number, hand: readonly Card[]): [number, number, number] | null {
  const sets = setsIn(hand)
  if (sets.length === 0) return null
  const score = (s: [number, number, number]) =>
    s.reduce((n, i) => {
      const c = hand[i]
      if (c.mark === 'wild') return n - 1
      return n + (c.territory && g.owner[c.territory] === p ? 2 : 0)
    }, 0)
  return sets.reduce((a, b) => (score(b) > score(a) ? b : a))
}

// ------------------------------------------------------------- deciding

export function decide(g: Game, lean: Leaning): Action {
  const p = g.current

  switch (g.phase) {
    case 'setup':
      return { type: 'place', territory: stagingPoint(g, p, lean), count: 1 }

    case 'reinforce': {
      // Trading now rather than saving up: the value rises for everybody
      // whether or not we wait, and armies now are armies on the board.
      const set = bestSet(g, p, g.hand)
      if (set && (g.mustTrade || g.reinforcements > 0 || g.resume)) return { type: 'trade', cards: set }
      if (g.reinforcements > 0) {
        // Most on the best point, and the rest reconsidered, so a big
        // income can cover a threatened door as well as a push.
        const count = g.reinforcements <= 3 ? g.reinforcements : Math.ceil(g.reinforcements * 0.7)
        return { type: 'place', territory: stagingPoint(g, p, lean), count }
      }
      return { type: 'beginAttack' }
    }

    case 'attack': {
      const plan = bestAttack(g, p, lean)
      return plan ? { type: 'attack', from: plan.from, to: plan.to } : { type: 'endAttack' }
    }

    case 'occupy': {
      const o = g.occupation!
      const behind = threat(g, o.from)
      const ahead = threat(g, o.to)
      let count: number
      if (behind === 0) count = o.max
      else if (ahead === 0) count = o.min
      else count = Math.round(o.max * (ahead / (ahead + behind * 0.6)))
      return { type: 'occupy', count: Math.max(o.min, Math.min(o.max, count)) }
    }

    case 'fortify': {
      // The biggest idle stack -- one with no enemy beside it -- walks to the
      // front that needs it most.
      const idle = g
        .territoriesOf(p)
        .filter((t) => g.armies[t] > 1 && enemies(g, t).length === 0)
        .sort((a, b) => g.armies[b] - g.armies[a])
      for (const from of idle) {
        const fronts = g.connected(from).filter((t) => enemies(g, t).length > 0)
        if (fronts.length === 0) continue
        const to = fronts.reduce((a, b) =>
          threat(g, b) - g.armies[b] > threat(g, a) - g.armies[a] ? b : a,
        )
        return { type: 'fortify', from, to, count: g.armies[from] - 1 }
      }
      return { type: 'endTurn' }
    }

    case 'over':
      throw new Error('the game is over')
  }
}

export function apply(g: Game, a: Action) {
  switch (a.type) {
    case 'place':
      return g.place(a.territory, a.count)
    case 'trade':
      return g.trade(a.cards)
    case 'beginAttack':
      return g.beginAttack()
    case 'attack':
      return g.attack(a.from, a.to)
    case 'occupy':
      return g.occupy(a.count)
    case 'endAttack':
      return g.endAttack()
    case 'fortify':
      return g.fortify(a.from, a.to, a.count)
    case 'endTurn':
      return g.endTurn()
  }
}
