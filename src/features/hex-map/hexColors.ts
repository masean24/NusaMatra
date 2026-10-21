/**
 * Colour of a simulated 0–1 value, on the design's five priority steps (tokens `--nm-priority-1…5`):
 * very low = limestone white, low = peach, medium = light orange, high = orange, very high = dark orange.
 * Colour is never the only signal: the legend and the cards carry the labels.
 */
const PRIORITY_STOPS = [
  [0xfb, 0xfa, 0xf6],
  [0xff, 0xd9, 0xbf],
  [0xff, 0xb0, 0x7a],
  [0xff, 0x8a, 0x3d],
  [0xd9, 0x58, 0x1a],
] as const;

export type Rgb = readonly [number, number, number];

/** Interpolated colour as 0–255 channels. `value` is clamped to 0–1. */
export function valueToRgb(value: number): Rgb {
  const clamped = Math.min(1, Math.max(0, value));
  const scaled = clamped * (PRIORITY_STOPS.length - 1);
  const lower = Math.min(Math.floor(scaled), PRIORITY_STOPS.length - 2);
  const t = scaled - lower;
  const from = PRIORITY_STOPS[lower];
  const to = PRIORITY_STOPS[lower + 1];
  if (!from || !to) return PRIORITY_STOPS[0];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}
