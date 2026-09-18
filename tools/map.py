#!/usr/bin/env python3
"""
Build src/game/board.json from Natural Earth.

The forty-two territories are groups of real countries and, for the five
countries that the board cuts through (Russia, Canada, the United States,
Australia, China) and the one it cuts across (Indonesia, whose half of New
Guinea belongs with the other half), their first-level provinces.

Natural Earth is public domain, so the outlines carry no license of their own.
The grouping below is ours: which country goes in which territory is the one
part of this map anybody had to decide.

    python3 -m venv .venv && .venv/bin/pip install shapely pyshp
    .venv/bin/python tools/map.py path/to/natural-earth

The directory needs the 1:50m admin-0 countries and admin-1 states and
provinces, unzipped where naciscdn.org puts them:

    ne_50m_admin_0_countries/ne_50m_admin_0_countries.shp
    ne_50m_admin_1_states_provinces/ne_50m_admin_1_states_provinces.shp
"""

import json
import math
import sys
from pathlib import Path

import shapefile
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import polylabel, unary_union, nearest_points
from shapely import affinity

# ---------------------------------------------------------------- grouping

COUNTRIES = {
    # North America. Alaska, Canada and the United States come from admin-1.
    'greenland': ['GRL'],
    'central-america': [
        'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN',
        'CUB', 'JAM', 'HTI', 'DOM', 'BHS', 'PRI', 'TCA', 'CYM',
    ],
    # South America.
    'venezuela': ['VEN', 'COL', 'GUY', 'SUR'],  # plus French Guiana, below
    'peru': ['PER', 'ECU', 'BOL'],
    'brazil': ['BRA'],
    'argentina': ['ARG', 'CHL', 'URY', 'PRY', 'FLK'],
    # Europe.
    'iceland': ['ISL', 'FRO'],
    'great-britain': ['GBR', 'IRL', 'IMN', 'GGY', 'JEY'],
    'scandinavia': ['NOR', 'SWE', 'FIN', 'ALD'],
    'northern-europe': ['DEU', 'POL', 'DNK', 'NLD', 'BEL', 'LUX', 'CZE', 'SVK'],
    'western-europe': ['FRA', 'ESP', 'PRT', 'AND', 'MCO'],  # metropolitan France only
    'southern-europe': [
        'ITA', 'CHE', 'LIE', 'AUT', 'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'KOS',
        'ALB', 'MKD', 'GRC', 'BGR', 'ROU', 'HUN', 'MLT', 'SMR', 'VAT',
    ],
    'ukraine': ['UKR', 'BLR', 'MDA', 'EST', 'LVA', 'LTU'],  # plus European Russia
    # Africa.
    'north-africa': [
        'MAR', 'SAH', 'DZA', 'TUN', 'MRT', 'MLI', 'NER', 'TCD', 'SEN', 'GMB',
        'GNB', 'GIN', 'SLE', 'LBR', 'CIV', 'BFA', 'GHA', 'TGO', 'BEN', 'NGA',
    ],
    'egypt': ['EGY', 'LBY'],
    'east-africa': [
        'SDN', 'SDS', 'ETH', 'ERI', 'DJI', 'SOM', 'SOL', 'KEN', 'UGA', 'TZA',
        'RWA', 'BDI',
    ],
    'congo': ['COD', 'COG', 'CAF', 'CMR', 'GAB', 'GNQ', 'AGO'],
    'south-africa': ['ZAF', 'NAM', 'BWA', 'ZWE', 'ZMB', 'MOZ', 'MWI', 'LSO', 'SWZ'],
    'madagascar': ['MDG', 'COM'],
    # Asia. Russia and China come from admin-1.
    'middle-east': [
        'TUR', 'SYR', 'LBN', 'ISR', 'PSX', 'JOR', 'IRQ', 'SAU', 'KWT', 'BHR',
        'QAT', 'ARE', 'OMN', 'YEM', 'IRN', 'CYP', 'CYN', 'GEO', 'ARM', 'AZE',
    ],
    'afghanistan': ['AFG', 'KAZ', 'UZB', 'TKM', 'TJK', 'KGZ'],
    'india': ['IND', 'PAK', 'NPL', 'BTN', 'BGD', 'LKA', 'KAS'],
    'siam': ['THA', 'MMR', 'LAO', 'KHM', 'VNM', 'MYS', 'SGP'],
    'china': ['TWN', 'HKG', 'MAC'],
    # Korea goes with Manchuria rather than China: on the board China does not
    # reach the Pacific coast of Russia, and North Korea would take it there.
    'mongolia': ['MNG', 'PRK', 'KOR'],
    'japan': ['JPN'],
    # Australia. Indonesia and Australia come from admin-1.
    'indonesia': ['PHL', 'BRN', 'TLS'],
    'new-guinea': ['PNG', 'SLB'],
    'eastern-australia': ['NZL'],
}

