// Builds public/data/hex-indonesia.json: Indonesia's land as a pointy-top hexagon grid for the
// landing hero map.
//
// Land shape: src/features/map-3d/data/indonesia-coastline.json (Natural Earth 1:10m Admin 0,
// v5.1.2, simplified at 0.02°; see the README beside it). Nothing is downloaded.
// Usage:  npm run build:hex
//
// IMPORTANT: the per-cell `value` is SIMULATED. It comes from a seeded noise function, so the file
// is identical on every run, and it says nothing about any real region. The hero labels the map
// "data simulasi"; do not present these values as indicators.
//
// How the silhouette stays honest (a discrete grid is still an approximation):
//  1. COVERAGE, not centre-in-polygon: a hexagon is sampled at 19 points and kept when enough of
//     them fall on land, so thin islands survive and a strait narrower than a hexagon is not
//     bridged by cells that only touch the water.
//  2. ISLAND IDENTITY: every kept cell belongs to the island that holds most of its samples.
//  3. NO LAND BRIDGES: two touching cells that belong to different islands would read as one land
//     mass, so the weaker one is dropped (never an island's last cell). Real straits (Sunda, Bali,
//     Makassar, Nusa Tenggara, ...) therefore stay open even where the grid is coarser than the water.
//  4. SMALL ISLANDS: an island above MIN_ISLAND_KM2 that no cell reached gets exactly one cell,
//     chosen deterministically at the point on the island nearest the grid.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = resolve(root, 'src/features/map-3d/data/indonesia-coastline.json');
// Usage: node build-hex-indonesia.mjs [hexSizeDeg] [output file name in public/data]
const [sizeArgument = '0.4', outputName = 'hex-indonesia.json'] = process.argv.slice(2);
const OUTPUT = resolve(root, 'public/data', outputName);

const HEX_SIZE_DEG = Number(sizeArgument); // centre-to-vertex: 0.4 is about 44 km across (desktop), 0.7 the compact phone grid
const MIN_COVERAGE = 0.45; // share of the 19 probes that must be on land
// An island needs about a fifth of one hexagon's area to earn a cell; smaller ones would only be clutter.
const MIN_ISLAND_KM2 = Math.round(0.2 * 2.598 * HEX_SIZE_DEG ** 2 * 12300);
const NO_DATA_SHARE = 0.12;
const SEED = 20261021;
// Planar origin: x grows east, z grows south (towards the camera), both in degrees.
const ORIGIN_LON = 118;
const ORIGIN_LAT = -2.5;
const BOUNDS = { minLon: 94, maxLon: 142, minLat: -11.6, maxLat: 6.4 };

const coastline = JSON.parse(readFileSync(SOURCE, 'utf8'));
const islands = coastline.features[0].geometry.coordinates.map((rings, index) => {
  const polygon = turf.polygon(rings);
  const [minX, minY, maxX, maxY] = turf.bbox(polygon);
  return { index, polygon, minX, minY, maxX, maxY, areaKm2: turf.area(polygon) / 1e6 };
});

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

function lattice(ix, iy) {
  return mulberry32(SEED ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263))();
}
const smooth = (t) => t * t * (3 - 2 * t);
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

/** Index of the island containing the point, or -1 for water. */
function islandAt(lon, lat) {
  const point = turf.point([lon, lat]);
  for (const island of islands) {
    if (lon < island.minX || lon > island.maxX || lat < island.minY || lat > island.maxY) continue;
    if (turf.booleanPointInPolygon(point, island.polygon)) return island.index;
  }
  return -1;
}

// Pointy-top grid in axial form: columns sqrt(3)*s apart, odd rows shifted half a column.
const colWidth = Math.sqrt(3) * HEX_SIZE_DEG;
const rowHeight = 1.5 * HEX_SIZE_DEG;
const centreOf = (col, row) => ({ lon: (col + 0.5 * (row & 1)) * colWidth, lat: -row * rowHeight });
const keyOf = (col, row) => `${col}:${row}`;

