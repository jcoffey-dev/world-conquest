/**
 * The board as the rules see it: forty-two territories in six continents, and
 * which of them border which.
 *
 * The topology is the classic one, link for link. It is a fact about a
 * published game and free to use, and it is also the part players know by
 * heart: that Australia has one door, that South America has two, that Asia
 * has nowhere to hide. The shapes the board draws come from real geography in
 * `board.json` and only approximate this -- where they disagree, the rules
 * here are the ones that count, and the board says so by drawing a lane across
 * the water or closing a border that happens to touch.
 */

export const CONTINENTS = {
  'north-america': { name: 'North America', bonus: 5 },
  'south-america': { name: 'South America', bonus: 2 },
  europe: { name: 'Europe', bonus: 5 },
  africa: { name: 'Africa', bonus: 3 },
  asia: { name: 'Asia', bonus: 7 },
  australia: { name: 'Australia', bonus: 2 },
} as const

export type Continent = keyof typeof CONTINENTS

export const TERRITORIES = {
  alaska: { name: 'Alaska', continent: 'north-america' },
  'northwest-territory': { name: 'Northwest Territory', continent: 'north-america' },
  greenland: { name: 'Greenland', continent: 'north-america' },
  alberta: { name: 'Alberta', continent: 'north-america' },
  ontario: { name: 'Ontario', continent: 'north-america' },
  quebec: { name: 'Quebec', continent: 'north-america' },
  'western-us': { name: 'Western United States', continent: 'north-america' },
  'eastern-us': { name: 'Eastern United States', continent: 'north-america' },
  'central-america': { name: 'Central America', continent: 'north-america' },

  venezuela: { name: 'Venezuela', continent: 'south-america' },
  peru: { name: 'Peru', continent: 'south-america' },
  brazil: { name: 'Brazil', continent: 'south-america' },
  argentina: { name: 'Argentina', continent: 'south-america' },

  iceland: { name: 'Iceland', continent: 'europe' },
  'great-britain': { name: 'Great Britain', continent: 'europe' },
  scandinavia: { name: 'Scandinavia', continent: 'europe' },
  'northern-europe': { name: 'Northern Europe', continent: 'europe' },
  'western-europe': { name: 'Western Europe', continent: 'europe' },
  'southern-europe': { name: 'Southern Europe', continent: 'europe' },
  ukraine: { name: 'Ukraine', continent: 'europe' },

  'north-africa': { name: 'North Africa', continent: 'africa' },
  egypt: { name: 'Egypt', continent: 'africa' },
  'east-africa': { name: 'East Africa', continent: 'africa' },
  congo: { name: 'Congo', continent: 'africa' },
  'south-africa': { name: 'South Africa', continent: 'africa' },
  madagascar: { name: 'Madagascar', continent: 'africa' },

  ural: { name: 'Ural', continent: 'asia' },
  siberia: { name: 'Siberia', continent: 'asia' },
  yakutsk: { name: 'Yakutsk', continent: 'asia' },
  kamchatka: { name: 'Kamchatka', continent: 'asia' },
  irkutsk: { name: 'Irkutsk', continent: 'asia' },
  mongolia: { name: 'Mongolia', continent: 'asia' },
  japan: { name: 'Japan', continent: 'asia' },
  afghanistan: { name: 'Afghanistan', continent: 'asia' },
  china: { name: 'China', continent: 'asia' },
  'middle-east': { name: 'Middle East', continent: 'asia' },
  india: { name: 'India', continent: 'asia' },
  siam: { name: 'Siam', continent: 'asia' },

  indonesia: { name: 'Indonesia', continent: 'australia' },
  'new-guinea': { name: 'New Guinea', continent: 'australia' },
  'western-australia': { name: 'Western Australia', continent: 'australia' },
  'eastern-australia': { name: 'Eastern Australia', continent: 'australia' },
} as const satisfies Record<string, { name: string; continent: Continent }>

export type Territory = keyof typeof TERRITORIES

export const TERRITORY_IDS = Object.keys(TERRITORIES) as Territory[]

