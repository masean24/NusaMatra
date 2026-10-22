import liveComposite from '../../services/api/__fixtures__/live/composite.json';
import povertyValues from '../../services/api/__fixtures__/live/indicator_values_soc_poverty_rate.json';
import { checkComponentDirection, type ReferenceValue } from './componentDirection';

/** Poverty (negative polarity) as the deployed LIVE Data Hub returned it on 2026-10-22. */
function poverty(): {
  components: Record<string, number | null>;
  reference: Record<string, ReferenceValue>;
} {
  const components = Object.fromEntries(
    liveComposite.data.regions.map((region) => [
      region.region_id,
      (region.component_scores as Record<string, number | undefined>)['soc_poverty_rate'] ?? null,
    ]),
  );
  const reference = Object.fromEntries(
    Object.entries(povertyValues.data.values_by_region).map(([regionId, cell]) => [
      regionId,
      { raw: cell.raw, normalized: cell.norm },
    ]),
  );
  return { components, reference };
}

describe('checkComponentDirection on the captured LIVE poverty data', () => {
  it('finds the component equal to the published score and falling as poverty rises', () => {
    const verdict = checkComponentDirection({ polarity: 'negative', ...poverty(), compareToPublished: true });
    expect(verdict).toEqual({ status: 'consistent', checked: 487 });
  });

  it('catches a component scored in the wrong direction', () => {
    const verdict = checkComponentDirection({
      polarity: 'positive',
      ...poverty(),
      compareToPublished: false,
    });
    expect(verdict.status).toBe('inconsistent');
  });

  it('catches a component that is not the published normalised score', () => {
    const { components, reference } = poverty();
    const [first] = Object.keys(components);
    const shifted = { ...components, [first ?? '']: 3 };
    const verdict = checkComponentDirection({
      polarity: 'negative',
      components: shifted,
      reference,
      compareToPublished: true,
    });
    expect(verdict).toMatchObject({ status: 'inconsistent', examples: [first] });
  });
});

describe('checkComponentDirection', () => {
  it('cannot judge a contextual indicator or too few values', () => {
    expect(
      checkComponentDirection({
        polarity: 'contextual',
        components: { a: 1, b: 2 },
        reference: { a: { raw: 1, normalized: null }, b: { raw: 2, normalized: null } },
        compareToPublished: false,
      }).status,
    ).toBe('unverifiable');
    expect(
      checkComponentDirection({
        polarity: 'positive',
        components: { a: 1 },
        reference: { a: { raw: 1, normalized: null } },
        compareToPublished: false,
      }).status,
    ).toBe('unverifiable');
  });

  it('ignores equal raw values and rounding below 0.01', () => {
    expect(
      checkComponentDirection({
        polarity: 'positive',
        components: { a: 10, b: 9.995, c: 50 },
        reference: {
          a: { raw: 1, normalized: null },
          b: { raw: 2, normalized: null },
          c: { raw: 2, normalized: null },
        },
        compareToPublished: false,
      }),
    ).toEqual({ status: 'consistent', checked: 3 });
  });
});
