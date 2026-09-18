import { PLAYER_NAMES } from '../game/describe'
import { PLAYER_COUNT, STARTING_ARMIES } from '../game/game'
import { CONTINENTS, CONTINENT_IDS } from '../game/map'
import { COLORS, SHORE } from './Board'

/**
 * The page before the map.
 *
 * Everybody thinks they know the rules to this one, and most people learned
 * them from somebody who had changed three. So they are stated here in full
 * -- they are short -- along with the two or three places where tables
 * differ, and which way this one goes.
 *
 * It is also the honest place for the license and for where the map came
 * from, and for saying plainly whose game this is not.
 */
export function Landing({
  color,
  onPick,
  onStart,
}: {
  color: number
  onPick: (c: number) => void
  onStart: () => void
}) {
  return (
    <div className="landing">
      <header>
        <h1>World Conquest</h1>
        <p className="tagline">
          Forty-two territories, six armies, and the dice. You against five, until one of you holds
          the world.
        </p>
      </header>

      <div className="cols">
        <section>
          <h2>The whole game</h2>
          <p>
            The world is dealt out at random, seven territories each, and everybody puts down{' '}
            {STARTING_ARMIES} armies on their own ground, a turn at a time. Then each turn goes the
            same way:
          </p>
          <ol>
            <li>
              <strong>Reinforce.</strong> A third of your territories, never fewer than three,
              plus a bonus for every whole continent you hold.
            </li>
            <li>
              <strong>Attack</strong> as often as you like, from any territory with an army to
              spare into any enemy territory next to it. Up to three dice attack and up to two
              defend; highest against highest, and a tie goes to the defender. Empty a territory
              and you march in.
            </li>
            <li>
              <strong>Fortify</strong> once: move armies between two of your territories joined
              by your own ground. Then the turn passes.
            </li>
          </ol>
          <p>
            Take at least one territory in a turn and you draw a card. Three alike, or one of
            each, trade in for armies: 4, then 6, 8, 10, 12, 15, and five more every time after.
            The count is shared by the whole table, so every set traded makes the next one
            dearer for everybody. Hold five cards and you must trade. Finish a player off and
            their cards are yours.
          </p>
        </section>

        <section>
          <h2>The continents</h2>
          <ul className="continents">
            {CONTINENT_IDS.map((c) => (
              <li key={c}>
                <span className="shore" style={{ borderColor: SHORE[c] }} />
                {CONTINENTS[c].name} <span className="dim">+{CONTINENTS[c].bonus} a turn</span>
              </li>
            ))}
          </ul>
          <p>
            The shapes on the map are the real ones; the links are the classic board's. Dashed
            lines cross the water where the rules do, and Alaska meets Kamchatka off the edge of
            the world. The one border drawn as a fence, between Siberia and the steppe, is a place
            the real map touches and the rules never let anybody across.
          </p>
          <h2>Where tables differ</h2>
          <p>
            Fortifying goes anywhere along a chain of your own territories, not only next door.
            The defender always rolls every die they can. Sets escalate for the whole table rather
            than staying fixed. A card showing a territory you hold puts two more armies there
            when you trade it.
          </p>
        </section>
      </div>

      <div className="choose">
        <h2>Take a color</h2>
        <ul>
          {Array.from({ length: PLAYER_COUNT }, (_, c) => (
            <li key={c}>
              <button type="button" className={c === color ? 'on' : ''} aria-pressed={c === color} onClick={() => onPick(c)}>
                <span className="swatch" style={{ background: COLORS[c] }} />
                {PLAYER_NAMES[c]}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="start" onClick={onStart}>
          Deal
        </button>
      </div>

      <footer>
        <p className="ways">
          {/*
            Absolute rather than "/", because this game is served from a
            subdirectory in production and from the root in development.
          */}
          <a href="https://games.jcoffey.dev/">The rest of the games</a>
          {' · '}
          <a href="https://github.com/jcoffey-dev/world-conquest">Source</a>
        </p>
        <p>
          World Conquest is free software under the{' '}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html">
            GNU Affero General Public License, version 3 or later
          </a>
          . It comes with no warranty whatsoever. You may use, study, change and share it; if you run
          a changed version where other people can reach it, they are entitled to its source.
        </p>
        <p>
          The coastlines and borders are from <a href="https://www.naturalearthdata.com/">Natural Earth</a>,
          which is in the public domain. Which country belongs to which territory is this
          project's own choice.
        </p>
        <p>
          This is not the board game it is modeled on, and is not connected to the people who
          publish it. No artwork, text or trademark of theirs is used here: every mark on the screen
          and every note of the music is generated in code in this repository.
        </p>
      </footer>
    </div>
  )
}
