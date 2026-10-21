import * as THREE from 'three';

/**
 * `ExtrudeGeometry` given many shapes adds two material groups per shape (caps, sides). A region
 * with hundreds of islands therefore costs hundreds of draw calls per pass, and the 514 LIVE
 * regions add up to tens of thousands per frame. This regroups the same triangles so every region
 * has exactly two groups (caps = material 0, sides = material 1): identical geometry and picking,
 * a few hundred times fewer draw calls.
 *
 * The geometry must be non-indexed, as `ExtrudeGeometry` is.
 */
export function consolidateExtrudeGroups(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.index !== null) throw new Error('consolidateExtrudeGroups expects a non-indexed geometry.');
  const { groups } = geometry;
  if (groups.length <= 2) return geometry;

  const attributes = Object.entries(geometry.attributes).filter(
    (entry): entry is [string, THREE.BufferAttribute] => entry[1] instanceof THREE.BufferAttribute,
  );

  const consolidated = new THREE.BufferGeometry();
  const ranges = [0, 1].map((materialIndex) =>
    groups.filter((group) => group.materialIndex === materialIndex),
  );
  const verticesIn = (list: typeof groups) => list.reduce((sum, group) => sum + group.count, 0);
  const total = verticesIn(groups);

  for (const [name, source] of attributes) {
    const out = new Float32Array(total * source.itemSize);
    let offset = 0;
    for (const list of ranges) {
      for (const group of list) {
        const from = group.start * source.itemSize;
        const to = (group.start + group.count) * source.itemSize;
        out.set((source.array as Float32Array).subarray(from, to), offset);
        offset += to - from;
      }
    }
    consolidated.setAttribute(name, new THREE.BufferAttribute(out, source.itemSize, source.normalized));
  }

  const capVertices = verticesIn(ranges[0] ?? []);
  consolidated.addGroup(0, capVertices, 0);
  consolidated.addGroup(capVertices, total - capVertices, 1);
  geometry.dispose();
  return consolidated;
}

/** One `LineSegments` geometry for all the rings of a region: one draw call instead of one per ring. */
export function ringsToSegmentsGeometry(rings: readonly (readonly THREE.Vector3[])[]): THREE.BufferGeometry {
  const segments = rings.reduce((sum, ring) => sum + Math.max(0, ring.length - 1), 0);
  const positions = new Float32Array(segments * 6);
  let offset = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const a = ring[i];
      const b = ring[i + 1];
      if (!a || !b) continue;
      positions.set([a.x, a.y, a.z, b.x, b.y, b.z], offset);
      offset += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
