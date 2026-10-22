import captured from '../../services/api/__fixtures__/composite_valid.json';
import liveComposite from '../../services/api/__fixtures__/live/composite.json';
import liveRegistry from '../../services/api/__fixtures__/live/registry_ids.json';
import {
  assessCompositeIntegrity,
  type CompositeIntegrityInput,
  type CompositeRowInput,
} from './compositeIntegrity';

/** The captured DEMO composite response (2026-10-20), as plain numbers. */
function capturedInput(): { weights: Record<string, number>; total: number; rows: CompositeRowInput[] } {
  const { data } = captured;
  return {
    weights: data.weights_basis_points,
    total: data.total_regions,
    rows: data.regions.map((region) => ({
      regionId: region.region_id,
      rankPosition: region.rank,
      compositeScore: region.composite_score,
      componentScores: region.component_scores,
    })),
  };
}

function input(overrides: Partial<CompositeIntegrityInput> = {}): CompositeIntegrityInput {
  const { weights, total, rows } = capturedInput();
  return {
    weightsBasisPoints: weights,
    reportedTotalRegions: total,
    rows,
    registryRegionCount: 514,
    ...overrides,
  };
}

describe('assessCompositeIntegrity on the deployed LIVE composite (captured 2026-10-22)', () => {
  const live = liveComposite;

  function liveInput(): CompositeIntegrityInput {
    return {
      weightsBasisPoints: live.data.weights_basis_points,
      reportedTotalRegions: live.data.total_regions,
      registryRegionCount: liveRegistry.count,
      rows: live.data.regions.map((region) => ({
        regionId: region.region_id,
        rankPosition: region.rank,
        compositeScore: region.composite_score,
        componentScores: region.component_scores,
      })),
    };
  }

  it('finds the arithmetic and the ranking sound: no score, order or weight problem', () => {
    const codes = assessCompositeIntegrity(liveInput()).issues.map((issue) => issue.code);
    expect(codes).not.toContain('SCORE_MISMATCH');
    expect(codes).not.toContain('RANK_ORDER');
    expect(codes).not.toContain('WEIGHTS_NOT_100_PERCENT');
    expect(codes).not.toContain('DUPLICATE_REGION');
  });

  it('reports the coverage gap: 487 of the 514 registry regions', () => {
    const result = assessCompositeIntegrity(liveInput());
    const gap = result.issues.find((issue) => issue.code === 'REGISTRY_COUNT_MISMATCH');
    expect(live.data.regions).toHaveLength(487);
    expect(liveRegistry.count).toBe(514);
    expect(gap?.count).toBe(27);
  });

  it('reports regions scored with an empty component, which only reproduce when "no data" counts as 0', () => {
    const result = assessCompositeIntegrity(liveInput());
    const missing = result.issues.find((issue) => issue.code === 'MISSING_COMPONENT');
    expect(missing?.count).toBe(26);
    expect(missing?.message).toMatch(/dihitung sebagai 0/);
    expect(missing?.severity).toBe('block');
    // Kota Surakarta (3372) has no stunting value and 74.57 = its three other components at 30/30/20 %.
    expect(missing?.examples).toContain('3372');
    expect(result.ok).toBe(false);
  });
});

