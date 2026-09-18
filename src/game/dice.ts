import type { Rng } from './rng'

/**
 * The dice, and the arithmetic of them.
 *
 * An attacker rolls up to three, never more than the armies it has beyond
 * the one that must stay home. A defender rolls up to two, never more than
 * it has. Highest against highest, second against second; a tie goes to the
 * defender, and each comparison costs the loser one army.
 *
 * The odds are worked out here rather than looked up. A table copied from
 * somewhere is a table nobody can check; one computed from thirty-six and
 * two hundred and sixteen and seven thousand seven hundred and seventy-six
 * equally likely throws is its own proof, and the tests hold it to the
 * figures every Risk player's cousin has quoted at them.
 */

export interface Roll {
  attack: number[]
  defend: number[]
  attackerLoss: number
  defenderLoss: number
}

const die = (rng: Rng) => 1 + Math.floor(rng() * 6)

export function compare(attack: number[], defend: number[]) {
  const a = [...attack].sort((x, y) => y - x)
  const d = [...defend].sort((x, y) => y - x)
  let attackerLoss = 0
  let defenderLoss = 0
  for (let i = 0; i < Math.min(a.length, d.length); i++) {
    if (a[i] > d[i]) defenderLoss++
    else attackerLoss++
  }
  return { attack: a, defend: d, attackerLoss, defenderLoss }
}

export function roll(rng: Rng, attackDice: number, defendDice: number): Roll {
  const attack = Array.from({ length: attackDice }, () => die(rng))
  const defend = Array.from({ length: defendDice }, () => die(rng))
  return compare(attack, defend)
}

/** Every throw of `n` dice, each equally likely. */
function throws(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  for (const rest of throws(n - 1)) for (let f = 1; f <= 6; f++) out.push([f, ...rest])
  return out
}

/**
 * For one exchange of `a` attacking and `d` defending dice: the chance of
 * each outcome, keyed by how many armies the attacker loses.
 */
export const OUTCOMES: Record<string, Map<number, number>> = (() => {
  const table: Record<string, Map<number, number>> = {}
  for (let a = 1; a <= 3; a++) {
    for (let d = 1; d <= 2; d++) {
      const counts = new Map<number, number>()
      let total = 0
      for (const at of throws(a)) {
        for (const de of throws(d)) {
          const { attackerLoss } = compare(at, de)
          counts.set(attackerLoss, (counts.get(attackerLoss) ?? 0) + 1)
          total++
        }
      }
      for (const [k, v] of counts) counts.set(k, v / total)
      table[`${a}v${d}`] = counts
    }
  }
  return table
})()

const memo = new Map<string, number>()

/**
 * The chance that `attackers` armies -- the ones free to attack, not counting
 * the one left behind -- take a territory held by `defenders`, if the attack
 * is pressed with every die available until one side is gone.
 */
export function winChance(attackers: number, defenders: number): number {
  if (defenders <= 0) return 1
  if (attackers <= 0) return 0
  const key = `${attackers},${defenders}`
  const hit = memo.get(key)
  if (hit !== undefined) return hit
  const a = Math.min(3, attackers)
  const d = Math.min(2, defenders)
  const fights = Math.min(a, d)
  let p = 0
  for (const [attackerLoss, chance] of OUTCOMES[`${a}v${d}`]) {
    p += chance * winChance(attackers - attackerLoss, defenders - (fights - attackerLoss))
  }
  memo.set(key, p)
  return p
}
