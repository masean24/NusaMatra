// Builds public/data/hex-indonesia.json: Indonesia's land as a pointy-top hexagon grid for the
// landing hero map.
//
// Source of the land shape: src/features/map-3d/data/indonesia-coastline.json (Natural Earth 1:10m
// Admin 0, v5.1.2, simplified; see the README beside it). Nothing is downloaded.
// Usage:  npm run build:hex
//
// IMPORTANT: the per-cell `value` is SIMULATED. It comes from a seeded noise function, so the file
// is identical on every run, and it says nothing about any real region. The hero labels the map
// "data simulasi"; do not present these values as indicators.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = resolve(root, 'src/features/map-3d/data/indonesia-coastline.json');
const OUTPUT = resolve(root, 'public/data/hex-indonesia.json');

const HEX_SIZE_DEG = 0.8; // centre-to-vertex; sets how many cells the archipelago gets
const SAMPLE_RADIUS = 0.65; // a cell counts as land when enough of these probes fall on land
const MIN_LAND_PROBES = 3; // of 7 (centre + 6 around it)
const NO_DATA_SHARE = 0.14;
const SEED = 20261021;
// Planar origin: x grows east, z grows south (towards the camera), both in degrees.
const ORIGIN_LON = 118;
const ORIGIN_LAT = -2.5;
const BOUNDS = { minLon: 94, maxLon: 142, minLat: -11.5, maxLat: 6.5 };

const coastline = JSON.parse(readFileSync(SOURCE, 'utf8'));
const land = coastline.features[0];
const polygons = land.geometry.coordinates.map((rings) => turf.polygon(rings));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash in [0, 1) for an integer lattice point. */
function lattice(ix, iy) {
  return mulberry32(SEED ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263))();
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over a lattice of `cell` degrees. */
function valueNoise(lon, lat, cell) {
  const gx = lon / cell;
  const gy = lat / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const top = lattice(x0, y0) * (1 - tx) + lattice(x0 + 1, y0) * tx;
  const bottom = lattice(x0, y0 + 1) * (1 - tx) + lattice(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function simulatedValue(lon, lat) {
  const broad = valueNoise(lon, lat, 9);
  const fine = valueNoise(lon + 31, lat - 17, 2.6);
  return Math.min(1, Math.max(0, 0.15 + broad * 0.6 + fine * 0.4));
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

// Pointy-top grid: columns are sqrt(3)*s apart, odd rows shift half a column, rows are 1.5*s apart.
const colWidth = Math.sqrt(3) * HEX_SIZE_DEG;
const rowHeight = 1.5 * HEX_SIZE_DEG;
function gridCentre(col, row) {
  return { lon: (col + 0.5 * (row & 1)) * colWidth, lat: -row * rowHeight };
}

const candidates = [];
const rowMin = Math.floor(-BOUNDS.maxLat / rowHeight);
const rowMax = Math.ceil(-BOUNDS.minLat / rowHeight);
const colMin = Math.floor(BOUNDS.minLon / colWidth) - 1;
const colMax = Math.ceil(BOUNDS.maxLon / colWidth) + 1;
for (let row = rowMin; row <= rowMax; row += 1) {
  for (let col = colMin; col <= colMax; col += 1) {
    const centre = gridCentre(col, row);
    if (centre.lon < BOUNDS.minLon || centre.lon > BOUNDS.maxLon) continue;
    candidates.push({ col, row, ...centre });
  }
}

function onLand(lon, lat) {
  const point = turf.point([lon, lat]);
  return polygons.some((polygon) => turf.booleanPointInPolygon(point, polygon));
}

const included = new Map();
const key = (cell) => `${cell.col}:${cell.row}`;

for (const cell of candidates) {
  let hits = onLand(cell.lon, cell.lat) ? 1 : 0;
  for (let k = 0; k < 6; k += 1) {
    const angle = (Math.PI / 180) * (60 * k - 30);
    const lon = cell.lon + SAMPLE_RADIUS * HEX_SIZE_DEG * Math.cos(angle);
    const lat = cell.lat + SAMPLE_RADIUS * HEX_SIZE_DEG * Math.sin(angle);
    if (onLand(lon, lat)) hits += 1;
  }
  if (hits >= MIN_LAND_PROBES) included.set(key(cell), { ...cell, islet: false });
}

// Every island keeps at least one cell: an island none of the cells reached gets the cell nearest
// to a point guaranteed to be on it.
for (const polygon of polygons) {
  const [lon, lat] = turf.pointOnFeature(polygon).geometry.coordinates;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const cell of candidates) {
    const distance = Math.hypot(cell.lon - lon, cell.lat - lat);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  if (!nearest || nearestDistance > colWidth) continue;
  const covered = [...included.values()].some(
    (cell) => Math.hypot(cell.lon - lon, cell.lat - lat) <= HEX_SIZE_DEG * 1.05,
  );
  if (!covered && !included.has(key(nearest))) included.set(key(nearest), { ...nearest, islet: true });
}

const noDataRandom = mulberry32(SEED + 1);
const cells = [...included.values()]
  .sort((a, b) => a.row - b.row || a.col - b.col)
  .map((cell) => {
    const hasData = noDataRandom() >= NO_DATA_SHARE;
    return {
      id: `r${cell.row}c${cell.col}`,
      x: round(cell.lon - ORIGIN_LON, 3),
      z: round(-(cell.lat - ORIGIN_LAT), 3),
      lon: round(cell.lon, 3),
      lat: round(cell.lat, 3),
      value: hasData ? simulatedValue(cell.lon, cell.lat) : null,
      hasData,
      islet: cell.islet,
    };
  });

// Spread the simulated values evenly over 0–1 (by rank) so every colour step appears on the map.
const ranked = cells.filter((cell) => cell.hasData).sort((a, b) => a.value - b.value);
ranked.forEach((cell, index) => {
  cell.value = round(ranked.length > 1 ? index / (ranked.length - 1) : 0.5, 2);
});

const output = {
  metadata: {
    datasetId: 'nusa-matra-hero-hex-indonesia',
    kind: 'DEMO_SIMULATION',
    notice:
      'Nilai per sel adalah SIMULASI (noise berbenih), bukan indikator nyata. Bentuk daratan hanya ilustrasi, bukan batas wilayah.',
    landSource: coastline.metadata.source,
    landVersion: coastline.metadata.version,
    generator: 'scripts/geo/build-hex-indonesia.mjs',
    seed: SEED,
    hexSizeDeg: HEX_SIZE_DEG,
    projection: 'equirectangular, degrees from the origin; x east, z south',
    origin: { lon: ORIGIN_LON, lat: ORIGIN_LAT },
    cellCount: cells.length,
  },
  cells,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`);
const withData = cells.filter((cell) => cell.hasData).length;
console.log(
  `${cells.length} cells (${withData} with simulated data, ${cells.filter((c) => c.islet).length} island cells) -> ${OUTPUT}`,
);
