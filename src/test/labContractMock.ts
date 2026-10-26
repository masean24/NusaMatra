/**
 * A MOCK of the Data Hub's Lab Prioritas contract v2.1 for unit and browser tests. It is NOT the
 * production API and is never evidence of it: production proof lives in the unmodified captures under
 * src/services/api/__fixtures__/live-v2.1 (taken 2026-10-23) and in the read-only probes recorded in
 * docs/integration.
 *
 * What is real here: the component scores (min-max "higher = higher need" scores of the captured national
 * composites, merged per region), the preset payload, the coverage matrix and the indicator values.
 * What is simulated: the composite calculation, following the rules observed in production responses:
 * - weights of indicators with no national data are redistributed over the others (`effective_weights`);
 * - each region keeps the indicators it has; its own weights (`effective_weights_region`) are the global
 *   effective weights rescaled to 10 000 bps (largest remainder);
 * - `coverage_pct` is the share of the global effective weight the region has data for (one decimal);
 * - below 70 % coverage or with fewer than 2 components the region goes to `insufficient_data`, unranked;
 * - `rank` is competition ranking within the returned list (1, 1, 3), `national_rank` the same over all
 *   eligible regions; score = Σ component × region weight, rounded to 2 decimals.
 * `simulation fidelity` is itself tested against the captured Jateng and Sumut responses.
 *
 * Pure: callers pass the parsed fixture JSON, so this runs in Vitest and in Playwright's Node.
 */

export const LIVE_SNAPSHOT = '2026.10.0-official-live';
const TOTAL = 10_000;
const MIN_COVERAGE_PCT = 70;
const MIN_COMPONENTS = 2;

export interface CapturedRegion {
  readonly region_id: string;
  readonly region_name: string;
  readonly component_scores: Readonly<Record<string, number | null>>;
}
export interface CapturedComposite {
  readonly data: {
    readonly regions: readonly CapturedRegion[];
    readonly insufficient_data?: readonly CapturedRegion[];
  };
}
interface CatalogItem {
  readonly indicator_id: string;
  readonly indicator_name: string;
  readonly category: string;
}
export interface CapturedCatalog {
  readonly data: Readonly<Record<string, readonly CatalogItem[]>>;
}
export interface CompositeBody {
  readonly weights: Readonly<Record<string, number>>;
  readonly filter_province_id?: string | null;
}
/** A recorded request/response pair that the mock returns untouched for that exact request. */
export interface Replay {
  readonly body: CompositeBody;
  readonly response: unknown;
}

const envelope = (data: unknown, totalCount: number | null = null) => ({
  status: 'success',
  meta: { snapshot_id: LIVE_SNAPSHOT, mode: 'LIVE', boundary_version: null, total_count: totalCount },
  data,
});

/** Component scores of several captured composites merged per region; a region keeps `null` where no capture has a value. */
export function buildPool(captures: readonly CapturedComposite[]): CapturedRegion[] {
  const byRegion = new Map<string, { name: string; scores: Record<string, number | null> }>();
  for (const capture of captures) {
    for (const row of [...capture.data.regions, ...(capture.data.insufficient_data ?? [])]) {
      const entry = byRegion.get(row.region_id) ?? { name: row.region_name, scores: {} };
      for (const [id, score] of Object.entries(row.component_scores)) {
        if (score !== null || !(id in entry.scores)) entry.scores[id] = score ?? entry.scores[id] ?? null;
      }
      byRegion.set(row.region_id, entry);
    }
  }
  return [...byRegion.entries()]
    .map(([region_id, entry]) => ({ region_id, region_name: entry.name, component_scores: entry.scores }))
    .sort((a, b) => a.region_id.localeCompare(b.region_id));
}

