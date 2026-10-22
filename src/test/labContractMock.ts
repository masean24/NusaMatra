/**
 * A stand-in for the Data Hub's Lab Prioritas contract (Production Integration Guide v2), built from
 * the LIVE responses captured on 2026-10-21/22. Used by unit and browser tests while the production
 * API cannot be reached from the test environment; nothing here is a captured v2 response.
 *
 * The composite follows the guide: weights of indicators without LIVE data are redistributed over
 * the others in proportion (`renormalized`, `unavailable_indicators`, `effective_weights`), and the
 * score is Σ component × effective weight. Regions without a value for an effective indicator are
 * left out of the ranking (an explicit complete-case rule), never scored with that value as 0.
 * Component scores are the real v1 values for the four indicators the capture holds.
 *
 * Pure: callers pass the parsed fixture JSON, so this runs in Vitest and in Playwright's Node.
 */

export const LIVE_SNAPSHOT = '2026.10.0-official-live';
const TOTAL = 10_000;

interface CapturedRegion {
  readonly region_id: string;
  readonly region_name: string;
  readonly component_scores: Readonly<Record<string, number>>;
}
export interface CapturedComposite {
  readonly data: { readonly regions: readonly CapturedRegion[] };
}
interface CatalogItem {
  readonly indicator_id: string;
  readonly indicator_name: string;
  readonly category: string;
}
export interface CapturedCatalog {
  readonly data: Readonly<Record<string, readonly CatalogItem[]>>;
}

const envelope = (data: unknown, totalCount: number | null = null) => ({
  status: 'success',
  meta: { snapshot_id: LIVE_SNAPSHOT, mode: 'LIVE', boundary_version: null, total_count: totalCount },
  data,
});

/** Indicators with at least one component score in the capture, with how many regions have one. */
function capturedCounts(composite: CapturedComposite): Map<string, number> {
  const counts = new Map<string, number>();
  for (const region of composite.data.regions) {
    for (const [id, score] of Object.entries(region.component_scores)) {
      if (typeof score === 'number') counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** `GET /indicators/coverage?mode=live`: only indicators the capture holds values for are available. */
export function coverageResponse(catalog: CapturedCatalog, composite: CapturedComposite, totalRegions = 514) {
  const counts = capturedCounts(composite);
  const items = Object.values(catalog.data).flat();
  const indicators = Object.fromEntries(
    items.map((item) => {
      const count = counts.get(item.indicator_id) ?? 0;
      return [
        item.indicator_id,
        {
          name: item.indicator_name,
          category: item.category,
          available: count > 0,
          coverage_count: count,
          coverage_pct: Math.round((count / totalRegions) * 1000) / 10,
        },
      ];
    }),
  );
  const empty = items.filter((item) => !counts.has(item.indicator_id)).map((item) => item.indicator_id);
  return envelope(
    {
      snapshot_id: LIVE_SNAPSHOT,
      mode: 'LIVE',
      total_indicators: items.length,
      available_indicators_count: items.length - empty.length,
      empty_indicators_count: empty.length,
      empty_indicators: empty,
      total_regions: totalRegions,
      indicators,
    },
    items.length,
  );
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

/** `POST /indicators/composite-query?mode=live` for the given request body. */
export function compositeResponse(
  composite: CapturedComposite,
  body: { readonly weights: Readonly<Record<string, number>>; readonly filter_province_id?: string | null },
) {
  const counts = capturedCounts(composite);
  const requested = body.weights;
  const unavailable = Object.keys(requested).filter((id) => !counts.has(id));
  const withData = Object.fromEntries(
    Object.entries(requested).filter(([id, bps]) => counts.has(id) && bps > 0),
  );
  const effective = proportional(withData);
  const province = body.filter_province_id ?? null;

  const scored = composite.data.regions
    .filter((region) => province === null || region.region_id.startsWith(province))
    .filter((region) => Object.keys(effective).every((id) => typeof region.component_scores[id] === 'number'))
    .map((region) => {
      const components = Object.fromEntries(
        Object.keys(effective).map((id) => [id, region.component_scores[id] ?? 0]),
      );
      const score = Object.entries(effective).reduce(
        (total, [id, bps]) => total + ((components[id] ?? 0) * bps) / TOTAL,
        0,
      );
      return { region, components, score: Math.round(score * 100) / 100 };
    })
    .sort((a, b) => b.score - a.score || a.region.region_id.localeCompare(b.region.region_id));

  return envelope(
    {
      total_regions: scored.length,
      weights_basis_points: requested,
      unavailable_indicators: unavailable,
      effective_weights: effective,
      renormalized: unavailable.some((id) => (requested[id] ?? 0) > 0),
      regions: scored.map((entry, index) => ({
        region_id: entry.region.region_id,
        region_name: entry.region.region_name,
        composite_score: entry.score,
        rank: index + 1,
        component_scores: entry.components,
      })),
    },
    scored.length,
  );
}

/**
 * `GET /indicators/composite-presets?mode=live`. The guide names the endpoint without showing its
 * payload; this uses the shape the frontend adapter accepts (see labContract.ts).
 */
export function presetsResponse() {
  return envelope([
    {
      id: 'ketahanan-sosial',
      name: 'Ketahanan sosial',
      description: 'IPM, kemiskinan, dan stunting.',
      weights: { soc_hdi: 4000, soc_poverty_rate: 3000, hlt_stunting_prevalence: 3000 },
    },
    {
      id: 'risiko-dan-sekolah',
      name: 'Risiko bencana & sekolah',
      description: 'Risiko bencana, kemiskinan, ruang kelas rusak, dan stunting.',
      weights: {
        dis_multihazard_index: 3500,
        soc_poverty_rate: 2500,
        edu_damaged_classrooms_pct: 2000,
        hlt_stunting_prevalence: 2000,
      },
    },
    { id: 'rusak', name: 'Preset tidak lengkap', weights: { soc_hdi: 6000 } },
  ]);
}

/**
 * `GET /indicators/{id}/values?mode=live`. For soc_poverty_rate the captured response is returned
 * as is (real raw values). For the other captured indicators only the published normalised score
 * is known, so `raw` is null: the direction check then reports them as not verifiable.
 */
export function valuesResponse(
  indicatorId: string,
  catalog: CapturedCatalog,
  composite: CapturedComposite,
  capturedPoverty: unknown,
) {
  if (indicatorId === 'soc_poverty_rate') return capturedPoverty;
  const indicator = Object.values(catalog.data)
    .flat()
    .find((item) => item.indicator_id === indicatorId);
  if (!indicator) return null;
  const values = Object.fromEntries(
    composite.data.regions
      .filter((region) => typeof region.component_scores[indicatorId] === 'number')
      .map((region) => [
        region.region_id,
        { raw: null, norm: region.component_scores[indicatorId], pct: null, rank: null, flag: 'VERIFIED' },
      ]),
  );
  return envelope({ indicator, values_by_region: values }, Object.keys(values).length);
}