/** Each link once, in the order a player would read the board. */
const LINKS: readonly (readonly [Territory, Territory])[] = [
  ['alaska', 'northwest-territory'],
  ['alaska', 'alberta'],
  ['alaska', 'kamchatka'],
  ['northwest-territory', 'alberta'],
  ['northwest-territory', 'ontario'],
  ['northwest-territory', 'greenland'],
  ['greenland', 'ontario'],
  ['greenland', 'quebec'],
  ['greenland', 'iceland'],
  ['alberta', 'ontario'],
  ['alberta', 'western-us'],
  ['ontario', 'western-us'],
  ['ontario', 'eastern-us'],
  ['ontario', 'quebec'],
  ['quebec', 'eastern-us'],
  ['western-us', 'eastern-us'],
  ['western-us', 'central-america'],
  ['eastern-us', 'central-america'],
  ['central-america', 'venezuela'],

  ['venezuela', 'peru'],
  ['venezuela', 'brazil'],
  ['peru', 'brazil'],
  ['peru', 'argentina'],
  ['brazil', 'argentina'],
  ['brazil', 'north-africa'],

  ['iceland', 'great-britain'],
  ['iceland', 'scandinavia'],
  ['great-britain', 'scandinavia'],
  ['great-britain', 'northern-europe'],
  ['great-britain', 'western-europe'],
  ['scandinavia', 'northern-europe'],
  ['scandinavia', 'ukraine'],
  ['northern-europe', 'ukraine'],
  ['northern-europe', 'southern-europe'],
  ['northern-europe', 'western-europe'],
  ['western-europe', 'southern-europe'],
  ['western-europe', 'north-africa'],
  ['southern-europe', 'ukraine'],
  ['southern-europe', 'middle-east'],
  ['southern-europe', 'egypt'],
  ['southern-europe', 'north-africa'],
  ['ukraine', 'middle-east'],
  ['ukraine', 'afghanistan'],
  ['ukraine', 'ural'],

  ['north-africa', 'egypt'],
  ['north-africa', 'east-africa'],
  ['north-africa', 'congo'],
  ['egypt', 'middle-east'],
  ['egypt', 'east-africa'],
  ['east-africa', 'congo'],
  ['east-africa', 'south-africa'],
  ['east-africa', 'madagascar'],
  ['east-africa', 'middle-east'],
  ['congo', 'south-africa'],
  ['south-africa', 'madagascar'],

  ['middle-east', 'afghanistan'],
  ['middle-east', 'india'],
  ['afghanistan', 'ural'],
  ['afghanistan', 'china'],
  ['afghanistan', 'india'],
  ['ural', 'siberia'],
  ['ural', 'china'],
  ['siberia', 'yakutsk'],
  ['siberia', 'irkutsk'],
  ['siberia', 'mongolia'],
  ['siberia', 'china'],
  ['yakutsk', 'kamchatka'],
  ['yakutsk', 'irkutsk'],
  ['kamchatka', 'irkutsk'],
  ['kamchatka', 'mongolia'],
  ['kamchatka', 'japan'],
  ['irkutsk', 'mongolia'],
  ['mongolia', 'japan'],
  ['mongolia', 'china'],
  ['china', 'siam'],
  ['china', 'india'],
  ['india', 'siam'],
  ['siam', 'indonesia'],

  ['indonesia', 'new-guinea'],
  ['indonesia', 'western-australia'],
  ['new-guinea', 'western-australia'],
  ['new-guinea', 'eastern-australia'],
  ['western-australia', 'eastern-australia'],
]

export const LINK_LIST = LINKS

export const ADJACENT: Record<Territory, readonly Territory[]> = (() => {
  const adj = Object.fromEntries(TERRITORY_IDS.map((t) => [t, [] as Territory[]])) as Record<
    Territory,
    Territory[]
  >
  for (const [a, b] of LINKS) {
    adj[a].push(b)
    adj[b].push(a)
  }
  return adj
})()

export const adjacent = (a: Territory, b: Territory) => ADJACENT[a].includes(b)

export const inContinent = (c: Continent) =>
  TERRITORY_IDS.filter((t) => TERRITORIES[t].continent === c)

export const CONTINENT_IDS = Object.keys(CONTINENTS) as Continent[]

/**
 * The territories through which a continent can be entered: those with a
 * neighbor outside it. Holding a continent means holding these.
 */
export const BORDERS: Record<Continent, readonly Territory[]> = Object.fromEntries(
  CONTINENT_IDS.map((c) => [
    c,
    inContinent(c).filter((t) => ADJACENT[t].some((n) => TERRITORIES[n].continent !== c)),
  ]),
) as Record<Continent, Territory[]>
