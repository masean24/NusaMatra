import { CatmullRomCurve3, Shape, Vector2, Vector3 } from 'three';

/** Small deterministic PRNG (mulberry32) so every island keeps the same outline on each render. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An organic island outline: points on a circle with seeded radial jitter, smoothed with a
 * closed Catmull-Rom curve. Purely illustrative; never a real coastline.
 */
export function islandShape(seed: number, radius: number, irregularity = 0.18, lobes = 9): Shape {
  const random = seededRandom(seed);
  const controlPoints: Vector3[] = [];
  for (let index = 0; index < lobes; index += 1) {
    const angle = (index / lobes) * Math.PI * 2;
    const r = radius * (1 - irregularity + random() * irregularity * 2);
    controlPoints.push(new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
  }
  const curve = new CatmullRomCurve3(controlPoints, true, 'centripetal');
  return new Shape(curve.getPoints(72).map((point) => new Vector2(point.x, point.y)));
}
