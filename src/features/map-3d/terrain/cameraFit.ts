import * as THREE from 'three';

export interface CameraPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

export interface FitOptions {
  /** Camera elevation above the horizon, degrees (90 = straight down). */
  readonly elevationDeg: number;
  /** Fraction of NDC kept free on every side, so parallax and the intro never clip land. */
  readonly margin: number;
}

/**
 * Closest camera pose, looking north from the south at `elevationDeg` towards the centre of
 * `points`, that keeps every point inside the viewport minus `margin`. Fitting the land's own
 * outline instead of its bounding box keeps the empty ocean corners from shrinking the map.
 * Bisects the distance, because perspective makes the visible extent nonlinear in it. Leaves
 * `camera` at the returned pose.
 */
export function fitCameraToPoints(
  camera: THREE.PerspectiveCamera,
  points: readonly THREE.Vector3[],
  options: FitOptions,
): CameraPose {
  const target = new THREE.Box3().setFromPoints([...points]).getCenter(new THREE.Vector3());
  const elevation = THREE.MathUtils.degToRad(options.elevationDeg);
  const direction = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const limit = 1 - options.margin;
  const probe = new THREE.Vector3();

  const fits = (distance: number): boolean => {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    return points.every((point) => {
      probe.copy(point).project(camera);
      return Math.abs(probe.x) <= limit && Math.abs(probe.y) <= limit && probe.z < 1;
    });
  };

  camera.updateProjectionMatrix();
  let near = 0.5;
  let far = 400;
  for (let i = 0; i < 32; i++) {
    const mid = (near + far) / 2;
    if (fits(mid)) far = mid;
    else near = mid;
  }
  fits(far);
  return { position: camera.position.clone(), target };
}
