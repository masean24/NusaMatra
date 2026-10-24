import { describe, expect, it } from 'vitest';
import type { DirectionVerdict } from './componentDirection';
import { assessDirectionImpact, type DirectionImpactInput } from './directionImpact';

// Production 2026-10-23: Lanny Jaya (9507), inf_safe_water_pct, raw 32.89, published score 100.
const WATER = 'inf_safe_water_pct';
const LANNY = { regionId: '9507', raw: 32.89, score: 100 };
const partialOf = (...items: (typeof LANNY)[]): DirectionVerdict => ({
  status: 'partial',
  checked: 10,
  unverified: items,
  reason: 'IMPUTED_PROVINCE tidak mengikuti nilai mentahnya.',
});
const consistent: DirectionVerdict = { status: 'consistent', checked: 10, imputedChecked: 1 };

function input(overrides: Partial<DirectionImpactInput> = {}): DirectionImpactInput {
  return {
    checks: [{ indicatorId: WATER, verdict: partialOf(LANNY), nationalVerdict: partialOf(LANNY) }],
    rows: [
      { regionId: '9507', effectiveWeights: { [WATER]: 2000, soc_poverty_rate: 8000 } },
      { regionId: '9101', effectiveWeights: { [WATER]: 2000, soc_poverty_rate: 8000 } },
    ],
    weightsUsed: { [WATER]: 2000, soc_poverty_rate: 8000 },
    filterProvinceId: null,
    ...overrides,
  };
}

describe('assessDirectionImpact', () => {
  it('withholds the ranking when a known-inconsistent imputed score carries a positive weight in it', () => {
    expect(assessDirectionImpact(input())).toEqual({
      status: 'ranking_withheld',
      anomalies: [{ indicatorId: WATER, ...LANNY }],
    });
  });

  it('is clear when the scenario weights that indicator 0 (it cannot distort anything)', () => {
    expect(assessDirectionImpact(input({ weightsUsed: { [WATER]: 0, soc_poverty_rate: 10000 } }))).toEqual({
      status: 'clear',
    });
  });

  it('is clear when the region itself carries 0 effective weight for that indicator', () => {
    const rows = [{ regionId: '9507', effectiveWeights: { soc_poverty_rate: 10000 } }];
    expect(assessDirectionImpact(input({ rows })).status).toBe('clear');
  });

  it('fails closed on the scenario weight when the region weights are not reported', () => {
    const rows = [{ regionId: '9507', effectiveWeights: null }];
    expect(assessDirectionImpact(input({ rows })).status).toBe('ranking_withheld');
  });

  it('is clear for consistent observations, imputed ones included', () => {
    const checks = [{ indicatorId: WATER, verdict: consistent, nationalVerdict: consistent }];
    expect(assessDirectionImpact(input({ checks })).status).toBe('clear');
  });

  it('keeps insufficient evidence (unverified, unverifiable) a warning, never a withheld ranking', () => {
    for (const verdict of [
      { status: 'unverified', imputedCount: 3, reason: 'x' },
      { status: 'unverifiable', reason: 'Nilai sumber tidak tersedia.' },
    ] as DirectionVerdict[]) {
      const checks = [{ indicatorId: WATER, verdict, nationalVerdict: null }];
      expect(assessDirectionImpact(input({ checks })).status).toBe('clear');
    }
  });

  it('province filter: withholds only national ranks when the anomaly lies outside the listed regions', () => {
    const checks = [{ indicatorId: WATER, verdict: consistent, nationalVerdict: partialOf(LANNY) }];
    const rows = [{ regionId: '3307', effectiveWeights: { [WATER]: 2000, soc_poverty_rate: 8000 } }];
    expect(assessDirectionImpact(input({ checks, rows, filterProvinceId: '33' }))).toEqual({
      status: 'national_rank_withheld',
      anomalies: [{ indicatorId: WATER, ...LANNY }],
    });
  });

  it('national list: the national verdict adds nothing the listed rows do not already decide', () => {
    const checks = [{ indicatorId: WATER, verdict: consistent, nationalVerdict: partialOf(LANNY) }];
    const rows = [{ regionId: '3307', effectiveWeights: { [WATER]: 2000 } }];
    expect(assessDirectionImpact(input({ checks, rows })).status).toBe('clear');
  });

  it('withholding the ranking takes precedence over withholding only national ranks', () => {
    const other = { regionId: '9101', raw: 40, score: 99 };
    const checks = [{ indicatorId: WATER, verdict: partialOf(other), nationalVerdict: partialOf(LANNY) }];
    const rows = [{ regionId: '9101', effectiveWeights: { [WATER]: 2000 } }];
    expect(assessDirectionImpact(input({ checks, rows, filterProvinceId: '91' })).status).toBe(
      'ranking_withheld',
    );
  });
});