// 19 probes: the centre, then rings at 0.45 and 0.9 of the radius (the outer ring in two phases).
const PROBES = [[0, 0]];
for (let k = 0; k < 6; k += 1) {
  const a = (Math.PI / 3) * k;
  PROBES.push([0.45 * HEX_SIZE_DEG * Math.sin(a), 0.45 * HEX_SIZE_DEG * Math.cos(a)]);
  PROBES.push([0.9 * HEX_SIZE_DEG * Math.sin(a), 0.9 * HEX_SIZE_DEG * Math.cos(a)]);
  const b = a + Math.PI / 6;
  PROBES.push([0.9 * HEX_SIZE_DEG * Math.sin(b), 0.9 * HEX_SIZE_DEG * Math.cos(b)]);
}

const grid = [];
const rowMin = Math.floor(-BOUNDS.maxLat / rowHeight);
const rowMax = Math.ceil(-BOUNDS.minLat / rowHeight);
const colMin = Math.floor(BOUNDS.minLon / colWidth) - 1;
const colMax = Math.ceil(BOUNDS.maxLon / colWidth) + 1;
for (let row = rowMin; row <= rowMax; row += 1) {
  for (let col = colMin; col <= colMax; col += 1) {
    const centre = centreOf(col, row);
    if (centre.lon >= BOUNDS.minLon && centre.lon <= BOUNDS.maxLon) grid.push({ col, row, ...centre });
  }
}

