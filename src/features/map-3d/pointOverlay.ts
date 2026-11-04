import * as THREE from 'three';

/** A clickable point drawn over the map, e.g. an earthquake epicentre. */
export interface MapOverlayPoint {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  /** Relative symbol size: a visual size only, never an area on the ground. */
  readonly size: number;
  /** Short text for the hover label; rendered as text by React, never as HTML. */
  readonly label: string;
  /** Arrived in the latest update: animated once, others never. */
  readonly isNew: boolean;
  /** Colour of the symbol; the host decides what it stands for. */
  readonly color?: string | undefined;
}

/** What the symbols need from the current frame to face the viewer and hold their size on screen. */
export interface OverlayView {
  readonly camera: THREE.PerspectiveCamera;
  readonly heightPx: number;
  /** Below 1 on a small map, where full-size symbols would hide each other and the land. */
  readonly symbolScale?: number;
}

type Projector = (lon: number, lat: number, elevation: number) => THREE.Vector3;

/** Above the extruded land (0.28) and a selected region's lift (0.16). */
const OVERLAY_ELEVATION = 0.52;
const APPEAR_MS = 650;
const RIPPLE_MS = 1400;

const DEFAULT_COLOR = '#121826';
const RING = '#FBFAF6';
const RING_SELECTED = '#FF8A3D';

/** The symbol's radius on screen: the same at every zoom, as map pins are. */
const RADIUS_BASE_PX = 9;
const RADIUS_PX_PER_SIZE = 20;
const SELECTED_SCALE = 1.3;

/** Thin rings around the symbol, lying on the map; they repeat the symbol's size and nothing else. */
const HALOS = [
  { radius: 1.75, opacity: 0.55 },
  { radius: 2.5, opacity: 0.3 },
] as const;

/** A seismograph trace inside the unit disc, as [x, y] corners. */
const TRACE: readonly (readonly [number, number])[] = [
  [-0.66, -0.02],
  [-0.34, -0.02],
  [-0.16, 0.42],
  [0.06, -0.46],
  [0.24, 0.16],
  [0.34, -0.02],
  [0.66, -0.02],
];
const TRACE_WIDTH = 0.13;

