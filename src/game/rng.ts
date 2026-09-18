/**
 * mulberry32 — small, fast, seedable PRNG.
 * The dice and the deal come from it, and so do the bots' leanings, so a seed
 * replays a whole game exactly and a test can throw the same dice twice.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = ReturnType<typeof makeRng>

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