# Countries taken apart by province instead. Each maps a province to its
# territory; anything not named goes to the default.
PROVINCES = {
    'USA': ('eastern-us', {
        'Alaska': 'alaska',
        **{s: 'western-us' for s in [
            'Washington', 'Oregon', 'California', 'Nevada', 'Idaho', 'Montana',
            'Wyoming', 'Utah', 'Colorado', 'Arizona', 'New Mexico',
            'North Dakota', 'South Dakota', 'Nebraska', 'Kansas',
        ]},
        'Hawaii': None,
    }),
    'CAN': ('quebec', {
        'Yukon': 'northwest-territory',
        'Northwest Territories': 'northwest-territory',
        'Nunavut': 'northwest-territory',
        'British Columbia': 'alberta',
        'Alberta': 'alberta',
        'Saskatchewan': 'alberta',
        'Manitoba': 'ontario',
        'Ontario': 'ontario',
    }),
    'AUS': ('eastern-australia', {
        'Western Australia': 'western-australia',
        'Northern Territory': 'western-australia',
        'South Australia': 'western-australia',
    }),
    'CHN': ('china', {
        'Inner Mongol': 'mongolia',
        'Heilongjiang': 'mongolia',
        'Jilin': 'mongolia',
        'Liaoning': 'mongolia',
    }),
    'IDN': ('indonesia', {
        'Papua': 'new-guinea',
        'Papua Barat': 'new-guinea',
    }),
}

# Russia is grouped by federal district first, then by name, because the
# board's line down the Urals is not quite the administrative one.
RUSSIA_BY_NAME = {
    'Komi': 'ural', 'Nenets': 'ural', "Perm'": 'ural', 'Bashkortostan': 'ural',
    'Orenburg': 'ural', 'Udmurt': 'ural',
    # The steppe south of the Siberian plain, so Siberia meets Kazakhstan only
    # where the Altai Republic does, and the board's Siberia never borders it.
    'Omsk': 'ural', 'Novosibirsk': 'ural', 'Altay': 'ural',
    'Irkutsk': 'irkutsk', 'Buryat': 'irkutsk', 'Chita': 'irkutsk',
    'Sakha (Yakutia)': 'yakutsk',
    'Kaliningrad': 'northern-europe',
}
RUSSIA_BY_REGION = {
    'Urals': 'ural',
    'Siberian': 'siberia',
    'Far Eastern': 'kamchatka',
}


def russia(rec):
    return RUSSIA_BY_NAME.get(rec['name']) or RUSSIA_BY_REGION.get(rec['region']) or 'ukraine'


# ---------------------------------------------------------------- geometry

LON0 = -170.0       # the board's left edge; Alaska's Aleutians wrap to it
LON1 = 192.0        # and the right edge, past the date line for Chukotka
LAT_MIN = -56.0
LAT_MAX = 84.0
SCALE = 4.0         # board units per degree of longitude
SIMPLIFY = 0.12     # degrees
MIN_ISLAND = 0.35   # square degrees; smaller islands are dropped


def miller(lat):
    lat = max(LAT_MIN, min(LAT_MAX, lat))
    return math.degrees(1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat))))


Y_TOP = miller(LAT_MAX)


def project(geom):
    def xy(x, y, z=None):
        return ((x - LON0) * SCALE, (Y_TOP - miller(y)) * SCALE)
    from shapely.ops import transform
    return transform(lambda xs, ys, zs=None: tuple(zip(*[xy(x, y) for x, y in zip(xs, ys)])), geom)


def polygons(geom):
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, 'geoms', []) if isinstance(g, Polygon)]


def wrap(tid, poly):
    """Move a polygon across the date line to the side of the board it lives on."""
    c = poly.centroid.x
    if tid == 'alaska' and c > 0:
        return affinity.translate(poly, -360)
    if c < LON0:
        return affinity.translate(poly, 360)
    return poly


def keep(tid, code, poly):
    """Drop the overseas pieces a country's outline carries with it."""
    x, y = poly.centroid.x, poly.centroid.y
    if code == 'FRA':
        if -55 < x < -50 and 2 < y < 6:
            return 'venezuela'  # French Guiana
        return tid if (-6 < x < 10 and 41 < y < 52) else None
    if code == 'NOR' and y > 74:
        return None  # Svalbard
    if code == 'ESP' and (x < -12 or y < 36):
        return None  # the Canaries, Ceuta and Melilla
    if code == 'PRT' and x < -12:
        return None  # the Azores and Madeira
    if code == 'CHL' and x < -100:
        return None  # Easter Island
    if code == 'ECU' and x < -85:
        return None  # the Galápagos
    if code == 'GBR' and not (-9 < x < 3 and 49 < y < 61):
        return None
    if code == 'NLD' and y < 40:
        return None  # the Caribbean Netherlands
    if code == 'DNK' and x < 0:
        return None
    if y < LAT_MIN:
        return None
    return tid


