/**
 * The displacement field of a thin convex glass lens, as pixels an SVG `feDisplacementMap` can read.
 *
 * Red and green hold the x and y offset (128 = none). Inside the bezel, a band along the rounded
 * outline, every pixel is offset along the outline's outward normal by an amount that is largest at
 * the very edge and falls off smoothly to zero at the inner side of the bezel. Everything inside
 * the bezel is left untouched, so the middle of the glass stays clear. Outside the bezel the field
 * is neutral, so there is no seam anywhere.
 *
 * Sampling outward means the rim shows content from just beyond the glass, squeezed into the band:
 * the compression a real curved edge produces. This is an approximation of one surface profile, not
 * a ray trace.
 */
export interface DisplacementFieldSpec {
  readonly width: number;
  readonly height: number;
  /** Corner radius in px; clamped to half the shorter side (a pill passes its full radius). */
  readonly radius: number;
  /** Width in px of the refracting band along the edge. */
  readonly bezel: number;
}

const NEUTRAL = 128;

/** Smooth, non-linear falloff: steep at the rim, gentle towards the clear centre. */
function falloff(depth: number, bezel: number): number {
  const remaining = 1 - depth / bezel;
  return remaining * remaining;
}

export function buildDisplacementField(spec: DisplacementFieldSpec): Uint8ClampedArray<ArrayBuffer> {
  const { width, height, bezel } = spec;
  const radius = Math.min(spec.radius, width / 2, height / 2);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const halfW = width / 2;
  const halfH = height / 2;
  const innerW = halfW - radius;
  const innerH = halfH - radius;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const dx = x + 0.5 - halfW;
      const dy = y + 0.5 - halfH;
      const px = Math.abs(dx) - innerW;
      const py = Math.abs(dy) - innerH;
      const outsideX = Math.max(px, 0);
      const outsideY = Math.max(py, 0);
      const outside = Math.hypot(outsideX, outsideY);
      // Distance from the outline, positive inside (negated signed distance of a rounded box).
      const inside = radius - outside - Math.min(Math.max(px, py), 0);

      let red = NEUTRAL;
      let green = NEUTRAL;
      if (inside >= 0 && inside < bezel) {
        const signX = dx < 0 ? -1 : 1;
        const signY = dy < 0 ? -1 : 1;
        let normalX: number;
        let normalY: number;
        if (outside > 0) {
          normalX = (signX * outsideX) / outside;
          normalY = (signY * outsideY) / outside;
        } else if (px > py) {
          normalX = signX;
          normalY = 0;
        } else {
          normalX = 0;
          normalY = signY;
        }
        const amount = falloff(inside, bezel);
        red = NEUTRAL + 127 * normalX * amount;
        green = NEUTRAL + 127 * normalY * amount;
      }
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = NEUTRAL;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

/** `feDisplacementMap` scale that makes a full-intensity pixel move `maxDisplacement` px. */
export function displacementScale(maxDisplacement: number): number {
  return (2 * maxDisplacement * 255) / 254;
}
