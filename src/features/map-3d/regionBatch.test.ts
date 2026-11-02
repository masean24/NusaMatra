import * as THREE from 'three';
import { RegionBatch, type RegionPiece } from './regionBatch';
import { consolidateExtrudeGroups } from './regionGeometry';

/** A unit square region extruded upward, centred at x. */
function squareRegion(regionId: string, x: number): RegionPiece {
  const shape = new THREE.Shape();
  shape.moveTo(x - 0.5, -0.5);
  shape.lineTo(x + 0.5, -0.5);
  shape.lineTo(x + 0.5, 0.5);
  shape.lineTo(x - 0.5, 0.5);
  const body = consolidateExtrudeGroups(
    new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }),
  );
  body.rotateX(-Math.PI / 2);
  const outline = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([x - 0.5, 0.3, 0, x + 0.5, 0.3, 0]), 3),
  );
  return { regionId, body, outline };
}

function makeBatch() {
  const material = new THREE.MeshBasicMaterial();
  return new RegionBatch(
    [squareRegion('A', 0), squareRegion('B', 3)],
    { top: material, flatTop: material, side: material, outline: new THREE.LineBasicMaterial() },
    new THREE.Color('#ffffff'),
  );
}

function rayDownAt(x: number): THREE.Raycaster {
  return new THREE.Raycaster(new THREE.Vector3(x, 10, 0), new THREE.Vector3(0, -1, 0));
}

describe('RegionBatch', () => {
  it('draws every region with two mesh groups and one outline', () => {
    const batch = makeBatch();
    expect(batch.mesh.geometry.groups).toHaveLength(2);
    expect(batch.outline?.geometry.getAttribute('position').count).toBe(4);
    expect(batch.regionIds).toEqual(['A', 'B']);
  });

  it('keeps only upward-facing caps, and the flat map draws only those, unlit', () => {
    const top = new THREE.MeshStandardMaterial();
    const flatTop = new THREE.MeshBasicMaterial();
    const side = new THREE.MeshStandardMaterial();
    const batch = new RegionBatch(
      [squareRegion('A', 0)],
      { top, flatTop, side, outline: new THREE.LineBasicMaterial() },
      new THREE.Color('#ffffff'),
    );
    const normals = batch.mesh.geometry.getAttribute('normal');
    const [topGroup] = batch.mesh.geometry.groups;
    // A square's top lid is two triangles; the bottom lid is gone.
    expect(topGroup?.count).toBe(6);
    for (let i = 0; i < 6; i += 1) expect(normals.getY(i)).toBeGreaterThan(0);

    batch.setFlat(true);
    expect(batch.mesh.geometry.groups).toHaveLength(1);
    expect(batch.mesh.material).toEqual([flatTop, side]);
    batch.setFlat(false);
    expect(batch.mesh.geometry.groups).toHaveLength(2);
    expect(batch.mesh.material).toEqual([top, side]);
  });

  it('picks the region under the ray, and nothing over the sea', () => {
    const batch = makeBatch();
    expect(batch.raycast(rayDownAt(0))?.regionId).toBe('A');
    expect(batch.raycast(rayDownAt(3))?.regionId).toBe('B');
    expect(batch.raycast(rayDownAt(1.5))).toBeNull();
  });

  it('recolours and lifts one region only', () => {
    const batch = makeBatch();
    const positions = batch.mesh.geometry.getAttribute('position');
    const colours = batch.mesh.geometry.getAttribute('color');
    const topBefore = Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)));

    batch.paint('A', new THREE.Color('#ff0000'), 0.16);

    // A's first cap vertex is red; B's caps (after A's) keep the base colour.
    expect(colours.getX(0)).toBeCloseTo(1);
    expect(colours.getY(0)).toBeCloseTo(0);
    const lifted = Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)));
    expect(lifted).toBeCloseTo(topBefore + 0.16);
    // Still picked at its new height; B is untouched and still picked.
    expect(batch.raycast(rayDownAt(0))?.regionId).toBe('A');
    expect(batch.raycast(rayDownAt(3))?.regionId).toBe('B');
  });
});
