/**
 * Deterministic value noise for illustrative relief. Same seedless hash on every run, so the
 * terrain looks identical across reloads and test runs.
 */
export function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal Brownian motion in [0, 1). */
export function fbmNoise(x: number, y: number, octaves = 4): number {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    frequency *= 2.05;
    amplitude *= 0.5;
  }
  return value;
}

/** Ridged multifractal in [0, 1]: sharp crests, the shape of mountain spines. */
export function ridgedNoise(x: number, y: number, octaves = 4): number {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    const ridge = 1.0 - Math.abs(smoothNoise(x * frequency, y * frequency) * 2.0 - 1.0);
    const sharpened = ridge * ridge * weight;
    value += sharpened * amplitude;
    weight = Math.min(1, sharpened * 2);
    frequency *= 2.1;
    amplitude *= 0.5;
  }
  return Math.min(1, value / 0.94);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