/** Indicators with at least one value in the pool, with how many regions have one. */
function poolCounts(pool: readonly CapturedRegion[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const region of pool) {
    for (const [id, score] of Object.entries(region.component_scores)) {
      if (typeof score === 'number') counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Integer shares of `TOTAL` proportional to `weights` (largest remainder, ties to the first). */
function proportional(weights: Readonly<Record<string, number>>): Record<string, number> {
  const ids = Object.keys(weights);
  const sum = ids.reduce((total, id) => total + (weights[id] ?? 0), 0);
  const shares = ids.map((id, index) => {
    const exact = ((weights[id] ?? 0) * TOTAL) / sum;
    return { id, index, whole: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let leftover = TOTAL - shares.reduce((total, share) => total + share.whole, 0);
  for (const share of [...shares].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
    if (leftover <= 0) break;
    share.whole += 1;
    leftover -= 1;
  }
  return Object.fromEntries(shares.map((share) => [share.id, share.whole]));
}

interface Scored {
  readonly region: CapturedRegion;
  readonly used: readonly string[];
  readonly coverage: number;
  readonly weights: Record<string, number>;
  readonly score: number;
}

/** Competition ranks (1, 1, 3) for rows already sorted by score. */
function competitionRanks(rows: readonly { score: number }[]): number[] {
  const ranks: number[] = [];
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    ranks.push(previous && previous.score === row.score ? (ranks[index - 1] ?? index + 1) : index + 1);
  });
  return ranks;
}

/** `POST /indicators/composite-query?mode=live` for the given request body (v2.1 shape). */
export function compositeResponse(
  pool: readonly CapturedRegion[],
  body: CompositeBody,
  replays: readonly Replay[] = [],
) {
  const province = body.filter_province_id ?? null;
  const replay = replays.find(
    (candidate) =>
      (candidate.body.filter_province_id ?? null) === province &&
      JSON.stringify(Object.entries(candidate.body.weights).sort()) ===
        JSON.stringify(Object.entries(body.weights).sort()),
  );
  if (replay) return replay.response;

  const counts = poolCounts(pool);
  const requested = Object.fromEntries(Object.entries(body.weights).filter(([, bps]) => bps > 0));
  const requestedIds = Object.keys(requested);
  const unavailable = requestedIds.filter((id) => !counts.has(id));
  const effective = proportional(
    Object.fromEntries(Object.entries(requested).filter(([id]) => counts.has(id))),
  );
  const effectiveIds = Object.keys(effective);

  const scored: Scored[] = [];
  const insufficient: { region: CapturedRegion; used: string[]; coverage: number }[] = [];
  for (const region of pool) {
    const used = effectiveIds.filter((id) => typeof region.component_scores[id] === 'number').sort();
    const usedBps = used.reduce((sum, id) => sum + (effective[id] ?? 0), 0);
    const coverage = Math.round(usedBps / 10) / 10;
    if (coverage < MIN_COVERAGE_PCT || used.length < MIN_COMPONENTS) {
      insufficient.push({ region, used, coverage });
      continue;
    }
    const weights = proportional(Object.fromEntries(used.map((id) => [id, effective[id] ?? 0])));
    const score = used.reduce(
      (sum, id) => sum + ((region.component_scores[id] ?? 0) * (weights[id] ?? 0)) / TOTAL,
      0,
    );
    scored.push({ region, used, coverage, weights, score: Math.round(score * 100) / 100 });
  }
  const order = (a: Scored, b: Scored) =>
    b.score - a.score || a.region.region_id.localeCompare(b.region.region_id);
  scored.sort(order);
  const nationalRanks = new Map(
    competitionRanks(scored).map((rank, index) => [scored[index]?.region.region_id ?? '', rank]),
  );
  const inScope = (id: string) => province === null || id.startsWith(province);
  const listed = scored.filter((entry) => inScope(entry.region.region_id));
  const ranks = competitionRanks(listed);
  const excluded = insufficient.filter((entry) => inScope(entry.region.region_id));

  const scoresOf = (region: CapturedRegion) =>
    Object.fromEntries(requestedIds.map((id) => [id, region.component_scores[id] ?? null]));
  return envelope(
    {
      total_regions: listed.length,
      total_eligible_national: scored.length,
      total_excluded: excluded.length,
      score_direction: 'higher_is_need',
      min_coverage_pct: MIN_COVERAGE_PCT,
      min_components: MIN_COMPONENTS,
      weights_basis_points: requested,
      unavailable_indicators: unavailable,
      effective_weights: effective,
      renormalized: unavailable.length > 0,
      regions: listed.map((entry, index) => ({
        region_id: entry.region.region_id,
        region_name: entry.region.region_name,
        composite_score: entry.score,
        rank: ranks[index],
        national_rank: nationalRanks.get(entry.region.region_id) ?? null,
        coverage_pct: entry.coverage,
        components_used: entry.used,
        missing_indicators: requestedIds.filter((id) => !entry.used.includes(id)),
        effective_weights_region: entry.weights,
        component_scores: scoresOf(entry.region),
        quality_flags: Object.fromEntries(entry.used.map((id) => [id, 'VERIFIED'])),
      })),
      insufficient_data: excluded.map((entry) => ({
        region_id: entry.region.region_id,
        region_name: entry.region.region_name,
        coverage_pct: entry.coverage,
        components_used: entry.used,
        missing_indicators: requestedIds.filter((id) => !entry.used.includes(id)),
        component_scores: scoresOf(entry.region),
        reason: 'COVERAGE_BELOW_THRESHOLD',
      })),
    },
    listed.length,
  );
}

/**
 * `GET /indicators/composite-presets?mode=live`: the captured production payload, plus a deliberately
 * invalid scenario (SYNTHETIC: weights that do not add up to 100 %) that the adapter must drop and count.
 */
export function presetsResponse(captured: { readonly data: readonly unknown[] }) {
  return envelope(
    [...captured.data, { preset_id: 'rusak', title: 'Preset tidak lengkap', weights: { soc_hdi: 6000 } }],
    captured.data.length + 1,
  );
}

/**
 * `GET /indicators/{id}/values?mode=live`. Indicators with a captured response return it as is (real raw
 * values). For the others only the published need score is known, so `raw` is null: the direction check
 * then reports them as not verifiable.
 */
export function valuesResponse(
  indicatorId: string,
  catalog: CapturedCatalog,
  pool: readonly CapturedRegion[],
  captured: Readonly<Record<string, unknown>>,
) {
  const real = captured[indicatorId];
  if (real) return real;
  const indicator = Object.values(catalog.data)
    .flat()
    .find((item) => item.indicator_id === indicatorId);
  if (!indicator) return null;
  const values = Object.fromEntries(
    pool
      .filter((region) => typeof region.component_scores[indicatorId] === 'number')
      .map((region) => [
        region.region_id,
        { raw: null, norm: region.component_scores[indicatorId], pct: null, rank: null, flag: 'VERIFIED' },
      ]),
  );
  return envelope({ indicator, values_by_region: values }, Object.keys(values).length);
}
