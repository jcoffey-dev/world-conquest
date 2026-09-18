import type { GameEvent } from './game'
import { TERRITORIES, type Territory } from './map'

/**
 * The log, in words.
 *
 * A game of this throws the dice thousands of times and nobody wants to read
 * a line for each throw. So consecutive throws between the same two
 * territories fold into one line saying how the fight went, and the log
 * reads like an account of the war rather than a transcript of the dice.
 */

export const PLAYER_NAMES = ['Crimson', 'Cobalt', 'Saffron', 'Jade', 'Violet', 'Ash'] as const

export interface Line {
  /** Whose line it is, for the color chip. */
  player: number
  text: string
  /** A new turn starts a new paragraph. */
  heading?: boolean
}

const name = (t: Territory) => TERRITORIES[t].name

export function describe(events: readonly GameEvent[], human: number | null): Line[] {
  const who = (p: number) => (p === human ? 'You' : PLAYER_NAMES[p])
  const whom = (p: number) => (p === human ? 'you' : PLAYER_NAMES[p])
  const lines: Line[] = []
  let fight: { player: number; from: Territory; to: Territory; lost: number; killed: number; defender: number } | null =
    null

  const closeFight = (taken: boolean) => {
    if (!fight) return
    const f = fight
    fight = null
    if (taken) return // the conquest line says it better
    lines.push({
      player: f.player,
      text: `${who(f.player)} attacked ${name(f.to)} from ${name(f.from)}: lost ${f.lost}, killed ${f.killed}.`,
    })
  }

  for (const e of events) {
    if (e.kind !== 'battle' && e.kind !== 'conquer') closeFight(false)
    switch (e.kind) {
      case 'turn':
        lines.push({
          player: e.player,
          heading: true,
          text: `Round ${e.round}: ${who(e.player)} ${e.player === human ? 'have' : 'has'} ${
            e.reinforcements
          } to place.`,
        })
        break
      case 'battle':
        if (fight && (fight.from !== e.from || fight.to !== e.to)) closeFight(false)
        fight ??= { player: e.player, from: e.from, to: e.to, lost: 0, killed: 0, defender: e.defender }
        fight.lost += e.roll.attackerLoss
        fight.killed += e.roll.defenderLoss
        break
      case 'conquer': {
        const f = fight
        closeFight(true)
        const cost = f ? ` (lost ${f.lost}, killed ${f.killed})` : ''
        lines.push({
          player: e.player,
          text: `${who(e.player)} took ${name(e.to)} from ${whom(e.loser)}${cost}.`,
        })
        break
      }
      case 'trade':
        lines.push({
          player: e.player,
          text: `${who(e.player)} traded a set for ${e.armies}${
            e.bonus.length ? `, and 2 more on ${name(e.bonus[0])}` : ''
          }.`,
        })
        break
      case 'eliminate':
        lines.push({
          player: e.player,
          text: `${who(e.loser)} ${e.loser === human ? 'are' : 'is'} out, finished by ${whom(e.player)}${
            e.cards ? `, who takes ${e.cards} card${e.cards === 1 ? '' : 's'}` : ''
          }.`,
        })
        break
      case 'fortify':
        lines.push({
          player: e.player,
          text: `${who(e.player)} moved ${e.count} from ${name(e.from)} to ${name(e.to)}.`,
        })
        break
      case 'win':
        lines.push({
          player: e.player,
          heading: true,
          text: `${who(e.player)} ${e.player === human ? 'hold' : 'holds'} the world.`,
        })
        break
      default:
        break
    }
  }
  closeFight(false)
  return lines
}
