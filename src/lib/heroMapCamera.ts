/**
 * The hero map's camera as plain numbers, so the 3D canvas and the pins, lines and latitude labels
 * drawn over it in the page agree on where a place is, without the page importing three.js.
 */
/** The hero zone is 720 × 660 on the 1440 Figma frame and keeps this ratio at every width. */
export const HERO_FRAME_ASPECT = 720 / 660;

/** Vertical field of view in degrees. */
export const HERO_FOV = 26;
/** Shifted a little east and south of the origin so the archipelago leaves room for the latitude labels on the right. */
export const HERO_TARGET = [1.2, 0, -2.4] as const;
/** Looking from the front and above (about 58° of elevation), like the previous relief map. */
const ELEVATION = (58 * Math.PI) / 180;
const DISTANCE = 102;
export const HERO_CAMERA_POSITION = [
  HERO_TARGET[0],
  HERO_TARGET[1] + DISTANCE * Math.sin(ELEVATION),
  HERO_TARGET[2] + DISTANCE * Math.cos(ELEVATION),
] as const;

type Vec3 = readonly [number, number, number];

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalise(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / length, a[1] / length, a[2] / length];
}

const FORWARD = normalise(subtract(HERO_TARGET, HERO_CAMERA_POSITION));
const RIGHT = normalise(cross(FORWARD, [0, 1, 0]));
const UP = cross(RIGHT, FORWARD);
const TAN_HALF_FOV = Math.tan((HERO_FOV * Math.PI) / 360);

/**
 * Where a world point lands in the hero zone: `u` from the left edge and `v` from the top edge,
 * both 0–1. Same maths as a perspective camera that looks at `HERO_TARGET`.
 */
export function projectToHeroFrame(
  point: Vec3,
  aspect: number = HERO_FRAME_ASPECT,
): { readonly u: number; readonly v: number } {
  const relative = subtract(point, HERO_CAMERA_POSITION);
  const depth = dot(relative, FORWARD);
  const ndcX = dot(relative, RIGHT) / (depth * TAN_HALF_FOV * aspect);
  const ndcY = dot(relative, UP) / (depth * TAN_HALF_FOV);
  return { u: (ndcX + 1) / 2, v: (1 - ndcY) / 2 };
}

/** Planar position (degrees from the dataset origin) of a longitude/latitude. */
export function lonLatToPlane(
  lon: number,
  lat: number,
  origin: { readonly lon: number; readonly lat: number },
): { readonly x: number; readonly z: number } {
  return { x: lon - origin.lon, z: -(lat - origin.lat) };
}

/** Where the dataset's origin sits (matches `ORIGIN_*` in scripts/geo/build-hex-indonesia.mjs). */
export const HERO_ORIGIN = { lon: 118, lat: -2.5 } as const;
