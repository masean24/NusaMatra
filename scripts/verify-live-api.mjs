// Independent check of the deployed Data Hub's LIVE mode. Read-only; it never changes anything.
// Usage:  node scripts/verify-live-api.mjs [baseUrl] [expectedSnapshotId]
// Exit code 0 only when every check passes, so it can gate trusting LIVE rankings in the frontend.
const base = (process.argv[2] ?? 'https://api.orangkeren.me').replace(/\/$/, '');
const expectedSnapshot = process.argv[3] ?? '2026.10.0-official-live';
const API = `${base}/api/v1`;
const ORIGIN = 'https://nusamatra.example';
const WEIGHTS = {
  soc_hdi: 3000,
  dis_multihazard_index: 3000,
  soc_poverty_rate: 2000,
  hlt_stunting_prevalence: 2000,
};
const TOLERANCE = 0.05;

const ENDPOINTS = [
  { path: '/snapshots?mode=live', data: 'array' },
  { path: '/datasets?mode=live', data: 'array' },
  { path: '/regions?mode=live&level=provinsi', data: 'array' },
  { path: '/regions?mode=live&level=kabupaten_kota', data: 'array' },
  { path: '/regions/1101?mode=live', data: 'object' },
  { path: '/indicators?mode=live', data: 'object' },
  { path: '/indicators/soc_hdi/values?mode=live', data: 'object' },
  { path: '/indicators/dis_multihazard_index/values?mode=live', data: 'object' },
  { path: '/indicators/hlt_stunting_prevalence/values?mode=live', data: 'object' },
  { path: '/boundaries/kabupaten?mode=live', data: 'object' },
];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`    FAIL  ${message}`);
};
const note = (message) => console.log(`    note  ${message}`);

async function probe({ path, data }) {
  const response = await fetch(API + path, { headers: { Origin: ORIGIN, 'X-Data-Mode': 'LIVE' } });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    // reported below
  }
  console.log(`${String(response.status)}  GET ${path}  (${(text.length / 1024).toFixed(0)} kB)`);
  const header = (name) => response.headers.get(name);
  if (response.status !== 200) {
    fail(`HTTP ${String(response.status)} (expected 200)${body?.code ? `, code ${body.code}` : ''}`);
  }
  if (header('x-data-fallback') !== 'NONE') {
    fail(`X-Data-Fallback is ${String(header('x-data-fallback'))} (expected NONE)`);
  }
  if (header('x-nusamatra-mode') !== 'LIVE') {
    fail(`X-NusaMatra-Mode is ${String(header('x-nusamatra-mode'))} (expected LIVE)`);
  }
  if (header('x-nusamatra-snapshot') !== expectedSnapshot) {
    fail(`X-NusaMatra-Snapshot is ${String(header('x-nusamatra-snapshot'))} (expected ${expectedSnapshot})`);
  }
  if (header('access-control-allow-origin') === null)
    fail('no Access-Control-Allow-Origin for a browser origin');
  if (!(header('access-control-expose-headers') ?? '').toLowerCase().includes('x-data-fallback')) {
    fail('X-Data-Fallback is not exposed to browsers (Access-Control-Expose-Headers)');
  }
  if (body?.status === 'success') {
    if (body.meta?.mode !== 'LIVE') fail(`envelope mode is ${String(body.meta?.mode)} (expected LIVE)`);
    if (body.meta?.snapshot_id !== expectedSnapshot)
      fail(`envelope snapshot is ${String(body.meta?.snapshot_id)}`);
    const shape = Array.isArray(body.data) ? 'array' : typeof body.data;
    if (shape !== data) fail(`data is ${shape} (expected ${data})`);
    if (Array.isArray(body.data) && body.data.length === 0) fail('data is empty');
  } else {
    fail('not a success envelope');
  }
  return body;
}

const bodies = {};
for (const endpoint of ENDPOINTS) bodies[endpoint.path] = await probe(endpoint);

// Region registry, boundaries and area.
const registry = bodies['/regions?mode=live&level=kabupaten_kota']?.data ?? [];
const features = bodies['/boundaries/kabupaten?mode=live']?.data?.features ?? [];
const registryIds = new Set(registry.map((region) => region.region_id));
const boundaryIds = new Set(features.map((feature) => feature.properties.region_id));
const unmatched =
  [...registryIds].filter((id) => !boundaryIds.has(id)).length +
  [...boundaryIds].filter((id) => !registryIds.has(id)).length;
