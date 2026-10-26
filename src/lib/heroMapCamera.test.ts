import { PerspectiveCamera, Vector3 } from 'three';
import hexDataset from '../../public/data/hex-indonesia.json';
import {
  HERO_CAMERA_POSITION,
  HERO_FOV,
  HERO_FRAME_ASPECT,
  HERO_TARGET,
  projectToHeroFrame,
} from './heroMapCamera';

describe('projectToHeroFrame', () => {
  const camera = new PerspectiveCamera(HERO_FOV, HERO_FRAME_ASPECT, 1, 500);
  camera.position.set(...HERO_CAMERA_POSITION);
  camera.lookAt(new Vector3(...HERO_TARGET));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  it('agrees with a three.js perspective camera', () => {
    for (const point of [
      [0, 0, 0],
      [-20, 0.4, 7],
      [22, 0.2, -8],
      [5, 0.7, 3],
    ] as const) {
      const expected = new Vector3(...point).project(camera);
      const actual = projectToHeroFrame(point);
      expect(actual.u).toBeCloseTo((expected.x + 1) / 2, 6);
      expect(actual.v).toBeCloseTo((1 - expected.y) / 2, 6);
    }
  });

  it('puts the look-at target in the middle of the zone', () => {
    const { u, v } = projectToHeroFrame(HERO_TARGET);
    expect(u).toBeCloseTo(0.5, 6);
    expect(v).toBeCloseTo(0.5, 6);
  });

  it('keeps every hexagon of the dataset inside the zone, clear of the edges', () => {
    for (const [x, z] of hexDataset.cells as [number, number, number, number, number | null][]) {
      const { u, v } = projectToHeroFrame([x, 0.2, z]);
      expect(u).toBeGreaterThan(0.01);
      expect(u).toBeLessThan(0.98);
      expect(v).toBeGreaterThan(0.05);
      expect(v).toBeLessThan(0.95);
    }
  });
});
