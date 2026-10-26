import { assessComparison, type ComparableMeasurement } from './assessComparison';

const measured = (overrides: Partial<ComparableMeasurement> = {}): ComparableMeasurement => ({
  value: 10,
  unit: 'percent (%)',
  referenceYear: 2025,
  datasetId: 'bps_susenas_sakernas_2025',
  qualityFlag: 'VERIFIED',
  ...overrides,
});

describe('assessComparison', () => {
  it('compares matching measurements and reports which figure is higher, not which is better', () => {
    const result = assessComparison(measured({ value: 12 }), measured({ value: 4 }));
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.difference).toEqual({ absolute: -8, ratio: 3, higher: 'A' });
  });

  it('blocks a missing value and computes no difference, and never reads it as 0', () => {
    const result = assessComparison(measured({ value: null }), measured({ value: 4 }));
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['MISSING_VALUE']);
    expect(result.difference).toBeNull();
  });

  it('blocks different units and different datasets', () => {
    const result = assessComparison(
      measured(),
      measured({ unit: 'index (0.0-1.0)', datasetId: 'other_dataset' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual([
      'INCOMPATIBLE_UNIT',
      'INCOMPATIBLE_DEFINITION',
    ]);
  });

  it('blocks a value imputed from the province', () => {
    const result = assessComparison(measured({ qualityFlag: 'IMPUTED_PROVINCE' }), measured());
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['IMPUTED_VALUE']);
  });

  it('blocks different years: no difference, and the message names both years', () => {
    const result = assessComparison(measured({ referenceYear: 2021 }), measured({ referenceYear: 2023 }));
    expect(result.allowed).toBe(false);
    expect(result.difference).toBeNull();
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['YEAR_MISMATCH']);
    expect(result.blockers[0]?.message).toMatch(/2021 dan 2023/);
  });

  it('blocks when a year is unknown', () => {
    const result = assessComparison(measured({ referenceYear: null }), measured());
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['YEAR_UNKNOWN']);
  });

  it('blocks two unknown sources instead of treating the same placeholder as one dataset', () => {
    const unknown = { datasetId: 'unknown_dataset', provenanceKnown: false };
    const result = assessComparison(measured(unknown), measured(unknown));
    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['UNKNOWN_PROVENANCE']);
  });

  it('reports only "missing" when one region has no entry for the indicator', () => {
    const absent = {
      value: null,
      unit: 'percent (%)',
      referenceYear: null,
      datasetId: '',
      qualityFlag: null,
    };
    const result = assessComparison(measured(), { ...absent, present: false });
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['MISSING_VALUE']);
  });

  it('is symmetric when the regions are swapped', () => {
    const forward = assessComparison(measured({ value: 12 }), measured({ value: 4 }));
    const swapped = assessComparison(measured({ value: 4 }), measured({ value: 12 }));
    expect(forward.difference).toEqual({ absolute: -8, ratio: 3, higher: 'A' });
    expect(swapped.difference).toEqual({ absolute: 8, ratio: 3, higher: 'B' });
  });

  it('treats a measured 0 as a value: 0 vs 0 is equal, 0 vs null is blocked', () => {
    expect(assessComparison(measured({ value: 0 }), measured({ value: 0 })).difference).toEqual({
      absolute: 0,
      ratio: null,
      higher: 'EQUAL',
    });
    expect(assessComparison(measured({ value: 0 }), measured({ value: null })).allowed).toBe(false);
  });

  it('gives no ratio when a value is 0 (a ratio to zero is meaningless) but keeps the absolute gap', () => {
    const result = assessComparison(measured({ value: 0 }), measured({ value: 5 }));
    expect(result.difference).toEqual({ absolute: 5, ratio: null, higher: 'B' });
  });

  it('calls equal values equal', () => {
    const result = assessComparison(measured({ value: 7 }), measured({ value: 7 }));
    expect(result.difference).toEqual({ absolute: 0, ratio: 1, higher: 'EQUAL' });
  });
});
