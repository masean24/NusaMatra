import * as THREE from 'three';

/** Below this height (px) the frame is too small to aim at: the view stays centred as usual. */
const MIN_FRAME_HEIGHT_PX = 80;

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

/**
 * Where the middle of the visible part of the map falls on the canvas, in normalized device coordinates
 * (-1 to 1, up is positive). `null` when there is no usable frame, so the caller keeps the plain centre.
 */
export function frameCentreNdc(canvas: Box, frame: Box | null): THREE.Vector2 | null {
  if (!frame || canvas.width <= 0 || canvas.height <= 0 || frame.height < MIN_FRAME_HEIGHT_PX) return null;
  const x = frame.left + frame.width / 2 - canvas.left;
  const y = frame.top + frame.height / 2 - canvas.top;
  return new THREE.Vector2((x / canvas.width) * 2 - 1, 1 - (y / canvas.height) * 2);
}

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * The point the camera must aim at so that `place`, on the ground, appears at `ndc` on screen rather than
 * in the middle. The camera moves as a whole, keeping its angle and distance: `offset` is the camera's
 * position relative to what it aims at. Returns `place` when that ray never meets the ground.
 */
export function aimForScreenPoint(
  camera: THREE.PerspectiveCamera,
  place: THREE.Vector3,
  offset: THREE.Vector3,
  ndc: THREE.Vector2,
): THREE.Vector3 {
  const pose = camera.clone();
  pose.position.copy(place).add(offset);
  pose.lookAt(place);
  pose.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, pose);
  const seen = raycaster.ray.intersectPlane(GROUND, new THREE.Vector3());
  // In that pose the ray meets the ground at `seen`; aiming as far the other way brings `place` onto it.
  return seen ? place.clone().add(place.clone().sub(seen)) : place.clone();
}
