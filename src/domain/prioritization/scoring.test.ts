import { DEMO_CURRENT_WEIGHTS, DEMO_PREVIOUS_WEIGHTS, DEMO_REGIONS } from '@/data/fixtures/landingDemo';
import { computeWeightedScore, rankRegions } from './scoring';
import { validateWeights } from './weights';

type Criterion = 'a' | 'b';

describe('validateWeights', () => {
  it('accepts integer basis points summing to 10000', () => {
    expect(validateWeights({ a: 6000, b: 4000 })).toEqual({ valid: true });
  });

  it.each([
    [{ a: 5000.5, b: 4999.5 }, 'not_integer'],
    [{ a: -1000, b: 11000 }, 'negative'],
    [{ a: 5000, b: 4000 }, 'wrong_total'],
  ] as const)('rejects %j as %s', (weights, reason) => {
    expect(validateWeights(weights)).toMatchObject({ valid: false, reason });
  });
});

describe('computeWeightedScore', () => {
  it('computes the weighted mean of normalised values', () => {
    const result = computeWeightedScore<Criterion>({ a: 1, b: 0.5 }, { a: 5000, b: 5000 });
    expect(result).toEqual({ status: 'scored', score: 0.75 });
  });

  it('blocks the score when a weighted criterion is missing instead of treating it as zero', () => {
    const result = computeWeightedScore<Criterion>({ a: 0.9, b: null }, { a: 5000, b: 5000 });
    expect(result).toEqual({ status: 'unscorable', missingCriteria: ['b'] });
  });

  it('ignores a missing value whose weight is zero', () => {
    const result = computeWeightedScore<Criterion>({ a: 0.4 }, { a: 10000, b: 0 });
    expect(result).toEqual({ status: 'scored', score: 0.4 });
  });

  it('refuses invalid weights and out-of-range values', () => {
    expect(() => computeWeightedScore<Criterion>({ a: 1, b: 1 }, { a: 1, b: 1 })).toThrow(RangeError);
    expect(() => computeWeightedScore<Criterion>({ a: 1.2, b: 0 }, { a: 5000, b: 5000 })).toThrow(RangeError);
  });
});

describe('rankRegions', () => {
  it('orders by score and breaks ties by region code', () => {
    const ranking = rankRegions<Criterion>(
      [
        { code: 'Z', name: 'Z', values: { a: 0.5, b: 0.5 } },
        { code: 'M', name: 'M', values: { a: 0.5, b: 0.5 } },
        { code: 'T', name: 'T', values: { a: 0.9, b: 0.9 } },
      ],
      { a: 5000, b: 5000 },
    );
    expect(ranking.ranked.map((entry) => entry.region.code)).toEqual(['T', 'M', 'Z']);
    expect(ranking.ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('lists unscorable regions separately', () => {
    const ranking = rankRegions<Criterion>(
      [
        { code: 'X', name: 'X', values: { a: 0.5 } },
        { code: 'Y', name: 'Y', values: { a: 0.5, b: 0.5 } },
      ],
      { a: 5000, b: 5000 },
    );
    expect(ranking.ranked.map((entry) => entry.region.code)).toEqual(['Y']);
    expect(ranking.unscorable.map((entry) => [entry.region.code, entry.missingCriteria])).toEqual([
      ['X', ['b']],
    ]);
  });
});

describe('landing DEMO fixture', () => {
  it('reproduces the Figma example ranking under the current weights', () => {
    const { ranked } = rankRegions(DEMO_REGIONS, DEMO_CURRENT_WEIGHTS);
    expect(ranked.map((entry) => [entry.region.name, entry.score.toFixed(2)])).toEqual([
      ['Wilayah A', '0.82'],
      ['Wilayah D', '0.74'],
      ['Wilayah B', '0.61'],
    ]);
  });

  it('ranks Wilayah B above Wilayah D under the previous weights, so the G6 reorder is real', () => {
    const { ranked } = rankRegions(DEMO_REGIONS, DEMO_PREVIOUS_WEIGHTS);
    expect(ranked.map((entry) => entry.region.name)).toEqual(['Wilayah A', 'Wilayah B', 'Wilayah D']);
  });
});
