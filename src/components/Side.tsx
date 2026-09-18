import { useState } from 'react'
import { isSet, setsIn, type Card } from '../game/cards'
import { winChance } from '../game/dice'
import { PLAYER_NAMES, describe } from '../game/describe'
import type { Game } from '../game/game'
import { CONTINENTS, CONTINENT_IDS, TERRITORIES, inContinent, type Territory } from '../game/map'
import { COLORS, SHORE } from './Board'

/**
 * Everything beside the map: whose turn it is and what they can do, the
 * dice, your cards, the table and the log.
 *
 * The map is where you point; this is where you are told what pointing
 * will do. Every control here is only ever offered when the rules would
 * take it, which is why so much of it is conditional.
 */

interface Acts {
  place: (t: Territory, n: number) => void
  trade: (cards: [number, number, number]) => void
  beginAttack: () => void
  roll: (dice: number) => void
  blitz: () => void
  occupy: (n: number) => void
  endAttack: () => void
  fortify: (n: number) => void
  endTurn: () => void
  autoSetup: () => void
}

const Chip = ({ p }: { p: number }) => <span className="chip" style={{ background: COLORS[p] }} />

const name = (t: Territory) => TERRITORIES[t].name

/** A chance as a player would say it: never a flat 0% or 100% while the dice can still disagree. */
function percent(p: number) {
  if (p >= 0.995) return 'better than 99%'
  if (p > 0 && p < 0.005) return 'less than 1%'
  return `${Math.round(p * 100)}%`
}

