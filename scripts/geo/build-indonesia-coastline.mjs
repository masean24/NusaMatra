// Builds src/features/map-3d/data/indonesia-coastline.json from Natural Earth.
//
// Source: Natural Earth 1:10m Admin 0 – Countries, v5.1.2 (public domain).
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson
// Usage:  node scripts/geo/build-indonesia-coastline.mjs <path-to-ne_10m_admin_0_countries.geojson>
//
// Steps: take the IDN feature, simplify every ring (Douglas–Peucker), drop islands below a
// minimum area, round to 3 decimals (~110 m). The output is a coastline basemap for the
// landing hero illustration — not an administrative boundary dataset.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_VERSION = 'v5.1.2';
const TOLERANCE_DEG = 0.02; // ~2.2 km: below one pixel at hero size
const MIN_ISLAND_AREA_DEG2 = 0.0015; // ~18 km²: keeps Nusa Penida, drops reef specks
const DECIMALS = 3;

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/geo/build-indonesia-coastline.mjs <ne_10m_admin_0_countries.geojson>');
  process.exit(1);
}

const source = JSON.parse(readFileSync(input, 'utf8'));
const idn = source.features.find((f) => f.properties.ADM0_A3 === 'IDN');
if (!idn) throw new Error('IDN feature not found in the source file');

const polygons = idn.geometry.type === 'Polygon' ? [idn.geometry.coordinates] : idn.geometry.coordinates;

function perpendicularDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2; // positive = counter-clockwise (GeoJSON RFC 7946 outer ring)
}

const factor = 10 ** DECIMALS;
const round = ([lon, lat]) => [Math.round(lon * factor) / factor, Math.round(lat * factor) / factor];

function cleanRing(ring, wantCounterClockwise) {
  const open = ring.slice(0, -1);
  const simplified = simplify(open, TOLERANCE_DEG).map(round);
  const deduped = simplified.filter(
    (p, i) => i === 0 || p[0] !== simplified[i - 1][0] || p[1] !== simplified[i - 1][1],
  );
  if (deduped.length < 3) return null;
  deduped.push([...deduped[0]]);
  const isCounterClockwise = ringArea(deduped) > 0;
  return isCounterClockwise === wantCounterClockwise ? deduped : deduped.reverse();
}

let inputVertices = 0;
let droppedIslands = 0;
const output = [];
for (const polygon of polygons) {
  inputVertices += polygon.reduce((n, r) => n + r.length, 0);
  if (Math.abs(ringArea(polygon[0])) < MIN_ISLAND_AREA_DEG2) {
    droppedIslands++;
    continue;
  }
  const outer = cleanRing(polygon[0], true);
  if (!outer) {
    droppedIslands++;
    continue;
  }
  const holes = polygon
    .slice(1)
    .filter((h) => Math.abs(ringArea(h)) >= MIN_ISLAND_AREA_DEG2)
    .map((h) => cleanRing(h, false))
    .filter(Boolean);
  output.push([outer, ...holes]);
}
// Largest islands first: renderers can cap the count on weak devices.
output.sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])));

const outputVertices = output.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
const dataset = {
  type: 'FeatureCollection',
  metadata: {
    datasetId: 'natural-earth-10m-idn-coastline',
    version: `ne-${SOURCE_VERSION}-dp${TOLERANCE_DEG}-a${MIN_ISLAND_AREA_DEG2}`,
    source: `Natural Earth 1:10m Cultural Vectors, Admin 0 – Countries, ${SOURCE_VERSION} (feature ADM0_A3=IDN)`,
    sourceUrl: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
    license: 'Public domain (Natural Earth terms of use)',
    processing: `Douglas–Peucker ${TOLERANCE_DEG}°, islands < ${MIN_ISLAND_AREA_DEG2} deg² removed, coordinates rounded to ${DECIMALS} decimals`,
    purpose: 'Coastline basemap for the landing hero illustration. Not an administrative boundary dataset.',
    polygonCount: output.length,
    vertexCount: outputVertices,
  },
  features: [
    {
      type: 'Feature',
      properties: { name: 'Indonesia' },
      geometry: { type: 'MultiPolygon', coordinates: output },
    },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../src/features/map-3d/data/indonesia-coastline.json');
writeFileSync(target, JSON.stringify(dataset) + '\n');
console.log(
  `polygons: ${polygons.length} in, ${output.length} kept, ${droppedIslands} dropped; vertices: ${inputVertices} -> ${outputVertices}; wrote ${target}`,
);
