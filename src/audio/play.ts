import type { GameEvent } from '../game/game'
import { synth } from './synth'

/**
 * What a batch of events sounds like.
 *
 * At a steady pace a batch is one move and gets its sound. At speed it can
 * be a whole round, and forty dice and six conquests at once are one
 * indistinct crash -- so a batch makes at most one noise, the most important
 * thing in it, in this order: the end, somebody going out, a trade, a
 * territory taken, a throw of the dice.
 */
export function playFor(events: readonly GameEvent[], human: number) {
  if (!synth.sfxOn || events.length === 0) return
  const find = <K extends GameEvent['kind']>(kind: K) =>
    events.findLast((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind)

  const win = find('win')
  if (win) return win.player === human ? synth.victory() : synth.defeat()
  const out = find('eliminate')
  if (out) return out.loser === human ? synth.eliminated() : synth.fallen()
  const trade = find('trade')
  if (trade) return synth.fanfare(trade.armies)
  if (find('conquer')) return synth.conquest()
  const battle = find('battle')
  if (battle) return synth.dice(battle.roll.attack.length + battle.roll.defend.length)
}