def main(src):
    src = Path(src)
    parts = {}

    def add(tid, geom, code):
        for p in polygons(geom):
            if not p.is_valid:
                p = p.buffer(0)
            t = keep(tid, code, p)
            if t:
                parts.setdefault(t, []).append(wrap(t, p))

    lookup = {code: tid for tid, codes in COUNTRIES.items() for code in codes}
    unused = []
    r0 = shapefile.Reader(str(src / 'ne_50m_admin_0_countries/ne_50m_admin_0_countries.shp'))
    for sr in r0.iterShapeRecords():
        code = sr.record['ADM0_A3']
        if code in PROVINCES or code == 'RUS':
            continue
        tid = lookup.get(code)
        if tid is None:
            unused.append(code)
            continue
        add(tid, shape(sr.shape.__geo_interface__), code)

    r1 = shapefile.Reader(str(src / 'ne_50m_admin_1_states_provinces/ne_50m_admin_1_states_provinces.shp'))
    for sr in r1.iterShapeRecords():
        rec = sr.record
        code = rec['adm0_a3']
        if code == 'RUS':
            tid = russia(rec)
        elif code in PROVINCES:
            default, named = PROVINCES[code]
            tid = named.get(rec['name'], default)
        else:
            continue
        if tid:
            add(tid, shape(sr.shape.__geo_interface__), code)

    out = {}
    shapes = {}
    for tid, ps in sorted(parts.items()):
        merged = unary_union([p.buffer(0.02) for p in ps]).buffer(-0.02)
        pieces = sorted(polygons(merged), key=lambda p: -p.area)
        big = [p for p in pieces if p.area >= MIN_ISLAND] or pieces[:1]
        geom = MultiPolygon(big).simplify(SIMPLIFY, preserve_topology=True)
        shapes[tid] = geom
        proj = project(geom)
        main_piece = max(polygons(proj), key=lambda p: p.area)
        label = polylabel(main_piece, tolerance=0.5)
        out[tid] = {
            'd': ' '.join(path(p) for p in polygons(proj)),
            'label': [round(label.x, 1), round(label.y, 1)],
        }

    touching = []
    ids = sorted(shapes)
    grown = {t: shapes[t].buffer(0.25) for t in ids}
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if grown[a].intersects(shapes[b]):
                touching.append([a, b])

    # Nearest points for every pair not touching but close enough that the
    # rules might join them across water. The board draws a lane between
    # these; which pairs are joined is the rules' business, not this file's.
    near = {}
    pshapes = {t: project(shapes[t]) for t in ids}
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if [a, b] in touching:
                continue
            pa, pb = nearest_points(pshapes[a], pshapes[b])
            if pa.distance(pb) < 45 * SCALE:
                near[f'{a}|{b}'] = [round(pa.x, 1), round(pa.y, 1), round(pb.x, 1), round(pb.y, 1)]

    # The line two touching territories share, so the board can say something
    # about it: heavier where it is also a continent's edge, and closed where
    # the classic board has no link across it.
    borders = {}
    for a, b in touching:
        line = pshapes[a].boundary.intersection(pshapes[b].buffer(0.25 * SCALE))
        parts = [g for g in getattr(line, 'geoms', [line]) if g.geom_type == 'LineString' and g.length > 2]
        if parts:
            borders[f'{a}|{b}'] = ''.join(
                'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in g.coords) for g in parts
            )

    # Alaska and Kamchatka meet across the date line, which is the edge of
    # the board: a lane off each side, at the height of each coast.
    alaska = max(polygons(pshapes['alaska']), key=lambda p: p.area)
    kamchatka = max(polygons(pshapes['kamchatka']), key=lambda p: p.area)
    west = min(alaska.exterior.coords, key=lambda c: c[0])
    east = max(kamchatka.exterior.coords, key=lambda c: c[0])

    width = round((LON1 - LON0) * SCALE)
    height = round((Y_TOP - miller(LAT_MIN)) * SCALE)
    board = {
        'source': 'Natural Earth 1:50m, public domain; grouping by tools/map.py',
        'width': width,
        'height': height,
        'territories': out,
        'touching': touching,
        'near': near,
        'borders': borders,
        'wrap': {
            'alaska': [round(west[0], 1), round(west[1], 1)],
            'kamchatka': [round(east[0], 1), round(east[1], 1)],
        },
    }
    dest = Path(__file__).resolve().parent.parent / 'src/game/board.json'
    dest.write_text(json.dumps(board, separators=(',', ':')) + '\n')
    print(f'{len(out)} territories, {len(touching)} land borders, {len(near)} crossings -> {dest}')
    print(f'{dest.stat().st_size // 1024} KiB')
    print('left out:', ' '.join(sorted(unused)))


def path(poly):
    def ring(coords):
        pts = [f'{x:.1f},{y:.1f}' for x, y in coords[:-1]]
        return 'M' + 'L'.join(pts) + 'Z'
    return ring(list(poly.exterior.coords)) + ''.join(ring(list(i.coords)) for i in poly.interiors)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'natural-earth')
