import * as THREE from 'three';

/** One region's pieces before batching: its extruded body (caps = group 0, sides = group 1) and outline. */
export interface RegionPiece {
  readonly regionId: string;
  /** Non-indexed, caps first then sides (as `consolidateExtrudeGroups` leaves it), already in world axes. */
  readonly body: THREE.BufferGeometry;
  readonly outline: THREE.BufferGeometry | null;
}

interface Range {
  readonly start: number;
  readonly count: number;
}

interface RegionRanges {
  readonly tops: Range;
  readonly sides: Range;
  readonly outline: Range | null;
  readonly bounds: THREE.Box3;
  lift: number;
}

export interface RegionHit {
  readonly regionId: string;
  readonly distance: number;
}

export interface RegionBatchMaterials {
  /** The lit top surface of the 3D map (per-vertex colour). */
  readonly top: THREE.Material;
  /** The unlit top surface of the flat 2D map (per-vertex colour), far cheaper to draw. */
  readonly flatTop: THREE.Material;
  readonly side: THREE.Material;
  readonly outline: THREE.Material;
}

const ATTRIBUTES = ['position', 'normal', 'uv'] as const;

function capsAndSides(body: THREE.BufferGeometry): { caps: Range; sides: Range } {
  const total = body.getAttribute('position').count;
  const [capGroup, sideGroup] = body.groups;
  if (!capGroup) return { caps: { start: 0, count: total }, sides: { start: total, count: 0 } };
  return {
    caps: { start: capGroup.start, count: capGroup.count },
    sides: sideGroup ? { start: sideGroup.start, count: sideGroup.count } : { start: total, count: 0 },
  };
}

/**
 * First vertex of every cap triangle that faces up. The extrusion's bottom lid faces down and can
 * never be seen from above the map, so it is left out of the batch altogether.
 */
function upwardTriangles(body: THREE.BufferGeometry, caps: Range): number[] {
  const normals = body.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const starts: number[] = [];
  for (let i = caps.start; i + 2 < caps.start + caps.count; i += 3) {
    if (!normals || normals.getY(i) > 0) starts.push(i);
  }
  return starts;
}

/**
 * All Explore regions as one mesh (two draw calls: every top, then every side) and one outline
 * (one draw call), instead of three draw calls per region: about 1 550 draw calls per frame become 3.
 * Each region keeps its own vertex ranges, so it can still be recoloured, lifted and picked alone.
 * The flat 2D map draws the tops only, unlit (`setFlat`).
 */
export class RegionBatch {
  readonly mesh: THREE.Mesh;
  readonly outline: THREE.LineSegments | null;
  private readonly ranges = new Map<string, RegionRanges>();
  private readonly order: string[] = [];
  private readonly materials: RegionBatchMaterials;
  private readonly topTotal: number;
  private readonly sideTotal: number;