describe('assessCompositeIntegrity', () => {
  it('passes the captured DEMO composite: scores reproduce from components, ranks are in order, 514 of 514', () => {
    const result = assessCompositeIntegrity(input());
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.maxScoreError).toBeLessThanOrEqual(0.05);
  });

  it('lets a sound ranking of fewer regions than the registry stand, but discloses the gap', () => {
    const { rows } = capturedInput();
    const partial = rows.slice(0, 487);
    const result = assessCompositeIntegrity(input({ rows: partial, reportedTotalRegions: 487 }));
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ['REGISTRY_COUNT_MISMATCH', 'disclose'],
    ]);
    expect(result.issues[0]?.count).toBe(27);
    expect(result.issues[0]?.message).toMatch(/27 dari 514 wilayah tidak masuk peringkat/);
  });

  it('blocks a ranking with more regions than the registry', () => {
    const result = assessCompositeIntegrity(input({ registryRegionCount: 500 }));
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'REGISTRY_COUNT_MISMATCH', severity: 'block' });
  });

  it('reports a response whose own total does not match the rows it contains', () => {
    const { rows } = capturedInput();
    const result = assessCompositeIntegrity(input({ rows: rows.slice(0, 487), registryRegionCount: null }));
    expect(result.issues.map((issue) => issue.code)).toContain('REPORTED_COUNT_MISMATCH');
  });

  it('reports a composite score that is not the weighted sum of its components, without correcting it', () => {
    const { rows } = capturedInput();
    const [first, ...rest] = rows;
    if (!first) throw new Error('no rows');
    const tampered = [{ ...first, compositeScore: (first.compositeScore ?? 0) - 7.5 }, ...rest];
    const result = assessCompositeIntegrity(input({ rows: tampered }));
    expect(result.ok).toBe(false);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('SCORE_MISMATCH');
    expect(result.maxScoreError).toBeGreaterThan(7);
    // The input is untouched: detection only.
    expect(tampered[0]?.compositeScore).toBeCloseTo((first.compositeScore ?? 0) - 7.5);
  });

  it('reports rank positions that do not follow the scores', () => {
    const { rows } = capturedInput();
    const [first, second, ...rest] = rows;
    if (!first || !second) throw new Error('need two rows');
    const swapped = [second, first, ...rest];
    expect(assessCompositeIntegrity(input({ rows: swapped })).issues.map((issue) => issue.code)).toContain(
      'RANK_ORDER',
    );
  });

  it('reports a weighted criterion that has no value for any region', () => {
    const { rows } = capturedInput();
    const first = Object.keys(rows[0]?.componentScores ?? {})[0] ?? '';
    const stripped = rows.map((row) => ({
      ...row,
      componentScores: { ...row.componentScores, [first]: null },
    }));
    const result = assessCompositeIntegrity(input({ rows: stripped }));
    const issue = result.issues.find((entry) => entry.code === 'CRITERION_WITHOUT_DATA');
    expect(issue?.message).toContain(first);
    expect(issue?.count).toBe(1);
  });

  it('reports weights that do not add up to 100 %', () => {
    const { weights } = capturedInput();
    const first = Object.keys(weights)[0] ?? '';
    const off = { ...weights, [first]: (weights[first] ?? 0) + 100 };
    expect(
      assessCompositeIntegrity(input({ weightsBasisPoints: off })).issues.map((issue) => issue.code),
    ).toContain('WEIGHTS_NOT_100_PERCENT');
  });

  it('reports a score built from fewer components than were weighted, and duplicate regions', () => {
    const { rows } = capturedInput();
    const [first, ...rest] = rows;
    if (!first) throw new Error('no rows');
    const firstKey = Object.keys(first.componentScores)[0] ?? '';
    const missing = { ...first, componentScores: { ...first.componentScores, [firstKey]: null } };
    const withMissing = assessCompositeIntegrity(input({ rows: [missing, ...rest] }));
    expect(withMissing.issues.map((issue) => issue.code)).toContain('MISSING_COMPONENT');

    const duplicated = assessCompositeIntegrity(input({ rows: [first, ...rows], registryRegionCount: null }));
    expect(duplicated.issues.map((issue) => issue.code)).toContain('DUPLICATE_REGION');
  });

  it('lets a row without a score (no data) stand: it is not a calculation error', () => {
    const { rows } = capturedInput();
    const unscored: CompositeRowInput = {
      regionId: '9999',
      rankPosition: null,
      compositeScore: null,
      componentScores: {},
    };
    const result = assessCompositeIntegrity(
      input({ rows: [...rows, unscored], reportedTotalRegions: 515, registryRegionCount: 515 }),
    );
    expect(result.issues).toEqual([]);
  });

  it('ranks may share a position on equal scores, but never exceed the regions counted', () => {
    const row = (regionId: string, rankPosition: number, compositeScore: number): CompositeRowInput => ({
      regionId,
      rankPosition,
      compositeScore,
      componentScores: { a: compositeScore },
    });
    const base = { weightsBasisPoints: { a: 10000 }, registryRegionCount: null };
    const tied = [row('1', 1, 80), row('2', 1, 80), row('3', 3, 70)];
    expect(assessCompositeIntegrity({ ...base, reportedTotalRegions: 3, rows: tied }).ok).toBe(true);
    const beyond = [row('1', 1, 80), row('2', 2, 75), row('3', 9, 70)];
    const codes = assessCompositeIntegrity({ ...base, reportedTotalRegions: 3, rows: beyond }).issues.map(
      (issue) => issue.code,
    );
    expect(codes).toEqual(expect.arrayContaining(['RANK_ORDER', 'RANK_BEYOND_POPULATION']));
  });

  it('blocks scores outside 0–100 or not finite', () => {
    const rows: CompositeRowInput[] = [
      { regionId: '1', rankPosition: 1, compositeScore: 120, componentScores: { a: 120 } },
      { regionId: '2', rankPosition: 2, compositeScore: Number.NaN, componentScores: { a: 50 } },
    ];
    const result = assessCompositeIntegrity({
      weightsBasisPoints: { a: 10000 },
      reportedTotalRegions: 2,
      rows,
    });
    expect(result.issues.find((issue) => issue.code === 'SCORE_OUT_OF_RANGE')?.count).toBe(2);
    expect(result.ok).toBe(false);
  });

  it('blocks a response whose weights differ from the request', () => {
    const { weights } = capturedInput();
    const requested = { ...weights, extra: 0 };
    expect(assessCompositeIntegrity(input({ requestedWeights: requested })).ok).toBe(true);
    const changed = Object.fromEntries(
      Object.entries(weights).map(([id, bps], index) => [id, index === 0 ? bps + 100 : bps]),
    );
    const result = assessCompositeIntegrity(input({ requestedWeights: changed }));
    expect(result.issues.map((issue) => issue.code)).toContain('WEIGHTS_ECHO_MISMATCH');
  });

  it('blocks regions outside the province the ranking was filtered to', () => {
    const { rows } = capturedInput();
    const result = assessCompositeIntegrity(
      input({ rows, filterProvinceId: '32', registryRegionCount: null }),
    );
    const issue = result.issues.find((entry) => entry.code === 'PROVINCE_FILTER_MISMATCH');
    expect(issue?.severity).toBe('block');
    expect(issue?.examples?.length).toBeGreaterThan(0);
  });
});

