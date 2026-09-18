# Notice, credits and provenance

## What this is

An independent reimplementation of the classic game of world domination,
written from scratch in TypeScript in 2026: one human against five computer
players, in one sitting.

## The name

It isn't called what you'd expect, and that's deliberate. The rules of a game
are ideas rather than expression, and nobody gets to fence them off, so they're
rebuilt here freely. The **name** is a live trademark belonging to a company
that enforces it, and this ships on a public site with somebody's name in the
footer. So the mechanics are exact and the vocabulary is ours. *World
Conquest* is what the game was called when it was first published, in French,
as *La Conquête du Monde*.

None of that is a copyright question. Game mechanics are ideas. Names are a
trademark question, which is about whether a reader would think this came from
the trademark holder. Calling it *World Conquest* answers that, and costs the
game nothing.

The same goes for the cards. The published game draws a soldier, a horseman and
a cannon. The rules only need three kinds, fourteen of each, so here they're
named for what they are and drawn as plain shapes.

## The map

**The outlines are from Natural Earth**, 1:50m cultural vectors, admin-0
countries and admin-1 states and provinces:

- <https://www.naturalearthdata.com/>, public domain

Being public domain, they carry no license terms of their own. They're credited
here anyway, because somebody drew the world properly and that deserves saying.
`tools/map.py` reads them and writes `src/game/board.json`.

**The grouping is ours**: which countries and provinces make up each of the
forty-two territories, where the board's line down the Urals falls, and which
pieces are left off the map. So are the projection, the simplification and
every color drawn on top.

The **topology**, which territory borders which, is the classic board's. It's
a fact about a published game, typed out by hand in `src/game/map.ts` and
checked against itself.

## What is ours

Everything else: the rules engine, the odds, the bots and their reasoning, the
interface, the sound effects and the music, and every word on screen.

## License

Copyright (C) 2026 John Coffey.

This program is free software: you can redistribute it and/or modify it under
the terms of the **GNU Affero General Public License** as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version. See [LICENSE](LICENSE).

AGPL rather than plain GPL because this is served over a network. Section 13
means anyone who runs a modified copy of this for other people over a network
has to offer them its source.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

*None of the above is legal advice.*