  constructor(pieces: readonly RegionPiece[], materials: RegionBatchMaterials, topColour: THREE.Color) {
    this.materials = materials;
    const split = pieces.map((piece) => {
      const { caps, sides } = capsAndSides(piece.body);
      return { piece, tops: upwardTriangles(piece.body, caps), sides };
    });
    const topTotal = split.reduce((sum, item) => sum + item.tops.length * 3, 0);
    const sideTotal = split.reduce((sum, item) => sum + item.sides.count, 0);
    const total = topTotal + sideTotal;
    this.topTotal = topTotal;
    this.sideTotal = sideTotal;

    const geometry = new THREE.BufferGeometry();
    for (const name of ATTRIBUTES) {
      const first = pieces.find((piece) => piece.body.getAttribute(name));
      const itemSize = first?.body.getAttribute(name).itemSize;
      if (!itemSize) continue;
      const out = new Float32Array(total * itemSize);
      let topOffset = 0;
      let sideOffset = topTotal;
      for (const { piece, tops, sides } of split) {
        const array = piece.body.getAttribute(name).array as Float32Array;
        for (const start of tops) {
          out.set(array.subarray(start * itemSize, (start + 3) * itemSize), topOffset * itemSize);
          topOffset += 3;
        }
        out.set(
          array.subarray(sides.start * itemSize, (sides.start + sides.count) * itemSize),
          sideOffset * itemSize,
        );
        sideOffset += sides.count;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(out, itemSize));
    }
    // Per-vertex colour for the tops (hover and selection recolour one region's range).
    const colours = new Float32Array(total * 3);
    for (let i = 0; i < topTotal; i += 1) topColour.toArray(colours, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.computeBoundingSphere();

    const outlineTotal = pieces.reduce(
      (sum, piece) => sum + (piece.outline?.getAttribute('position').count ?? 0),
      0,
    );
    const outlinePositions = new Float32Array(outlineTotal * 3);

    let topOffset = 0;
    let sideOffset = topTotal;
    let outlineOffset = 0;
    const box = new THREE.Box3();
    for (const { piece, tops, sides } of split) {
      let outline: Range | null = null;
      const outlineSource = piece.outline?.getAttribute('position');
      if (outlineSource) {
        outlinePositions.set(outlineSource.array, outlineOffset * 3);
        outline = { start: outlineOffset, count: outlineSource.count };
        outlineOffset += outlineSource.count;
      }
      piece.body.computeBoundingBox();
      this.ranges.set(piece.regionId, {
        tops: { start: topOffset, count: tops.length * 3 },
        sides: { start: sideOffset, count: sides.count },
        outline,
        bounds: (piece.body.boundingBox ?? box).clone(),
        lift: 0,
      });
      this.order.push(piece.regionId);
      topOffset += tops.length * 3;
      sideOffset += sides.count;
      piece.body.dispose();
      piece.outline?.dispose();
    }

    this.mesh = new THREE.Mesh(geometry, [materials.top, materials.side]);
    this.setFlat(false);
    if (outlineTotal > 0) {
      const outlineGeometry = new THREE.BufferGeometry();
      outlineGeometry.setAttribute('position', new THREE.BufferAttribute(outlinePositions, 3));
      this.outline = new THREE.LineSegments(outlineGeometry, materials.outline);
    } else {
      this.outline = null;
    }
  }

  get regionIds(): readonly string[] {
    return this.order;
  }

  /**
   * The flat 2D map: the tops only (the sides are hidden from straight above, and most of the
   * triangles), with the unlit material. The 3D map: lit tops and the extruded sides.
   */
  setFlat(flat: boolean): void {
    const geometry = this.mesh.geometry;
    geometry.clearGroups();
    geometry.addGroup(0, this.topTotal, 0);
    if (!flat) geometry.addGroup(this.topTotal, this.sideTotal, 1);
    this.mesh.material = [flat ? this.materials.flatTop : this.materials.top, this.materials.side];
  }

  /** Colour of one region's top and its lift above the others (hover / selection). */
  paint(regionId: string, colour: THREE.Color, lift: number): void {
    const region = this.ranges.get(regionId);
    if (!region) return;
    const colours = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = region.tops.start; i < region.tops.start + region.tops.count; i += 1) {
      colours.setXYZ(i, colour.r, colour.g, colour.b);
    }
    colours.addUpdateRange(region.tops.start * 3, region.tops.count * 3);
    colours.needsUpdate = true;

    const delta = lift - region.lift;
    if (delta === 0) return;
    region.lift = lift;
    region.bounds.min.y += delta;
    region.bounds.max.y += delta;
    const positions = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.shift(positions, region.tops, delta);
    this.shift(positions, region.sides, delta);
    if (region.outline && this.outline) {
      this.shift(
        this.outline.geometry.getAttribute('position') as THREE.BufferAttribute,
        region.outline,
        delta,
      );
    }
  }

  /**
   * The nearest region under the raycaster's ray: a box test per region, then only the triangles of
   * the regions it passes through. Works in the mesh's own space (the map is scaled for extrusion).
   */
  raycast(raycaster: THREE.Raycaster): RegionHit | null {
    this.mesh.updateWorldMatrix(true, false);
    const ray = raycaster.ray.clone().applyMatrix4(this.mesh.matrixWorld.clone().invert());
    const positions = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const point = new THREE.Vector3();
    let best: RegionHit | null = null;
    for (const [regionId, region] of this.ranges) {
      if (!ray.intersectsBox(region.bounds)) continue;
      for (const range of [region.tops, region.sides]) {
        for (let i = range.start; i + 2 < range.start + range.count; i += 3) {
          a.fromBufferAttribute(positions, i);
          b.fromBufferAttribute(positions, i + 1);
          c.fromBufferAttribute(positions, i + 2);
          if (!ray.intersectTriangle(a, b, c, false, point)) continue;
          const distance = ray.origin.distanceTo(point);
          if (!best || distance < best.distance) best = { regionId, distance };
        }
      }
    }
    return best;
  }

  /** Frees the geometry and both top materials (only the one in use is reachable from the scene). */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.outline?.geometry.dispose();
    this.materials.top.dispose();
    this.materials.flatTop.dispose();
  }

  private shift(attribute: THREE.BufferAttribute, range: Range, delta: number): void {
    for (let i = range.start; i < range.start + range.count; i += 1) {
      attribute.setY(i, attribute.getY(i) + delta);
    }
    attribute.addUpdateRange(range.start * 3, range.count * 3);
    attribute.needsUpdate = true;
  }
}
