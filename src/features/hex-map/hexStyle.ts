/**
 * Proportions shared by the live scene and the static poster, so the poster really is a picture of
 * the same map. Heights and gaps are fractions of the hexagon size, so they hold at any density.
 */
/** A thin gap between neighbouring hexagons. */
export const HEX_FILL = 0.92;
/** Small, consistent elevation: tiles are low blocks resting on the surface, not towers. */
const BASE_HEIGHT = 0.42;
const HEIGHT_RANGE = 0.55;

/** Height of a tile in world units (degrees) for a simulated 0–1 value. */
export function tileHeight(value: number, hexSizeDeg: number): number {
  return hexSizeDeg * (BASE_HEIGHT + Math.min(1, Math.max(0, value)) * HEIGHT_RANGE);
}