/** A polyline as a flat strip of quads, so its weight does not depend on the GPU's line width. */
function strokeGeometry(
  corners: readonly (readonly [number, number])[],
  width: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let index = 0; index + 1 < corners.length; index += 1) {
    const [ax, ay] = corners[index] ?? [0, 0];
    const [bx, by] = corners[index + 1] ?? [0, 0];
    const length = Math.hypot(bx - ax, by - ay);
    // Each segment runs half a width past its ends, which closes the outer corners.
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const nx = (-uy * width) / 2;
    const ny = (ux * width) / 2;
    const sx = ax - (ux * width) / 2;
    const sy = ay - (uy * width) / 2;
    const ex = bx + (ux * width) / 2;
    const ey = by + (uy * width) / 2;
    positions.push(sx + nx, sy + ny, 0, sx - nx, sy - ny, 0, ex - nx, ey - ny, 0);
    positions.push(sx + nx, sy + ny, 0, ex - nx, ey - ny, 0, ex + nx, ey + ny, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

interface Marker {
  readonly point: MapOverlayPoint;
  readonly group: THREE.Group;
  /** Disc, rim and trace: faces the viewer. */
  readonly badge: THREE.Group;
  /** Rings on the map's plane. */
  readonly halos: THREE.Group;
  readonly disc: THREE.Mesh;
  readonly rim: THREE.Mesh;
  readonly trace: THREE.Mesh;
  readonly rimMaterial: THREE.MeshBasicMaterial;
  readonly ripple: THREE.Mesh | null;
  readonly bornAt: number | null;
}

const worldPosition = new THREE.Vector3();
const parentRotation = new THREE.Quaternion();

/**
 * Point layer that lives in its own group beside the regions. Updating it never touches the region
 * geometry, and only markers marked `isNew` animate (a short pop and one ripple), so nothing pulses
 * continuously. Shared geometries are created once and scaled per marker; materials are shared per
 * colour. The symbols always stand on top of the land, so a tilted view never hides or flattens them.
 */
export class PointOverlay {
  readonly group = new THREE.Group();
  private readonly discGeometry = new THREE.CircleGeometry(1, 32);
  private readonly rimGeometry = new THREE.RingGeometry(1, 1.17, 40);
  private readonly traceGeometry = strokeGeometry(TRACE, TRACE_WIDTH);
  private readonly haloGeometry = new THREE.RingGeometry(0.975, 1.025, 64).rotateX(-Math.PI / 2);
  private readonly rippleGeometry = new THREE.RingGeometry(1, 1.28, 32).rotateX(-Math.PI / 2);
  private readonly traceMaterial = new THREE.MeshBasicMaterial({
    color: RING,
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  private readonly discMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly haloMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private markers = new Map<string, Marker>();
  private selectedId: string | null = null;
  private symbolScale = 1;

  private readonly project: Projector;

  constructor(project: Projector) {
    this.project = project;
    this.group.name = 'point-overlay';
    this.group.renderOrder = 10;
  }

  setPoints(points: readonly MapOverlayPoint[], now: number, animate: boolean): void {
    const next = new Map<string, Marker>();
    for (const point of points) {
      const existing = this.markers.get(point.id);
      if (
        existing &&
        existing.point.lon === point.lon &&
        existing.point.lat === point.lat &&
        existing.point.color === point.color
      ) {
        next.set(point.id, { ...existing, point });
        this.markers.delete(point.id);
        continue;
      }
      next.set(point.id, this.createMarker(point, animate && point.isNew ? now : null));
    }
    for (const stale of this.markers.values()) this.disposeMarker(stale);
    this.markers = next;
    this.stackLargestOnTop();
    this.applySelection();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.applySelection();
  }

  /**
   * Turns the symbols to the viewer, holds their size on screen and advances the one-off appear
   * animations. Without a view the symbols keep their relative size.
   */
  tick(now: number, view?: OverlayView): void {
    this.symbolScale = view?.symbolScale ?? 1;
    const parent = view ? this.group.parent : null;
    if (view && parent) {
      parent.getWorldQuaternion(parentRotation).invert().multiply(view.camera.quaternion);
    }
    for (const marker of this.markers.values()) {
      const radius = view ? this.worldRadius(marker, view) : marker.point.size;
      if (view) marker.badge.quaternion.copy(parent ? parentRotation : view.camera.quaternion);
      marker.badge.scale.setScalar(radius * (marker.point.id === this.selectedId ? SELECTED_SCALE : 1));
      marker.halos.scale.setScalar(radius);

      if (marker.bornAt === null) continue;
      const elapsed = now - marker.bornAt;
      const appear = Math.min(1, elapsed / APPEAR_MS);
      const eased = 1 - Math.pow(1 - appear, 3);
      marker.group.scale.setScalar(Math.max(0.001, eased));
      if (marker.ripple) {
        const ripple = Math.min(1, elapsed / RIPPLE_MS);
        marker.ripple.scale.setScalar(radius * (1 + ripple * 2.2));
        (marker.ripple.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ripple);
        marker.ripple.visible = ripple < 1;
      }
    }
  }

  /** The id of the frontmost marker under the ray, if any. */
  hit(raycaster: THREE.Raycaster): string | null {
    const discs = [...this.markers.values()].map((marker) => marker.disc);
    const hits = raycaster.intersectObjects(discs, false);
    // Symbols draw over each other by size, not by distance, so the one on top wins the click.
    const top = hits.reduce<THREE.Intersection | null>(
      (best, candidate) =>
        !best || candidate.object.renderOrder > best.object.renderOrder ? candidate : best,
      null,
    );
    const id: unknown = top?.object.userData['overlayId'];
    return typeof id === 'string' ? id : null;
  }

  labelOf(id: string): string | null {
    return this.markers.get(id)?.point.label ?? null;
  }

  /** Where a point sits in the world and its radius on screen, for anything anchored to it. */
  anchorOf(
    id: string,
  ): { readonly position: THREE.Vector3; readonly radiusPx: number; readonly selected: boolean } | null {
    const marker = this.markers.get(id);
    if (!marker) return null;
    return {
      position: marker.group.getWorldPosition(new THREE.Vector3()),
      radiusPx: this.radiusPx(marker) * (id === this.selectedId ? SELECTED_SCALE : 1),
      selected: id === this.selectedId,
    };
  }

  dispose(): void {
    for (const marker of this.markers.values()) this.disposeMarker(marker);
    this.markers.clear();
    this.discGeometry.dispose();
    this.rimGeometry.dispose();
    this.traceGeometry.dispose();
    this.haloGeometry.dispose();
    this.rippleGeometry.dispose();
    this.traceMaterial.dispose();
    for (const material of this.discMaterials.values()) material.dispose();
    for (const material of this.haloMaterials.values()) material.dispose();
  }

  private radiusPx(marker: Marker): number {
    return (RADIUS_BASE_PX + marker.point.size * RADIUS_PX_PER_SIZE) * this.symbolScale;
  }

  private worldRadius(marker: Marker, { camera, heightPx }: OverlayView): number {
    marker.group.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const worldPerPx = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / heightPx;
    return this.radiusPx(marker) * worldPerPx;
  }

  private discMaterial(color: string): THREE.MeshBasicMaterial {
    let material = this.discMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false });
      this.discMaterials.set(color, material);
    }
    return material;
  }

  private haloMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
    const key = `${color}/${String(opacity)}`;
    let material = this.haloMaterials.get(key);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.haloMaterials.set(key, material);
    }
    return material;
  }

  private createMarker(point: MapOverlayPoint, bornAt: number | null): Marker {
    const color = point.color ?? DEFAULT_COLOR;
    const group = new THREE.Group();
    group.position.copy(this.project(point.lon, point.lat, OVERLAY_ELEVATION));

    const disc = new THREE.Mesh(this.discGeometry, this.discMaterial(color));
    disc.userData['overlayId'] = point.id;

    const rimMaterial = new THREE.MeshBasicMaterial({
      color: RING,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const rim = new THREE.Mesh(this.rimGeometry, rimMaterial);
    const trace = new THREE.Mesh(this.traceGeometry, this.traceMaterial);

    const badge = new THREE.Group();
    badge.add(disc, rim, trace);
    badge.scale.setScalar(point.size);

    const halos = new THREE.Group();
    for (const halo of HALOS) {
      const ring = new THREE.Mesh(this.haloGeometry, this.haloMaterial(color, halo.opacity));
      ring.scale.setScalar(halo.radius);
      ring.renderOrder = 10;
      halos.add(ring);
    }
    halos.scale.setScalar(point.size);

    group.add(halos, badge);

    let ripple: THREE.Mesh | null = null;
    if (bornAt !== null) {
      ripple = new THREE.Mesh(
        this.rippleGeometry,
        new THREE.MeshBasicMaterial({
          color: RING_SELECTED,
          transparent: true,
          opacity: 0.6,
          depthTest: false,
          side: THREE.DoubleSide,
        }),
      );
      ripple.scale.setScalar(point.size);
      ripple.renderOrder = 10;
      group.add(ripple);
      group.scale.setScalar(0.001);
    }

    this.group.add(group);
    return { point, group, badge, halos, disc, rim, trace, rimMaterial, ripple, bornAt };
  }

  /** Each symbol draws whole, with the largest last, so overlapping ones stay readable. */
  private stackLargestOnTop(): void {
    const bySize = [...this.markers.values()].sort((a, b) => a.point.size - b.point.size);
    bySize.forEach((marker, index) => {
      const order = 11 + index * 0.01;
      marker.disc.renderOrder = order;
      marker.rim.renderOrder = order + 0.002;
      marker.trace.renderOrder = order + 0.004;
    });
  }

  private applySelection(): void {
    for (const [id, marker] of this.markers) {
      marker.rimMaterial.color.set(id === this.selectedId ? RING_SELECTED : RING);
    }
  }

  private disposeMarker(marker: Marker): void {
    this.group.remove(marker.group);
    marker.rimMaterial.dispose();
    if (marker.ripple) (marker.ripple.material as THREE.Material).dispose();
  }
}