const cells = new Map();
for (const candidate of grid) {
  const tally = new Map();
  let land = 0;
  for (const [dx, dy] of PROBES) {
    const id = islandAt(candidate.lon + dx, candidate.lat + dy);
    if (id >= 0) {
      land += 1;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }
  const coverage = land / PROBES.length;
  if (coverage < MIN_COVERAGE) continue;
  const [island] = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  cells.set(keyOf(candidate.col, candidate.row), { ...candidate, island, coverage, islet: false });
}

// Small islands that no cell reached keep exactly one cell.
const reached = new Set([...cells.values()].map((cell) => cell.island));
for (const island of islands) {
  if (reached.has(island.index) || island.areaKm2 < MIN_ISLAND_KM2) continue;
  const [lon, lat] = turf.pointOnFeature(island.polygon).geometry.coordinates;
  let nearest = null;
  let best = Infinity;
  for (const candidate of grid) {
    const distance = Math.hypot(candidate.lon - lon, candidate.lat - lat);
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }
  if (!nearest || best > colWidth || cells.has(keyOf(nearest.col, nearest.row))) continue;
  cells.set(keyOf(nearest.col, nearest.row), { ...nearest, island: island.index, coverage: 0, islet: true });
}

// No land bridges: odd-r neighbours of a pointy-top grid.
function neighbours(col, row) {
  const shift = row & 1 ? 1 : 0;
  return [
    [col - 1, row],
    [col + 1, row],
    [col - 1 + shift, row - 1],
    [col + shift, row - 1],
    [col - 1 + shift, row + 1],
    [col + shift, row + 1],
  ];
}
const cellsOfIsland = () => {
  const counts = new Map();
  for (const cell of cells.values()) counts.set(cell.island, (counts.get(cell.island) ?? 0) + 1);
  return counts;
};

let removed = 0;
for (let pass = 0; pass < 6; pass += 1) {
  const counts = cellsOfIsland();
  const doomed = new Set();
  for (const cell of cells.values()) {
    for (const [col, row] of neighbours(cell.col, cell.row)) {
      const other = cells.get(keyOf(col, row));
      if (!other || other.island === cell.island) continue;
      const weaker =
        cell.coverage !== other.coverage
          ? cell.coverage < other.coverage
            ? cell
            : other
          : islands[cell.island].areaKm2 <= islands[other.island].areaKm2
            ? cell
            : other;
      // Never remove an island's last cell, and never remove from both sides in one pass.
      if (
        (counts.get(weaker.island) ?? 0) > 1 &&
        !doomed.has(keyOf(other.col, other.row)) &&
        !doomed.has(keyOf(cell.col, cell.row))
      ) {
        doomed.add(keyOf(weaker.col, weaker.row));
        counts.set(weaker.island, (counts.get(weaker.island) ?? 0) - 1);
      }
    }
  }
  if (doomed.size === 0) break;
  for (const key of doomed) cells.delete(key);
  removed += doomed.size;
}

// A one-cell island that still touches another island would read as a bump on it. Move it to the
// nearest free cell that touches nothing (within three cells of the island), or drop it.
const touchesOtherIsland = (col, row, island) =>
  neighbours(col, row).some(([c, r]) => {
    const other = cells.get(keyOf(c, r));
    return other && other.island !== island;
  });
let relocated = 0;
let dropped = 0;
const lonely = cellsOfIsland();
for (const cell of [...cells.values()]) {
  if (lonely.get(cell.island) !== 1 || !touchesOtherIsland(cell.col, cell.row, cell.island)) continue;
  cells.delete(keyOf(cell.col, cell.row));
  const [lon, lat] = turf.pointOnFeature(islands[cell.island].polygon).geometry.coordinates;
  const target = grid
    .filter((candidate) => !cells.has(keyOf(candidate.col, candidate.row)))
    .filter((candidate) => Math.hypot(candidate.lon - lon, candidate.lat - lat) <= 3 * colWidth)
    .filter((candidate) => !touchesOtherIsland(candidate.col, candidate.row, cell.island))
    .sort(
      (a, b) =>
        Math.hypot(a.lon - lon, a.lat - lat) - Math.hypot(b.lon - lon, b.lat - lat) ||
        a.row - b.row ||
        a.col - b.col,
    )[0];
  if (target) {
    cells.set(keyOf(target.col, target.row), { ...target, island: cell.island, coverage: 0, islet: true });
    relocated += 1;
  } else {
    dropped += 1;
  }
}

let bridges = 0;
for (const cell of cells.values()) {
  for (const [col, row] of neighbours(cell.col, cell.row)) {
    const other = cells.get(keyOf(col, row));
    if (other && other.island !== cell.island) bridges += 1;
  }
}

const noData = mulberry32(SEED + 1);
const ordered = [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
const rows = ordered.map((cell) => ({
  cell,
  hasData: noData() >= NO_DATA_SHARE,
}));
const ranked = rows
  .filter((entry) => entry.hasData)
  .map((entry) => ({ entry, raw: simulatedValue(entry.cell.lon, entry.cell.lat) }))
  .sort((a, b) => a.raw - b.raw);
const values = new Map();
ranked.forEach(({ entry }, index) => {
  // Spread the simulated values evenly over 0-1 (by rank) so every colour step appears.
  values.set(entry, round(ranked.length > 1 ? index / (ranked.length - 1) : 0.5, 2));
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
    columns: ['x', 'z', 'lon', 'lat', 'value'],
    cellCount: rows.length,
  },
  cells: rows.map((entry) => [
    round(entry.cell.lon - ORIGIN_LON, 3),
    round(-(entry.cell.lat - ORIGIN_LAT), 3),
    round(entry.cell.lon, 3),
    round(entry.cell.lat, 3),
    entry.hasData ? values.get(entry) : null,
  ]),
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`);
const islandCount = new Set(rows.map((entry) => entry.cell.island)).size;
console.log(
  [
    `${rows.length} cells, ${rows.filter((e) => e.hasData).length} with simulated data`,
    `${islandCount} of ${islands.length} islands represented`,
    `${rows.filter((e) => e.cell.islet).length} single-cell islands`,
    `${removed} cells dropped to keep straits open; ${relocated} one-cell islands moved off a neighbour, ${dropped} dropped`,
    `${bridges} cross-island contacts left`,
    `-> ${OUTPUT}`,
  ].join('\n'),
);

if (bridges > 0) {
  console.error(`Refusing to ship a grid that bridges islands (${bridges} cross-island contacts).`);
  process.exit(1);
}
