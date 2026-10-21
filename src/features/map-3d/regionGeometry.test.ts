import * as THREE from 'three';
import { consolidateExtrudeGroups, ringsToSegmentsGeometry } from './regionGeometry';

function square(x: number, size: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x, 0);
  shape.lineTo(x + size, 0);
  shape.lineTo(x + size, size);
  shape.lineTo(x, size);
  shape.lineTo(x, 0);
  return shape;
}

describe('consolidateExtrudeGroups', () => {
  const islands = [square(0, 1), square(3, 1), square(6, 2)];
  const original = new THREE.ExtrudeGeometry(islands, { depth: 0.3, bevelEnabled: false });

  it('starts with two material groups per island', () => {
    expect(original.groups).toHaveLength(islands.length * 2);
  });

  it('leaves one cap group and one side group with every triangle kept', () => {
    const vertexCount = original.getAttribute('position').count;
    const consolidated = consolidateExtrudeGroups(
      new THREE.ExtrudeGeometry(islands, { depth: 0.3, bevelEnabled: false }),
    );

    expect(consolidated.groups).toHaveLength(2);
    expect(consolidated.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    expect(consolidated.getAttribute('position').count).toBe(vertexCount);
    const [caps, sides] = consolidated.groups;
    expect((caps?.count ?? 0) + (sides?.count ?? 0)).toBe(vertexCount);
    expect(caps?.start).toBe(0);
    expect(sides?.start).toBe(caps?.count);
  });

  it('keeps the geometry in place: same bounding box and same cap/side triangle totals', () => {
    const before = original.clone();
    before.computeBoundingBox();
    const capsBefore = original.groups
      .filter((group) => group.materialIndex === 0)
      .reduce((s, g) => s + g.count, 0);
    const after = consolidateExtrudeGroups(
      new THREE.ExtrudeGeometry(islands, { depth: 0.3, bevelEnabled: false }),
    );
    after.computeBoundingBox();

    expect(after.boundingBox?.equals(before.boundingBox ?? new THREE.Box3())).toBe(true);
    expect(after.groups[0]?.count).toBe(capsBefore);
  });

  it('returns a geometry that already has two groups unchanged', () => {
    const single = new THREE.ExtrudeGeometry(square(0, 1), { depth: 0.3, bevelEnabled: false });
    expect(consolidateExtrudeGroups(single)).toBe(single);
  });
});

describe('ringsToSegmentsGeometry', () => {
  it('joins consecutive points of every ring into line segments', () => {
    const ringA = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 1, 0)];
    const ringB = [new THREE.Vector3(5, 0, 0), new THREE.Vector3(6, 0, 0)];
    const geometry = ringsToSegmentsGeometry([ringA, ringB]);

    expect(geometry.getAttribute('position').count).toBe((2 + 1) * 2);
    expect(Array.from(geometry.getAttribute('position').array.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0]);
    expect(Array.from(geometry.getAttribute('position').array.slice(12, 18))).toEqual([5, 0, 0, 6, 0, 0]);
  });
});