describe('assessCompositeIntegrity with guide v2 renormalisation', () => {
  // The guide's example: edu_damaged_classrooms_pct has no LIVE data, so 35/25/20 % of the rest is
  // scaled to 43.75/31.25/25 %.
  const requested = {
    dis_multihazard_index: 3500,
    soc_poverty_rate: 2500,
    edu_damaged_classrooms_pct: 2000,
    hlt_stunting_prevalence: 2000,
  };
  const effective = { dis_multihazard_index: 4375, soc_poverty_rate: 3125, hlt_stunting_prevalence: 2500 };
  const components = { dis_multihazard_index: 72.1, soc_poverty_rate: 61.5, hlt_stunting_prevalence: 70.3 };
  // 72.1 × 0.4375 + 61.5 × 0.3125 + 70.3 × 0.25 = 68.32
  const row: CompositeRowInput = {
    regionId: '3201',
    rankPosition: 1,
    compositeScore: 68.32,
    componentScores: components,
  };
  const v2 = (overrides: Partial<CompositeIntegrityInput> = {}): CompositeIntegrityInput => ({
    weightsBasisPoints: requested,
    requestedWeights: requested,
    effectiveWeightsBasisPoints: effective,
    unavailableIndicatorIds: ['edu_damaged_classrooms_pct'],
    renormalized: true,
    reportedTotalRegions: 1,
    rows: [row],
    ...overrides,
  });

  it('checks scores against the effective weights, not the requested ones', () => {
    const result = assessCompositeIntegrity(v2());
    expect(result.issues).toEqual([]);
    expect(result.weightsUsed).toEqual(effective);
  });

  it('flags the guide example itself: its 68.42 does not follow from its own components', () => {
    const result = assessCompositeIntegrity(v2({ rows: [{ ...row, compositeScore: 68.42 }] }));
    expect(result.issues.map((issue) => issue.code)).toEqual(['SCORE_MISMATCH']);
  });

  it('blocks effective weights that do not sum to 10 000 or are not proportional', () => {
    const short = assessCompositeIntegrity(
      v2({ effectiveWeightsBasisPoints: { ...effective, hlt_stunting_prevalence: 2400 } }),
    );
    expect(short.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['EFFECTIVE_WEIGHTS_NOT_100_PERCENT', 'RENORMALIZATION_INCONSISTENT']),
    );
    const skewed = { dis_multihazard_index: 5000, soc_poverty_rate: 2500, hlt_stunting_prevalence: 2500 };
    expect(
      assessCompositeIntegrity(v2({ effectiveWeightsBasisPoints: skewed })).issues.map((issue) => issue.code),
    ).toContain('RENORMALIZATION_INCONSISTENT');
  });

  it('blocks a renormalisation flag that contradicts the lists, and unknown unavailable indicators', () => {
    expect(assessCompositeIntegrity(v2({ renormalized: false })).ok).toBe(false);
    expect(
      assessCompositeIntegrity(v2({ unavailableIndicatorIds: ['edu_damaged_classrooms_pct', 'zzz'] })).ok,
    ).toBe(false);
  });

  it('accepts rounding of effective weights by one basis point', () => {
    const thirds = { a: 3333, b: 3333, c: 3334, d: 0 };
    const result = assessCompositeIntegrity({
      weightsBasisPoints: { a: 2500, b: 2500, c: 2500, d: 2500 },
      effectiveWeightsBasisPoints: { a: 3333, b: 3333, c: 3334 },
      unavailableIndicatorIds: ['d'],
      renormalized: true,
      reportedTotalRegions: 0,
      rows: [],
    });
    expect(thirds.d).toBe(0);
    expect(result.issues).toEqual([]);
  });
});
