/**
 * Colour of a simulated 0–1 value, per display mode. Both palettes keep the same ordering, from
 * the lightest tile (lowest value) to the deepest orange (highest value), so the theme changes how
 * the map looks, never what a tile says. Colour is never the only signal: the cards carry labels.
 */
export type HexTheme = 'normal' | 'glass';
export type Rgb = readonly [number, number, number];

/**
 * Normal: sand → cream-peach → peach → orange → deep orange. The light end is a warm sand, deliberately
 * darker than the ivory page (#f2f1ec), so even the lowest tiles keep their outline and the
 * archipelago reads at a glance. It is still the lightest tile and still means "lowest".
 */
const NORMAL_STOPS: readonly Rgb[] = [
  [0xe6, 0xd5, 0xb8],
  [0xf2, 0xc8, 0x9f],
  [0xff, 0xab, 0x72],
  [0xff, 0x86, 0x36],
  [0xd2, 0x52, 0x16],
];

/** Kaca: the same warm ramp, but the light end is cobalt-tinted ice and the dark end a touch redder. */
const GLASS_STOPS: readonly Rgb[] = [
  [0xe3, 0xea, 0xff],
  [0xff, 0xdc, 0xc8],
  [0xff, 0xb5, 0x84],
  [0xff, 0x8f, 0x45],
  [0xe3, 0x5a, 0x1e],
];

const STOPS: Record<HexTheme, readonly Rgb[]> = { normal: NORMAL_STOPS, glass: GLASS_STOPS };

/** Interpolated colour as 0–255 channels. `value` is clamped to 0–1. */
export function valueToRgb(value: number, theme: HexTheme = 'normal'): Rgb {
  const stops = STOPS[theme];
  const clamped = Math.min(1, Math.max(0, value));
  const scaled = clamped * (stops.length - 1);
  const lower = Math.min(Math.floor(scaled), stops.length - 2);
  const t = scaled - lower;
  const from = stops[lower];
  const to = stops[lower + 1];
  if (!from || !to) return NORMAL_STOPS[0] ?? [255, 255, 255];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

/** Light, shadow and outline colours of a theme; interpolated while the theme changes. */
export interface HexLightRig {
  readonly ambient: Rgb;
  readonly ambientIntensity: number;
  readonly hemiSky: Rgb;
  readonly hemiGround: Rgb;
  readonly hemiIntensity: number;
  readonly key: Rgb;
  readonly keyIntensity: number;
  readonly shadow: Rgb;
  readonly shadowOpacity: number;
  readonly outline: Rgb;
  readonly outlineOpacity: number;
}

/** Normal: warm daylight on a light page, neutral warm shadows. */
const NORMAL_RIG: HexLightRig = {
  ambient: [255, 247, 238],
  ambientIntensity: 0.4,
  hemiSky: [255, 250, 244],
  hemiGround: [226, 214, 196],
  hemiIntensity: 0.8,
  key: [255, 252, 246],
  keyIntensity: 1.75,
  shadow: [70, 52, 36],
  shadowOpacity: 0.17,
  outline: [47, 91, 255],
  outlineOpacity: 0.7,
};

/** Kaca: cobalt-influenced fill light, cool shadows, a slightly warmer key. */
const GLASS_RIG: HexLightRig = {
  ambient: [205, 217, 255],
  ambientIntensity: 0.6,
  hemiSky: [226, 235, 255],
  hemiGround: [40, 66, 190],
  hemiIntensity: 1.0,
  key: [255, 240, 224],
  keyIntensity: 2.0,
  shadow: [12, 28, 110],
  shadowOpacity: 0.24,
  outline: [255, 255, 255],
  outlineOpacity: 0.8,
};

const RIGS: Record<HexTheme, HexLightRig> = { normal: NORMAL_RIG, glass: GLASS_RIG };

export function lightRigFor(theme: HexTheme): HexLightRig {
  return RIGS[theme];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

export function lerpLightRig(from: HexLightRig, to: HexLightRig, t: number): HexLightRig {
  return {
    ambient: mixRgb(from.ambient, to.ambient, t),
    ambientIntensity: mix(from.ambientIntensity, to.ambientIntensity, t),
    hemiSky: mixRgb(from.hemiSky, to.hemiSky, t),
    hemiGround: mixRgb(from.hemiGround, to.hemiGround, t),
    hemiIntensity: mix(from.hemiIntensity, to.hemiIntensity, t),
    key: mixRgb(from.key, to.key, t),
    keyIntensity: mix(from.keyIntensity, to.keyIntensity, t),
    shadow: mixRgb(from.shadow, to.shadow, t),
    shadowOpacity: mix(from.shadowOpacity, to.shadowOpacity, t),
    outline: mixRgb(from.outline, to.outline, t),
    outlineOpacity: mix(from.outlineOpacity, to.outlineOpacity, t),
  };
}
