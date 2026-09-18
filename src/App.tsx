import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { playFor } from './audio/play'
import { MARCH } from './audio/score'
import { synth } from './audio/synth'
import { Board } from './components/Board'
import { Landing } from './components/Landing'
import { Side } from './components/Side'
import { apply, decide, leanings, type Action, type Leaning } from './game/bot'
import { setsIn } from './game/cards'
import { PLAYER_NAMES } from './game/describe'
import { Game, PLAYER_COUNT } from './game/game'
import type { Territory } from './game/map'

export type Speed = 'steady' | 'quick' | 'instant'

/**
 * How long a bot takes over each kind of move, in milliseconds, at steady.
 *
 * Slow enough to follow, which is the whole reason to pace it at all: a bot
 * that finishes its turn before you have looked up has told you nothing
 * about what it did. The dice get the least, because there are the most of
 * them, and a trade the most, because it is the one move everybody at a
 * table stops to watch.
 */
const PACE: Record<Action['type'], number> = {
  place: 320,
  trade: 900,
  beginAttack: 250,
  attack: 380,
  occupy: 320,
  endAttack: 200,
  fortify: 600,
  endTurn: 350,
}

const pace = (a: Action, speed: Speed, setup: boolean) =>
  setup ? (speed === 'steady' ? 70 : 25) : PACE[a.type] * (speed === 'steady' ? 1 : 0.35)

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'game'>('landing')
  const [color, setColor] = useState(0)
  const [, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const gameRef = useRef<Game | null>(null)
  const leanRef = useRef<Leaning[]>([])
  const seen = useRef(0)

  const [speed, setSpeed] = useState<Speed>('steady')
  const [music, setMusic] = useState(true)
  const [sfx, setSfx] = useState(true)
  const [sel, setSel] = useState<Territory | null>(null)
  const [target, setTarget] = useState<Territory | null>(null)
  const [flash, setFlash] = useState<ReadonlySet<Territory>>(new Set())
  const [autoSetup, setAutoSetup] = useState(false)
  const [watching, setWatching] = useState(false)
  const [leaving, setLeaving] = useState(false)
  /** How many armies a click puts down while reinforcing. */
  const [step, setStep] = useState<1 | 5 | 'all'>(1)

  const g = gameRef.current

  /** Everything that happens goes through here: sound, the flash, and a redraw. */
  const settle = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    const fresh = game.events.slice(seen.current)
    seen.current = game.events.length
    const taken = new Set<Territory>()
    for (const e of fresh) if (e.kind === 'conquer') taken.add(e.to)
    if (taken.size) setFlash(taken)
    playFor(fresh, color)
    if (game.phase === 'over') synth.stopTune()
    bump()
  }, [bump, color])

  // ---------------------------------------------------------- the bots

  const humanOut = g ? !g.players[color].alive : false

  useEffect(() => {
    const game = gameRef.current
    if (!game || screen !== 'game' || game.phase === 'over') return
    const human = game.players[game.current].human
    const autopilot = human && game.phase === 'setup' && autoSetup
    if (human && !autopilot) return
    if (humanOut && !watching) return

    const act = () => {
      const a = decide(game, leanRef.current[game.current])
      apply(game, a)
      return a
    }

    if (speed === 'instant' && !autopilot) {
      // Straight through to the next thing that needs a person, with the
      // screen drawn once at the end. There is a ceiling in case that never
      // comes -- a whole game of bots is a few thousand moves.
      const id = window.setTimeout(() => {
        for (let i = 0; i < 20000; i++) {
          if (game.phase === 'over' || game.players[game.current].human) break
          act()
        }
        settle()
      }, 60)
      return () => window.clearTimeout(id)
    }

    const next = decide(game, leanRef.current[game.current])
    const id = window.setTimeout(() => {
      apply(game, next)
      settle()
    }, pace(next, speed, game.phase === 'setup'))
    return () => window.clearTimeout(id)
  })

  // The flash fades on its own.
  useEffect(() => {
    if (flash.size === 0) return
    const id = window.setTimeout(() => setFlash(new Set()), 900)
    return () => window.clearTimeout(id)
  }, [flash])

  // ------------------------------------------------------------- music

  useEffect(() => {
    synth.setMusic(music)
  }, [music])
  useEffect(() => {
    synth.setSfx(sfx)
  }, [sfx])

  // --------------------------------------------------------- starting

  const start = () => {
    synth.ensure()
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0
    const game = new Game(seed, color)
    gameRef.current = game
    leanRef.current = leanings(seed, PLAYER_COUNT)
    seen.current = 0
    setSel(null)
    setTarget(null)
    setAutoSetup(false)
    setWatching(false)
    setLeaving(false)
    setScreen('game')
    synth.dice(4)
    if (music) synth.playTune(MARCH)
    settle()
  }

  const leave = () => {
    synth.stopTune()
    gameRef.current = null
    setScreen('landing')
  }

  // ------------------------------------------------ the player's moves

  const mine = g ? g.current === color && g.phase !== 'over' : false

  /** The one move a click on the map can mean, given the phase. */
  const pick = (t: Territory) => {
    if (!g || !mine) return
    const own = g.owner[t] === color

    switch (g.phase) {
      case 'setup':
        if (!own) return synth.reject()
        g.place(t)
        synth.tap()
        return settle()

      case 'reinforce':
        if (!own || g.mustTrade || g.reinforcements === 0) return synth.reject()
        return act.place(t, step === 'all' ? g.reinforcements : Math.min(step, g.reinforcements))
      case 'attack':
        if (own) {
          if (t === sel) {
            setSel(null)
            setTarget(null)
          } else if (g.canAttackFrom(t)) {
            setSel(t)
            setTarget(null)
            synth.tap()
          } else synth.reject()
          return
        }
        if (sel && g.attackTargets(sel).includes(t)) {
          setTarget(t)
          synth.written()
        } else synth.reject()
        return

      case 'fortify':
        if (!own) return synth.reject()
        if (sel && t !== sel && g.fortifyTargets(sel).includes(t)) {
          setTarget(t)
          synth.written()
        } else if (t === sel) {
          setSel(null)
          setTarget(null)
        } else if (g.fortifyTargets(t).length) {
          setSel(t)
          setTarget(null)
          synth.tap()
        } else synth.reject()
        return
    }
  }

  const act = {
    place: (t: Territory, n: number) => {
      if (!g) return
      g.place(t, n)
      synth.muster()
      // Nothing left to place and no set worth trading: straight on.
      if (g.reinforcements === 0 && setsIn(g.hand).length === 0) g.beginAttack()
      settle()
    },
    trade: (cards: [number, number, number]) => {
      g?.trade(cards)
      settle()
    },
    beginAttack: () => {
      g?.beginAttack()
      settle()
    },
    roll: (dice: number) => {
      if (!g || !sel || !target) return
      g.attack(sel, target, dice)
      afterRoll()
    },
    blitz: () => {
      if (!g || !sel || !target) return
      while (g.phase === 'attack' && g.armies[sel] > 1) g.attack(sel, target)
      afterRoll()
    },
    occupy: (n: number) => {
      if (!g || !g.occupation) return
      const to = g.occupation.to
      g.occupy(n)
      // Stay on the new ground, ready to push on from it.
      setSel(g.canAttackFrom(to) ? to : null)
      setTarget(null)
      settle()
    },
    endAttack: () => {
      g?.endAttack()
      setSel(null)
      setTarget(null)
      settle()
    },
    fortify: (n: number) => {
      if (!g || !sel || !target) return
      g.fortify(sel, target, n)
      setSel(null)
      setTarget(null)
      settle()
    },
    endTurn: () => {
      g?.endTurn()
      setSel(null)
      setTarget(null)
      settle()
    },
    autoSetup: () => {
      setAutoSetup(true)
    },
  }

  const afterRoll = () => {
    if (!g || !sel) return
    if (g.phase === 'attack' && !g.canAttackFrom(sel)) {
      setSel(null)
      setTarget(null)
    }
    settle()
  }

  // Escape lets go of whatever is picked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSel(null)
        setTarget(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const targets: Territory[] =
    !g || !sel || !mine
      ? []
      : g.phase === 'attack'
        ? g.attackTargets(sel)
        : g.phase === 'fortify'
          ? g.fortifyTargets(sel)
          : []

  if (screen === 'landing' || !g) {
    return <Landing color={color} onPick={setColor} onStart={start} />
  }

  const ended = g.phase === 'over'
  const won = ended && g.winner === color

  return (
    <div className="app">
      <header>
        <h1>World Conquest</h1>
        <nav className="ways">
          <label>
            Bots{' '}
            <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
              <option value="steady">steady</option>
              <option value="quick">quick</option>
              <option value="instant">instant</option>
            </select>
          </label>
          <button
            type="button"
            className="sound"
            aria-pressed={music}
            onClick={() => {
              const on = !music
              setMusic(on)
              if (on && !ended) synth.playTune(MARCH, false)
            }}
          >
            Music
          </button>
          <button type="button" className="sound" aria-pressed={sfx} onClick={() => setSfx(!sfx)}>
            Sound
          </button>
          {leaving ? (
            <>
              <button type="button" className="leave" onClick={leave}>
                Yes, abandon it
              </button>
              <button type="button" className="sound" onClick={() => setLeaving(false)}>
                Keep playing
              </button>
            </>
          ) : (
            <button type="button" className="leave" onClick={() => (ended ? leave() : setLeaving(true))}>
              New game
            </button>
          )}
        </nav>
      </header>

      <main className="map-wrap">
        <Board game={g} selected={sel} targets={targets} target={target} flash={flash} onPick={pick} />
        {(ended || (humanOut && !watching)) && (
          <div className="ending" role="dialog" aria-live="polite">
            {ended ? (
              <>
                <h2>{won ? 'The world is yours.' : `${PLAYER_NAMES[g.winner!]} holds the world.`}</h2>
                <p>
                  {won
                    ? `Round ${g.round}. Forty-two territories, and nobody left to take them back.`
                    : humanOut
                      ? 'You were out of it before the end, but the end came all the same.'
                      : `Round ${g.round}.`}
                </p>
              </>
            ) : (
              <>
                <h2>You are out.</h2>
                <p>Your last territory has gone. The war goes on without you.</p>
              </>
            )}
            <div className="row">
              {!ended && (
                <button type="button" onClick={() => setWatching(true)}>
                  Watch it finish
                </button>
              )}
              <button type="button" className="go" onClick={leave}>
                Another war
              </button>
            </div>
          </div>
        )}
      </main>

      <Side
        game={g}
        human={color}
        sel={sel}
        target={target}
        autoSetup={autoSetup}
        step={step}
        onStep={setStep}
        act={act}
      />
    </div>
  )
}
