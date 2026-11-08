import * as THREE from 'three';
import { consolidateExtrudeGroups, flatRegionTops, ringsToSegmentsGeometry } from './regionGeometry';

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

describe('flatRegionTops', () => {
  /** A square with a square hole, as the map builds a region with an enclave. */
  function squareWithHole(): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(4, 0);
    shape.lineTo(4, 4);
    shape.lineTo(0, 4);
    const hole = new THREE.Path();
    hole.moveTo(1, 1);
    hole.lineTo(1, 3);
    hole.lineTo(3, 3);
    hole.lineTo(3, 1);
    shape.holes.push(hole);
    return shape;
  }

  it('builds only the top: non-indexed, one group-free surface at the given height, facing up after rotation', () => {
    const tops = flatRegionTops([squareWithHole()], 0.31);
    expect(tops.index).toBeNull();
    expect(tops.groups).toHaveLength(0);
    tops.rotateX(-Math.PI / 2); // as the map turns every region body
    const positions = tops.getAttribute('position');
    const normals = tops.getAttribute('normal');
    for (let i = 0; i < positions.count; i += 1) {
      expect(positions.getY(i)).toBeCloseTo(0.31, 6);
      expect(normals.getY(i)).toBeCloseTo(1, 6);
    }
  });

  it('covers the same area as the extruded top, hole included', () => {
    const area = (geometry: THREE.BufferGeometry, upOnly: boolean) => {
      const p = geometry.getAttribute('position');
      const n = geometry.getAttribute('normal');
      let sum = 0;
      for (let i = 0; i + 2 < p.count; i += 3) {
        if (upOnly && n.getZ(i) <= 0.99) continue;
        const ax = p.getX(i);
        const ay = p.getY(i);
        sum +=
          Math.abs(
            (p.getX(i + 1) - ax) * (p.getY(i + 2) - ay) - (p.getX(i + 2) - ax) * (p.getY(i + 1) - ay),
          ) / 2;
      }
      return sum;
    };
    const tops = flatRegionTops([squareWithHole()], 0.31);
    const extruded = new THREE.ExtrudeGeometry(squareWithHole(), { depth: 0.28, bevelEnabled: false });
    expect(area(tops, false)).toBeCloseTo(12, 6);
    expect(area(extruded, true)).toBeCloseTo(12, 6);
  });

  it('is far smaller than the extruded body it replaces on the flat map', () => {
    const tops = flatRegionTops([squareWithHole()], 0.31);
    const extruded = new THREE.ExtrudeGeometry(squareWithHole(), {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.03,
    });
    expect(tops.getAttribute('position').count * 4).toBeLessThan(extruded.getAttribute('position').count);
  });
});
