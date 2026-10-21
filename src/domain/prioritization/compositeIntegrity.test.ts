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

  it('reports a ranking that covers fewer regions than the registry (the 487-of-514 case)', () => {
    const { rows } = capturedInput();
    const partial = rows.slice(0, 487);
    const result = assessCompositeIntegrity(input({ rows: partial, reportedTotalRegions: 487 }));
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(['REGISTRY_COUNT_MISMATCH']);
    expect(result.issues[0]?.count).toBe(27);
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
});
