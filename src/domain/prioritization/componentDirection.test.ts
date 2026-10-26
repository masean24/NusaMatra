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

/*
 * The v1 capture (2026-10-22) scores a better condition HIGHER (`higher_is_better`). It is kept as evidence of
 * the older orientation; the v2.1 contract (`higher_is_need`) is tested on the 2026-10-23 captures in
 * src/features/priority-lab/compositeCheck.test.ts.
 */
describe('checkComponentDirection on the v1 LIVE poverty capture (higher_is_better, pre-v2.1)', () => {
  it('finds the component equal to the published score and falling as poverty rises', () => {
    const verdict = checkComponentDirection({
      polarity: 'negative',
      ...poverty(),
      compareToPublished: true,
      scoreDirection: 'higher_is_better',
    });
    expect(verdict).toEqual({ status: 'consistent', checked: 487, imputedChecked: 0 });
  });

  it('catches a component scored in the wrong direction', () => {
    const verdict = checkComponentDirection({
      polarity: 'positive',
      ...poverty(),
      compareToPublished: false,
      scoreDirection: 'higher_is_better',
    });
    expect(verdict.status).toBe('inconsistent');
  });

  it('is inconsistent under higher_is_need: the v1 scores fall as poverty rises, need must rise', () => {
    const verdict = checkComponentDirection({
      polarity: 'negative',
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
      scoreDirection: 'higher_is_better',
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
    ).toEqual({ status: 'consistent', checked: 3, imputedChecked: 0 });
  });
});

describe('checkComponentDirection under higher_is_need (the default)', () => {
  const reference = {
    a: { raw: 1, normalized: null },
    b: { raw: 2, normalized: null },
    c: { raw: 3, normalized: null },
  };

  it('expects a negative indicator (worse when higher) to raise the score and a positive one to lower it', () => {
    const rising = { a: 10, b: 50, c: 90 };
    const falling = { a: 90, b: 50, c: 10 };
    const check = (polarity: string, components: Record<string, number>) =>
      checkComponentDirection({ polarity, components, reference, compareToPublished: false }).status;
    expect(check('negative', rising)).toBe('consistent');
    expect(check('negative', falling)).toBe('inconsistent');
    expect(check('positive', falling)).toBe('consistent');
    expect(check('positive', rising)).toBe('inconsistent');
  });
});

describe('checkComponentDirection by observation quality (negative polarity: need rises with the raw value)', () => {
  const observation = (raw: number, qualityFlag: string) => ({ raw, normalized: null, qualityFlag });
  const run = (
    quality: Record<string, string>,
    components: Record<string, number>,
    extra: { imputedRegionIds?: ReadonlySet<string> } = {},
  ) =>
    checkComponentDirection({
      polarity: 'negative',
      components,
      reference: Object.fromEntries(
        Object.entries(quality).map(([id, flag], index) => [id, observation(index + 1, flag)]),
      ),
      compareToPublished: false,
      ...extra,
    });
  const rising = { a: 10, b: 30, c: 50, d: 70 };

  it('all VERIFIED: validated in full', () => {
    const verified = { a: 'VERIFIED', b: 'VERIFIED', c: 'VERIFIED', d: 'VERIFIED' };
    expect(run(verified, rising)).toEqual({ status: 'consistent', checked: 4, imputedChecked: 0 });
    expect(run(verified, { ...rising, c: 5 }).status).toBe('inconsistent');
  });

  it('DERIVED observations count as independent evidence', () => {
    const derived = { a: 'DERIVED', b: 'DERIVED', c: 'DERIVED', d: 'DERIVED' };
    expect(run(derived, rising)).toEqual({ status: 'consistent', checked: 4, imputedChecked: 0 });
    expect(run(derived, { ...rising, b: 90 }).status).toBe('inconsistent');
  });

  it('IMPUTED_PROVINCE that follows the order is checked, and counted, as an estimate', () => {
    const mixed = { a: 'VERIFIED', b: 'VERIFIED', c: 'IMPUTED_PROVINCE', d: 'VERIFIED' };
    expect(run(mixed, rising)).toEqual({ status: 'consistent', checked: 4, imputedChecked: 1 });
  });

  it('IMPUTED_PROVINCE that breaks the order is named in a partial verdict, with its raw value and score', () => {
    const mixed = { a: 'VERIFIED', b: 'VERIFIED', c: 'IMPUTED_PROVINCE', d: 'VERIFIED' };
    const verdict = run(mixed, { ...rising, c: 100 });
    expect(verdict).toMatchObject({
      status: 'partial',
      checked: 3,
      unverified: [{ regionId: 'c', raw: 3, score: 100 }],
    });
  });

  it('mixed quality: a VERIFIED region out of order still fails, even next to an imputed one', () => {
    const mixed = { a: 'VERIFIED', b: 'VERIFIED', c: 'IMPUTED_PROVINCE', d: 'VERIFIED' };
    expect(run(mixed, { a: 10, b: 60, c: 100, d: 30 }).status).toBe('inconsistent');
  });

  it('the composite own quality flags mark estimates too (imputedRegionIds)', () => {
    const plain = { a: 'VERIFIED', b: 'VERIFIED', c: 'VERIFIED', d: 'VERIFIED' };
    expect(run(plain, { ...rising, c: 100 }, { imputedRegionIds: new Set(['c']) }).status).toBe('partial');
  });

  it('no independently testable observation: unverified, never consistent', () => {
    const allEstimates = {
      a: 'IMPUTED_PROVINCE',
      b: 'IMPUTED_PROVINCE',
      c: 'IMPUTED_PROVINCE',
      d: 'IMPUTED_PROVINCE',
    };
    const verdict = run(allEstimates, rising);
    expect(verdict).toMatchObject({ status: 'unverified', imputedCount: 4 });
    expect(
      run({ a: 'VERIFIED', b: 'IMPUTED_PROVINCE', c: 'IMPUTED_PROVINCE', d: 'IMPUTED_PROVINCE' }, rising)
        .status,
    ).toBe('unverified');
    // Estimates that contradict each other are still inconsistent.
    expect(run(allEstimates, { ...rising, b: 90 }).status).toBe('inconsistent');
  });
});
