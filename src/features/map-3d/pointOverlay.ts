import * as THREE from 'three';

/** A clickable point drawn over the map, e.g. an earthquake epicentre. */
export interface MapOverlayPoint {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  /** Symbol radius in map units: a visual size only, never an area on the ground. */
  readonly size: number;
  /** Short text for the hover label; rendered as text by React, never as HTML. */
  readonly label: string;
  /** Arrived in the latest update: animated once, others never. */
  readonly isNew: boolean;
}

type Projector = (lon: number, lat: number, elevation: number) => THREE.Vector3;

/** Above the extruded land (0.28) and a selected region's lift (0.16). */
const OVERLAY_ELEVATION = 0.52;
const APPEAR_MS = 650;
const RIPPLE_MS = 1400;

const FILL = '#121826';
const RING = '#FBFAF6';
const RING_SELECTED = '#FF8A3D';

interface Marker {
  readonly point: MapOverlayPoint;
  readonly group: THREE.Group;
  readonly disc: THREE.Mesh;
  readonly ringMaterial: THREE.MeshBasicMaterial;
  readonly ripple: THREE.Mesh | null;
  readonly bornAt: number | null;
}

/**
 * Point layer that lives in its own group beside the regions. Updating it never touches the region
 * geometry, and only markers marked `isNew` animate (a short pop and one ripple), so nothing pulses
 * continuously. Shared geometries are created once and scaled per marker.
 */
export class PointOverlay {
  readonly group = new THREE.Group();
  private readonly discGeometry = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  private readonly ringGeometry = new THREE.RingGeometry(1, 1.28, 32).rotateX(-Math.PI / 2);
  private readonly discMaterial = new THREE.MeshBasicMaterial({
    color: FILL,
    transparent: true,
    opacity: 0.88,
  });
  private markers = new Map<string, Marker>();
  private selectedId: string | null = null;

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
      if (existing && existing.point.lon === point.lon && existing.point.lat === point.lat) {
        next.set(point.id, { ...existing, point });
        this.markers.delete(point.id);
        continue;
      }
      next.set(point.id, this.createMarker(point, animate && point.isNew ? now : null));
    }
    for (const stale of this.markers.values()) this.disposeMarker(stale);
    this.markers = next;
    this.applySelection();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.applySelection();
  }

  /** Advances the one-off appear animations; cheap when there are none. */
  tick(now: number): void {
    for (const marker of this.markers.values()) {
      if (marker.bornAt === null) continue;
      const elapsed = now - marker.bornAt;
      const appear = Math.min(1, elapsed / APPEAR_MS);
      const eased = 1 - Math.pow(1 - appear, 3);
      marker.group.scale.setScalar(Math.max(0.001, eased));
      if (marker.ripple) {
        const ripple = Math.min(1, elapsed / RIPPLE_MS);
        marker.ripple.scale.setScalar(marker.point.size * (1 + ripple * 2.2));
        (marker.ripple.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ripple);
        marker.ripple.visible = ripple < 1;
      }
    }
  }

  /** The id of the frontmost marker under the ray, if any. */
  hit(raycaster: THREE.Raycaster): string | null {
    const discs = [...this.markers.values()].map((marker) => marker.disc);
    const first = raycaster.intersectObjects(discs, false)[0];
    const id: unknown = first?.object.userData['overlayId'];
    return typeof id === 'string' ? id : null;
  }

  labelOf(id: string): string | null {
    return this.markers.get(id)?.point.label ?? null;
  }

  dispose(): void {
    for (const marker of this.markers.values()) this.disposeMarker(marker);
    this.markers.clear();
    this.discGeometry.dispose();
    this.ringGeometry.dispose();
    this.discMaterial.dispose();
  }

  private createMarker(point: MapOverlayPoint, bornAt: number | null): Marker {
    const group = new THREE.Group();
    group.position.copy(this.project(point.lon, point.lat, OVERLAY_ELEVATION));

    const disc = new THREE.Mesh(this.discGeometry, this.discMaterial);
    disc.scale.setScalar(point.size);
    disc.userData['overlayId'] = point.id;
    disc.renderOrder = 11;

    const ringMaterial = new THREE.MeshBasicMaterial({ color: RING, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
    ring.scale.setScalar(point.size);
    ring.renderOrder = 12;

    group.add(disc, ring);

    let ripple: THREE.Mesh | null = null;
    if (bornAt !== null) {
      ripple = new THREE.Mesh(
        this.ringGeometry,
        new THREE.MeshBasicMaterial({
          color: RING_SELECTED,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        }),
      );
      ripple.scale.setScalar(point.size);
      group.add(ripple);
      group.scale.setScalar(0.001);
    }

    this.group.add(group);
    return { point, group, disc, ringMaterial, ripple, bornAt };
  }

  private applySelection(): void {
    for (const [id, marker] of this.markers) {
      marker.ringMaterial.color.set(id === this.selectedId ? RING_SELECTED : RING);
    }
  }

  private disposeMarker(marker: Marker): void {
    this.group.remove(marker.group);
    marker.ringMaterial.dispose();
    if (marker.ripple) (marker.ripple.material as THREE.Material).dispose();
  }
}