if (unmatched > 0) fail(`${String(unmatched)} region ids differ between the registry and the BIG boundaries`);
else
  note(`registry ${String(registryIds.size)} and boundaries ${String(boundaryIds.size)} share the same ids`);
const polygons = features.filter((feature) =>
  ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type),
).length;
if (polygons !== features.length) fail(`${String(features.length - polygons)} boundaries are not polygons`);
const zeroArea = registry.filter((region) => !(region.area_km2 > 0)).length;
if (zeroArea > 0)
  fail(`${String(zeroArea)} of ${String(registry.length)} regions have area_km2 = 0 or missing`);

// The catalog should not advertise indicators that have no values.
const catalog = Object.values(bodies['/indicators?mode=live']?.data ?? {}).flat();
let empty = 0;
for (const { indicator_id: id } of catalog) {
  const response = await fetch(`${API}/indicators/${id}/values?mode=live`, {
    headers: { Origin: ORIGIN, 'X-Data-Mode': 'LIVE' },
  });
  const values = (await response.json()).data?.values_by_region ?? {};
  if (Object.keys(values).length === 0) empty += 1;
}
if (empty > 0) fail(`${String(empty)} of ${String(catalog.length)} cataloged indicators have no values`);

// The composite: must cover the whole registry and be reproducible from its own parts.
const compositeResponse = await fetch(`${API}/indicators/composite-query?mode=live`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
  body: JSON.stringify({ weights: WEIGHTS }),
});
console.log(`${String(compositeResponse.status)}  POST /indicators/composite-query?mode=live`);
const composite = await compositeResponse.json().catch(() => null);
if (compositeResponse.status !== 200 || composite?.status !== 'success') {
  fail(`composite not available (HTTP ${String(compositeResponse.status)})`);
} else {
  const { weights_basis_points: weights, regions, total_regions: reported } = composite.data;
  const ids = Object.keys(weights);
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum !== 10000) fail(`weights add up to ${String(sum)} basis points`);
  if (reported !== regions.length)
    fail(`total_regions ${String(reported)} but ${String(regions.length)} rows`);
  if (registryIds.size > 0 && regions.length !== registryIds.size) {
    fail(`composite covers ${String(regions.length)} of ${String(registryIds.size)} registry regions`);
  }
  let worst = 0;
  let mismatches = 0;
  let incomplete = 0;
  let zeroFilled = 0;
  for (const row of regions) {
    const weighted = ids.reduce(
      (acc, id) => acc + ((row.component_scores[id] ?? 0) * weights[id]) / 10000,
      0,
    );
    const complete = ids.every((id) => typeof row.component_scores[id] === 'number');
    const error = Math.abs(weighted - row.composite_score);
    if (complete) {
      worst = Math.max(worst, error);
      if (error > TOLERANCE) mismatches += 1;
    } else {
      incomplete += 1;
      if (error <= TOLERANCE) zeroFilled += 1;
    }
  }
  let rankViolations = 0;
  regions.forEach((row, index) => {
    const previous = regions[index - 1];
    if (row.rank !== index + 1 || (previous && row.composite_score > previous.composite_score)) {
      rankViolations += 1;
    }
  });
  if (mismatches > 0) {
    fail(
      `${String(mismatches)} scores differ from the weighted sum of their components (up to ${worst.toFixed(2)})`,
    );
  }
  if (rankViolations > 0) fail(`${String(rankViolations)} rows break the rank order`);
  if (incomplete > 0) {
    fail(
      `${String(incomplete)} regions are scored with a component missing; ${String(zeroFilled)} of them only reproduce when "no data" counts as 0`,
    );
  }
  note(`regions ${String(regions.length)}, largest score error on complete rows ${worst.toFixed(3)}`);
}

console.log(
  failures === 0 ? '\nALL CHECKS PASSED' : `\n${String(failures)} CHECK(S) FAILED: keep LIVE rankings gated`,
);
process.exit(failures === 0 ? 0 : 1);
