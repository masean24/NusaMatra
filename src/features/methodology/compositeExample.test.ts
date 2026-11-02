import { describe, expect, it } from 'vitest';
import { buildCompositeExample } from './compositeExample';

describe('buildCompositeExample', () => {
  it('adds each need score times its share of the weight, as the Data Hub does', () => {
    // Live Data Hub, Kabupaten Cianjur: composite-query for these weights returned 28,85.
    const example = buildCompositeExample({
      soc_hdi: 40.06,
      dis_multihazard_index: 40.52,
      soc_poverty_rate: 19.48,
      hlt_stunting_prevalence: 3.88,
    });
    expect(example.total).toBeCloseTo(28.846, 3);
    expect(example.rows.map((row) => row.contribution)).toEqual([
      expect.closeTo(12.018, 3),
      expect.closeTo(12.156, 3),
      expect.closeTo(3.896, 3),
      expect.closeTo(0.776, 3),
    ]);
    expect(example.missing).toEqual([]);
  });

  it('never treats a missing value as zero: no total, and the gap is named', () => {
    const example = buildCompositeExample({ soc_hdi: 40, dis_multihazard_index: null, soc_poverty_rate: 20 });
    expect(example.total).toBeNull();
    expect(example.missing).toEqual(['dis_multihazard_index', 'hlt_stunting_prevalence']);
    expect(example.rows.find((row) => row.id === 'dis_multihazard_index')?.contribution).toBeNull();
  });
});
