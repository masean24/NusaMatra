import type { Material } from 'three';

/** Material slots for a BoxGeometry, whose faces are ordered +x, −x, +y (top), −y, +z, −z. */
export function boxMaterials(top: Material, side: Material): Material[] {
  return [side, side, top, side, side, side];
}
