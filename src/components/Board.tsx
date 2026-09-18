import { memo } from 'react'
import board from '../game/board.json'
import type { Game } from '../game/game'
import { LINK_LIST, TERRITORIES, TERRITORY_IDS, type Continent, type Territory } from '../game/map'
import { PLAYER_NAMES } from '../game/describe'

/**
 * The map.
 *
 * The shapes are real geography, grouped into the forty-two territories by
 * `tools/map.py`; the links are the classic board's, from `map.ts`. Where
 * the two disagree the rules win and the drawing says so: a dashed lane
 * across water that the rules cross, and a closed border -- drawn as a
 * fence -- where two territories happen to touch and the rules never let
 * anybody across.
 *
 * Owners are the fill. Continents are the coastline: each one's shore is
 * drawn in its own color, under everything, so the six read at a glance
 * without taking the fill away from the question that matters, which is
 * whose it is.
 */

export const COLORS = ['#d8543f', '#3f7fd8', '#e8b53a', '#3fae7a', '#9a62c9', '#7c8a99'] as const
/** A darker tone of each, for the army badges, so a number is legible on its own color. */
export const DARK = ['#8e2a1b', '#1d4a8e', '#94690f', '#1d6b48', '#5c3182', '#434e5a'] as const

export const SHORE: Record<Continent, string> = {
  'north-america': '#e3a33b',
  'south-america': '#d4543b',
  europe: '#4a79c9',
  africa: '#8a5a33',
  asia: '#3e9b5a',
  australia: '#a052b8',
}

interface Drawn {
  d: string
  label: [number, number]
}

const DRAWN = board.territories as unknown as Record<Territory, Drawn>
const NEAR = board.near as unknown as Record<string, [number, number, number, number]>
const BORDERS = board.borders as Record<string, string>
const TOUCHING = new Set(board.touching.map(([a, b]) => `${a}|${b}`))
const LINKED = new Set(LINK_LIST.map(([a, b]) => [a, b].sort().join('|')))
const WRAP = board.wrap as unknown as { alaska: [number, number]; kamchatka: [number, number] }

/** Links drawn as lanes: every one the shapes do not already show. */
const LANES = LINK_LIST.map(([a, b]) => [a, b].sort().join('|'))
  .filter((k) => !TOUCHING.has(k) && k !== 'alaska|kamchatka')
  .map((k) => ({ key: k, xy: NEAR[k] }))
  .filter((l) => l.xy)

const edgeKind = (key: string) => {
  const [a, b] = key.split('|') as [Territory, Territory]
  if (!LINKED.has(key)) return 'closed'
  return TERRITORIES[a].continent === TERRITORIES[b].continent ? 'inner' : 'continental'
}

/** Drawn once: nothing about the land or the sea changes during a game. */
const Ground = memo(function Ground() {
  return (
    <>
      <rect className="ocean" x={-40} y={-40} width={board.width + 80} height={board.height + 80} />
      <g className="shores">
        {TERRITORY_IDS.map((t) => (
          <path key={t} d={DRAWN[t].d} stroke={SHORE[TERRITORIES[t].continent]} />
        ))}
      </g>
      <g className="lanes">
        {LANES.map((l) => (
          <line key={l.key} x1={l.xy[0]} y1={l.xy[1]} x2={l.xy[2]} y2={l.xy[3]} />
        ))}
        {/* Across the date line, which is the edge of the board. */}
        <line x1={WRAP.alaska[0]} y1={WRAP.alaska[1]} x2={-30} y2={WRAP.alaska[1]} />
        <line x1={WRAP.kamchatka[0]} y1={WRAP.kamchatka[1]} x2={board.width + 30} y2={WRAP.kamchatka[1]} />
      </g>
    </>
  )
})

export function Board({
  game,
  selected,
  targets,
  target,
  flash,
  onPick,
}: {
  game: Game
  selected: Territory | null
  targets: readonly Territory[]
  target: Territory | null
  /** Territories that just changed hands, briefly marked. */
  flash: ReadonlySet<Territory>
  onPick: (t: Territory) => void
}) {
  return (
    <svg
      className="board"
      viewBox={`-30 -10 ${board.width + 60} ${board.height + 20}`}
      role="group"
      aria-label="The map"
    >
      <Ground />
      <g>
        {TERRITORY_IDS.map((t) => {
          const owner = game.owner[t]
          const cls = [
            'land',
            t === selected && 'picked',
            t === target && 'aimed',
            targets.includes(t) && 'open',
            flash.has(t) && 'flash',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <path
              key={t}
              d={DRAWN[t].d}
              className={cls}
              fill={COLORS[owner]}
              onClick={() => onPick(t)}
            >
              <title>
                {TERRITORIES[t].name}: {PLAYER_NAMES[owner]}, {game.armies[t]}{' '}
                {game.armies[t] === 1 ? 'army' : 'armies'}
              </title>
            </path>
          )
        })}
      </g>
      <g className="borders">
        {Object.entries(BORDERS).map(([key, d]) => (
          <path key={key} d={d} className={edgeKind(key)}>
            {edgeKind(key) === 'closed' && <title>A closed border: no link on the classic board</title>}
          </path>
        ))}
      </g>
      <g className="badges" aria-hidden="true">
        {TERRITORY_IDS.map((t) => {
          const [x, y] = DRAWN[t].label
          const n = game.armies[t]
          const r = n >= 100 ? 13 : n >= 10 ? 11 : 9.5
          return (
            <g key={t} transform={`translate(${x} ${y})`} onClick={() => onPick(t)}>
              <circle r={r} fill={DARK[game.owner[t]]} />
              <text dy="0.36em">{n}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
