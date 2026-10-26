import * as THREE from 'three';
import { PointOverlay, type MapOverlayPoint } from './pointOverlay';

const project = (lon: number, lat: number, elevation: number) => new THREE.Vector3(lon, elevation, -lat);
const point = (id: string, overrides: Partial<MapOverlayPoint> = {}): MapOverlayPoint => ({
  id,
  lon: 10,
  lat: 0,
  size: 0.3,
  label: `Gempa ${id}`,
  isNew: false,
  ...overrides,
});

describe('PointOverlay', () => {
  it('places each point with the given projection, above the land', () => {
    const overlay = new PointOverlay(project);
    overlay.setPoints([point('a', { lon: 3, lat: 2 })], 0, false);
    const [group] = overlay.group.children;
    expect(group?.position.toArray()).toEqual([3, 0.52, -2]);
  });

  it('keeps unchanged markers and removes the ones that disappeared', () => {
    const overlay = new PointOverlay(project);
    overlay.setPoints([point('a'), point('b', { lon: 20 })], 0, false);
    const kept = overlay.group.children[0];
    overlay.setPoints([point('a')], 1000, false);
    expect(overlay.group.children).toHaveLength(1);
    expect(overlay.group.children[0]).toBe(kept);
  });

  it('animates only new points, once, and not at all when motion is reduced', () => {
    const overlay = new PointOverlay(project);
    overlay.setPoints([point('old')], 0, true);
    overlay.setPoints([point('old'), point('new', { lon: 30, isNew: true })], 0, true);
    const [oldGroup, newGroup] = overlay.group.children;
    expect(oldGroup?.scale.x).toBe(1);
    expect(newGroup?.scale.x).toBeLessThan(0.01);
    overlay.tick(5000);
    expect(newGroup?.scale.x).toBe(1);

    const calm = new PointOverlay(project);
    calm.setPoints([point('new', { isNew: true })], 0, false);
    expect(calm.group.children[0]?.scale.x).toBe(1);
  });

  it('finds a marker under a ray and reports its label', () => {
    const overlay = new PointOverlay(project);
    overlay.setPoints([point('a', { lon: 0, lat: 0, size: 1 })], 0, false);
    overlay.group.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
    expect(overlay.hit(raycaster)).toBe('a');
    expect(overlay.labelOf('a')).toBe('Gempa a');
  });
});