export function Side({
  game: g,
  human,
  sel,
  target,
  autoSetup,
  step,
  onStep,
  act,
}: {
  game: Game
  human: number
  sel: Territory | null
  target: Territory | null
  autoSetup: boolean
  step: 1 | 5 | 'all'
  onStep: (s: 1 | 5 | 'all') => void
  act: Acts
}) {
  const mine = g.current === human && g.phase !== 'over'
  const who = (p: number) => (p === human ? 'You' : PLAYER_NAMES[p])

  return (
    <aside className="side">
      <section className="now">
        <p className="turn">
          <Chip p={g.current} />
          {g.phase === 'over'
            ? `${who(g.winner!)} ${g.winner === human ? 'hold' : 'holds'} the world`
            : g.phase === 'setup'
              ? 'Placing armies'
              : `Round ${g.round} · ${mine ? 'your turn' : `${PLAYER_NAMES[g.current]}'s turn`}`}
        </p>
        {mine ? (
          <Controls g={g} sel={sel} target={target} autoSetup={autoSetup} step={step} onStep={onStep} act={act} />
        ) : g.phase !== 'over' ? (
          <p className="dim">{g.phase === 'setup' ? 'Everybody puts down their armies in turn.' : 'Watching.'}</p>
        ) : null}
      </section>

      <LastThrow g={g} human={human} />

      <Hand g={g} human={human} act={act} />

      <section>
        <h2>The table</h2>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Lands</th>
              <th>Armies</th>
              <th>Cards</th>
              <th>Pays</th>
            </tr>
          </thead>
          <tbody>
            {g.players.map((p) => (
              <tr key={p.id} className={[p.alive ? '' : 'gone', p.id === g.current ? 'now' : ''].join(' ')}>
                <th>
                  <Chip p={p.id} />
                  {p.id === human ? 'You' : PLAYER_NAMES[p.id]}
                </th>
                <td>{g.territoriesOf(p.id).length}</td>
                <td>{g.armiesOf(p.id)}</td>
                <td>{p.cards.length}</td>
                <td>{p.alive ? g.income(p.id) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Continents</h2>
        <ul className="continents">
          {CONTINENT_IDS.map((c) => {
            const land = inContinent(c)
            const holder = g.owner[land[0]]
            const whole = land.every((t) => g.owner[t] === holder)
            return (
              <li key={c}>
                <span className="shore" style={{ borderColor: SHORE[c] }} />
                {CONTINENTS[c].name} <span className="dim">+{CONTINENTS[c].bonus}</span>
                {whole && (
                  <span className="held">
                    <Chip p={holder} />
                    {who(holder)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <Log g={g} human={human} />
    </aside>
  )
}

// ------------------------------------------------------------ controls

function Controls({
  g,
  sel,
  target,
  autoSetup,
  step,
  onStep,
  act,
}: {
  g: Game
  sel: Territory | null
  target: Territory | null
  autoSetup: boolean
  step: 1 | 5 | 'all'
  onStep: (s: 1 | 5 | 'all') => void
  act: Acts
}) {
  switch (g.phase) {
    case 'setup':
      return (
        <>
          <p>
            <strong>{g.toPlace[g.current]}</strong> armies to put down, one at a time, taking turns.
            Click one of your territories.
          </p>
          {!autoSetup && (
            <button type="button" onClick={act.autoSetup}>
              Place the rest for me
            </button>
          )}
        </>
      )

    case 'reinforce':
      if (g.mustTrade)
        return (
          <p>
            <strong>{g.hand.length} cards</strong> in hand: trade a set before anything else. Your cards
            are below.
          </p>
        )
      if (g.reinforcements > 0)
        return (
          <>
            <p>
              <strong>{g.reinforcements}</strong> to place. Click your territories.
              {g.resume && ' Then back to the fighting.'}
            </p>
            <div className="row" role="group" aria-label="Armies per click">
              {([1, 5, 'all'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={step === s} className="toggle" onClick={() => onStep(s)}>
                  {s === 'all' ? 'All' : `+${s}`}
                </button>
              ))}
            </div>
          </>
        )
      return (
        <>
          <p>All placed. Trade another set now, or go to war.</p>
          <button type="button" className="go" onClick={act.beginAttack}>
            Attack
          </button>
        </>
      )

    case 'attack':
      return <Attack g={g} sel={sel} target={target} act={act} />

    case 'occupy':
      return <Occupy key={g.events.length} g={g} act={act} />

    case 'fortify':
      return <Fortify key={`${sel}-${target}`} g={g} sel={sel} target={target} act={act} />

    default:
      return null
  }
}

function Attack({ g, sel, target, act }: { g: Game; sel: Territory | null; target: Territory | null; act: Acts }) {
  const most = sel ? Math.min(3, g.armies[sel] - 1) : 0
  return (
    <>
      {!sel && <p>Pick one of your territories with an army to spare and an enemy next door.</p>}
      {sel && !target && (
        <p>
          From <strong>{name(sel)}</strong> ({g.armies[sel]}). Now pick who to attack.
        </p>
      )}
      {sel && target && (
        <>
          <p>
            <strong>{name(sel)}</strong> ({g.armies[sel]}) against <strong>{name(target)}</strong> (
            {g.armies[target]}, {PLAYER_NAMES[g.owner[target]]})
          </p>
          <p className="odds">Pressed to the end, {percent(winChance(g.armies[sel] - 1, g.armies[target]))} to take it.</p>
          <div className="row">
            {[3, 2, 1]
              .filter((d) => d <= most)
              .map((d) => (
                <button key={d} type="button" onClick={() => act.roll(d)}>
                  Roll {d}
                </button>
              ))}
            <button type="button" className="go" onClick={act.blitz}>
              Blitz
            </button>
          </div>
        </>
      )}
      <button type="button" className="quiet" onClick={act.endAttack}>
        Stop attacking
      </button>
    </>
  )
}

function Occupy({ g, act }: { g: Game; act: Acts }) {
  const o = g.occupation!
  const [n, setN] = useState(o.max)
  return (
    <>
      <p>
        <strong>{name(o.to)}</strong> is yours. How many march in from {name(o.from)}?
      </p>
      {o.max > o.min && (
        <input
          type="range"
          min={o.min}
          max={o.max}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-label="Armies to move in"
        />
      )}
      <div className="row">
        <button type="button" className="go" onClick={() => act.occupy(n)}>
          Move {n} in
        </button>
        {o.max > o.min && (
          <span className="dim">
            leaving {g.armies[o.from] - n} behind
          </span>
        )}
      </div>
    </>
  )
}

function Fortify({ g, sel, target, act }: { g: Game; sel: Territory | null; target: Territory | null; act: Acts }) {
  const max = sel ? g.armies[sel] - 1 : 0
  const [n, setN] = useState(max)
  return (
    <>
      <p>
        {!sel
          ? 'One move to finish: pick a territory to move armies from, or end the turn.'
          : !target
            ? `From ${name(sel)}. Pick where to, anywhere joined to it by your own territories.`
            : `${name(sel)} to ${name(target)}.`}
      </p>
      {sel && target && (
        <>
          {max > 1 && (
            <input
              type="range"
              min={1}
              max={max}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              aria-label="Armies to move"
            />
          )}
          <button type="button" className="go" onClick={() => act.fortify(n)}>
            Move {n} and end turn
          </button>
        </>
      )}
      <button type="button" className="quiet" onClick={act.endTurn}>
        End turn
      </button>
    </>
  )
}

// ------------------------------------------------------------ the dice

function Die({ face, side }: { face: number; side: 'attack' | 'defend' }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
  }
  return (
    <svg className={`die ${side}`} viewBox="0 0 4 4" role="img" aria-label={`${face}`}>
      <rect x={0.2} y={0.2} width={3.6} height={3.6} rx={0.7} />
      {pips[face].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.36} />
      ))}
    </svg>
  )
}

function LastThrow({ g, human }: { g: Game; human: number }) {
  const last = g.events.findLast((e) => e.kind === 'battle')
  if (!last || last.kind !== 'battle') return null
  const { roll } = last
  const who = (p: number) => (p === human ? 'You' : PLAYER_NAMES[p])
  return (
    <section className="throw" aria-live="polite">
      <p className="dim">
        {who(last.player)}, {name(last.from)} → {name(last.to)}
      </p>
      <div className="dice">
        <div>
          {roll.attack.map((f, i) => (
            <Die key={i} face={f} side="attack" />
          ))}
        </div>
        <span className="vs">vs</span>
        <div>
          {roll.defend.map((f, i) => (
            <Die key={i} face={f} side="defend" />
          ))}
        </div>
      </div>
      <p className="dim">
        Attacker lost {roll.attackerLoss}, defender lost {roll.defenderLoss}.
      </p>
    </section>
  )
}

// ------------------------------------------------------------ the cards

const MARK_GLYPH: Record<Card['mark'], string> = {
  infantry: '▲',
  cavalry: '●',
  artillery: '■',
  wild: '★',
}

function Hand({ g, human, act }: { g: Game; human: number; act: Acts }) {
  const hand = g.players[human].cards
  const [chosen, setChosen] = useState<number[]>([])
  const canTrade = g.current === human && g.phase === 'reinforce'
  const picked = chosen.filter((i) => i < hand.length)
  const cards = picked.map((i) => hand[i])
  const ready = picked.length === 3 && isSet(cards)
  const sets = setsIn(hand)

  const toggle = (i: number) =>
    setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : c.length < 3 ? [...c, i] : c))

  return (
    <section>
      <h2>
        Your cards <span className="dim">· next set pays {g.nextSetValue}</span>
      </h2>
      {hand.length === 0 ? (
        <p className="dim">None yet. Take a territory in a turn and you draw one at the end of it.</p>
      ) : (
        <ul className="cards">
          {hand.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                className={`card ${c.mark}`}
                aria-pressed={picked.includes(i)}
                disabled={!canTrade}
                onClick={() => toggle(i)}
              >
                <span className="glyph">{MARK_GLYPH[c.mark]}</span>
                <span>{c.territory ? name(c.territory) : 'Wild'}</span>
                {c.territory && g.owner[c.territory] === human && <span className="own">yours</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {canTrade && sets.length > 0 && (
        <div className="row">
          <button
            type="button"
            className={ready ? 'go' : ''}
            disabled={!ready}
            onClick={() => {
              act.trade(picked as [number, number, number])
              setChosen([])
            }}
          >
            Trade for {g.nextSetValue}
          </button>
          {!ready && (
            <button type="button" onClick={() => setChosen(sets[0])}>
              Pick a set
            </button>
          )}
        </div>
      )}
      {hand.length > 0 && (
        <p className="dim small">Three alike, one of each, or any two with a wild.</p>
      )}
    </section>
  )
}

// -------------------------------------------------------------- the log

function Log({ g, human }: { g: Game; human: number }) {
  const lines = describe(g.events, human).slice(-60).reverse()
  return (
    <section className="log">
      <h2>What happened</h2>
      <ol>
        {lines.map((l, i) => (
          <li key={lines.length - i} className={l.heading ? 'heading' : ''}>
            <span className="chip" style={{ background: COLORS[l.player] }} />
            {l.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
