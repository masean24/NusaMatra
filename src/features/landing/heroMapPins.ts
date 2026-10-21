import { HERO_ORIGIN, lonLatToPlane, projectToHeroFrame } from '@/lib/heroMapCamera';

/** The three floating region cards beside the hero map (ids match `DEMO_HERO_CARDS`). */
export type HeroCardId = 'a' | 'b' | 'c';

export interface HeroPin {
  readonly id: HeroCardId;
  /** Spoken name of the place the pin marks. */
  readonly place: string;
  readonly lon: number;
  readonly lat: number;
}

/**
 * The one place that says which pin belongs to which card. The three places are the orientation
 * nodes of the previous hero map, so the pins stay where they were. They are illustrative: the
 * cards describe fictional "Wilayah A/B/C" (data simulasi), not these places.
 */
export const HERO_PINS: readonly HeroPin[] = [
  { id: 'a', place: 'Simpul tengah (Kalimantan–Sulawesi)', lon: 116.7, lat: -0.97 },
  { id: 'b', place: 'Simpul barat (Sumatra–Jawa)', lon: 106.85, lat: -6.2 },
  { id: 'c', place: 'Simpul timur (Maluku–Papua)', lon: 135.5, lat: -3.8 },
];

/** Height of a hexagon top (world units) a pin stands on. */
const PIN_BASE_HEIGHT = 0.5;

/** Where a pin sits in the hero zone: `u` from the left, `v` from the top, both 0–1. */
export function pinPositionInZone(pin: HeroPin): { readonly u: number; readonly v: number } {
  const { x, z } = lonLatToPlane(pin.lon, pin.lat, HERO_ORIGIN);
  return projectToHeroFrame([x, PIN_BASE_HEIGHT, z]);
}
