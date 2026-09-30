# World Conquest

> [!NOTE]
> Development happens on [git.coffeylabs.org/jcoffey-dev/world-conquest](https://git.coffeylabs.org/jcoffey-dev/world-conquest); the copy on GitHub is a read-only mirror.
> Report issues at **[git.coffeylabs.org/jcoffey-dev/world-conquest/issues](https://git.coffeylabs.org/jcoffey-dev/world-conquest/issues)**, and join discussions at **[community.coffeylabs.org](https://community.coffeylabs.org)**.

A browser rebuild of the classic game of world domination: forty-two
territories, six continents and the dice, with one human against five
computer players.

It isn't called what you'd expect, and that's deliberate. The rules are free to
rebuild, but the trademark and the published artwork are not. *World Conquest*
is the name the game had when it first came out, in French, in 1957. See
[NOTICE.md](NOTICE.md).

## The table

**You against five, at the classic six-player table.** You get seven
territories and twenty armies, the same as everybody else. The world is dealt
at random, the armies go down a turn at a time, and play continues until one
player holds all forty-two territories.

**The rules are the classic ones.** Choices that vary from table to table are
settled like this, and the landing page says so before anyone plays:

- sets escalate for the whole table (4, 6, 8, 10, 12, 15, then five more each
  time), not at a fixed value per set;
- a card showing a territory you hold adds two armies there when traded,
  on one territory per set;
- five cards means you must trade, and taking a player's cards up to six or
  more means you trade immediately, in the middle of your attack;
- fortifying moves once, along any chain of your own territories;
- the defender always rolls every die it can.

## The map

**Real geography, grouped into the classic forty-two.** The outlines come from
[Natural Earth](https://www.naturalearthdata.com/), which is public domain.
`tools/map.py` groups countries, and for Russia, Canada, the United States,
Australia, China and Indonesia their provinces, into the board's territories,
then writes `src/game/board.json`. The grouping is this project's own. Deciding
which country goes in which territory is the only part of the map anyone had to
decide.

**The links are the classic board's, link for link.** They're typed out in
`src/game/map.ts`, and `npm test` holds them to eighty-three, symmetric and
connected, with each continent's entry points where every player expects them:
one into Australia, two into South America, and five into Asia.

Where real geography and the classic links disagree, the rules win and the map
says so:

- **A lane across the water** for every link the shapes don't show:
  Brazil to North Africa, Greenland to Iceland, and so on. Alaska and Kamchatka
  meet off the two edges of the board, across the date line.
- **A closed border** where the real map touches but the classic board has no
  link. There's exactly one. The Altai Republic gives Siberia a short border with
  Kazakhstan (Afghanistan, on this board), so it's drawn as a fence. Every other
  accidental border was grouped away: North Korea goes with Manchuria rather
  than China, and the steppe south of Siberia goes with the Ural.

Owners are shown by the fill. Continents are shown by the coastline, with each
continent's shore drawn in its own color underneath the land. That way the six
read at a glance without taking the fill away from who holds what.

To rebuild the map:

```bash
python3 -m venv .venv && .venv/bin/pip install shapely pyshp
.venv/bin/python tools/map.py path/to/natural-earth
```

The directory needs the 1:50m admin-0 countries and admin-1 states and
provinces from naciscdn.org, unzipped.

## The dice

`src/game/dice.ts` computes the odds from the 36, 216, 1,296 and 7,776 equally
likely throws, rather than copying a table, and the tests hold it to the
published figures. A 20,000-battle run of the actual dice has to agree with it
too. The same numbers drive two things: the "Pressed to the end, 64% to take
it" line shown when you aim an attack, and every decision a bot makes.

## The bots

`src/game/bot.ts`. A bot keeps no plan between moves. Each time it's asked, it
looks at the board and answers with the one thing it would do next. A plan the
dice have already ruined can never linger, and a game can be paused anywhere.

What a bot wants comes down to three things, in this order: a continent it can
hold, a card for the turn, and nobody else holding a continent in peace. It
prices each attack as what winning is worth, multiplied by the exact chance of
winning. It fights when the odds clear a line set by its nerve (roughly 55% to
75%), and goes a little lower for the first territory of a turn, because a
card is on the line. Reinforcements pile up at one staging point rather than
spreading thin. Idle stacks walk to the front.

Each bot leans a little: braver or more careful, and slightly fonder of some
continents than others. The lean comes from the seed, so a seed still replays a
game exactly.

**They finish.** `play.test.ts` plays thirty seeded six-bot games to the end,
and every one has to end with somebody holding the world. They take 20 rounds
on average, 9 at the fewest and 40 at the most, and more than three different
seats win. A game that can't be won isn't a hard game, it's a broken one, and
the sibling game on this site learned that the hard way.

## The sound

The synth is the one the site's other games share. What's written for this
game is the dice, which clatter as many dice as were actually thrown; a
conquest, which is three guns and a bugle going up; the card-trade fanfare,
which starts higher the more the set is worth; and one march in C minor. When
the bots are playing fast, a batch of moves makes at most one sound, the most
important thing in it, so a whole round doesn't arrive as one crash.

## Where it lives

<https://games.jcoffey.dev/conquest/>, built straight from this repository's
`main`. This is AGPL, and section 13 asks that players be offered the source
of the version they're running. Building from the published ref is what makes
that offer true.

## Still to build

- On a phone the whole world is 390 pixels wide. It fits and plays, but the
  small territories are small targets, and there's no zoom of its own beyond the
  browser's pinch.
