/**
 * The Lab's integrity pipeline (wire -> mapper -> integrity check -> direction check) on the Data Hub v2.1
 * responses CAPTURED FROM PRODUCTION on 2026-10-23 (src/services/api/__fixtures__/live-v2.1, unmodified).
 * Tests that tamper with a capture say so and do it in memory ("synthetic, derived from ...").
 */
import {
  assessCompositeIntegrity,
  assessDirectionImpact,
  checkComponentDirection,
  classifyCoverage,
} from '@/domain/prioritization';
import {
  mapCompositeQueryData,
  mapIndicatorValuesData,
  type AdaptedResponseMeta,
  type ExploratoryCompositeResultDTO,
} from '@/services/api';
import nationalKms22 from '@/services/api/__fixtures__/live-v2.2/composite_national_kms.json';
import nonRankable22 from '@/services/api/__fixtures__/live-v2.2/composite_nonrankable.json';
import valuesWater22 from '@/services/api/__fixtures__/live-v2.2/values_water.json';
import jateng from '@/services/api/__fixtures__/live-v2.1/composite_jateng_kemiskinan_stunting.json';
import nationalEdu from '@/services/api/__fixtures__/live-v2.1/composite_national_pendidikan_3t.json';
import nationalHdi from '@/services/api/__fixtures__/live-v2.1/composite_national_hdi.json';
import nationalKms from '@/services/api/__fixtures__/live-v2.1/composite_national_kemiskinan_stunting.json';
import sumut from '@/services/api/__fixtures__/live-v2.1/composite_sumut_bencana.json';
import valuesHdi from '@/services/api/__fixtures__/live-v2.1/values_soc_hdi.json';
import valuesPoverty from '@/services/api/__fixtures__/live-v2.1/values_soc_poverty_rate.json';
import valuesWater from '@/services/api/__fixtures__/live-v2.1/values_inf_safe_water_pct.json';
import { integrityInputFromResult } from './compositeCheck';
import { checkRankingDirections, impactRowsOf } from './directionChecks';

const META: AdaptedResponseMeta = {
  serverRequestId: null,
  apiVersion: 'v1',
  serverGeneratedAt: null,
  clientReceivedAt: '2026-10-23T15:30:00Z',
  dataMode: 'LIVE',
  snapshotId: '2026.10.0-official-live',
  boundaryVersion: null,
  totalCount: null,
  contentSha256: null,
  snapshotImmutable: null,
  snapshotReproducible: null,
  methodologyVersion: null,
};

const KMS_WEIGHTS = {
  soc_poverty_rate: 3000,
  hlt_stunting_prevalence: 3000,
  inf_safe_water_pct: 2000,
  inf_safe_sanitation_pct: 2000,
};
const EDU_WEIGHTS = {
  edu_damaged_classrooms_pct: 3000,
  edu_mean_years_schooling: 2500,
  edu_student_teacher_ratio_sd: 2500,
  inf_internet_household_pct: 2000,
};

type Wire = { data: unknown };
const map = (capture: Wire, province: string | null = null) =>
  mapCompositeQueryData(capture.data, META, province);
const assess = (
  result: ExploratoryCompositeResultDTO,
  registry: number | null,
  weights: Readonly<Record<string, number>>,
  rankable: boolean | null = null,
) => assessCompositeIntegrity(integrityInputFromResult(result, registry, weights, rankable));
const codes = (result: ReturnType<typeof assess>) => result.issues.map((issue) => issue.code);
const blocking = (result: ReturnType<typeof assess>) =>
  result.issues.filter((issue) => issue.severity === 'block').map((issue) => issue.code);
const clone = <T>(value: T): T => structuredClone(value);

describe('Jateng scenario (captured: poverty 3000, stunting 3000, water 2000, sanitation 2000)', () => {
  const result = map(jateng, '33');

  it('reads the v2.1 envelope: 35 returned, 513 eligible nationally, higher_is_need, no insufficient', () => {
    expect(result.scoreDirection).toBe('higher_is_need');
    expect(result.totalRegions).toBe(35);
    expect(result.totalEligibleNational).toBe(513);
    expect(result.totalExcluded).toBe(0);
    expect(result.minCoveragePct).toBe(70);
    expect(result.minComponents).toBe(2);
    expect(result.items).toHaveLength(35);
    expect(result.insufficient).toEqual([]);
  });

  it('keeps the server rank and national rank: Wonosobo 35.06 is rank 1 (national 80), Surakarta 9.57 rank 35', () => {
    const [first] = result.items;
    const last = result.items.at(-1);
    expect(first).toMatchObject({
      regionId: '3307',
      compositeScoreDecimal: '35.06',
      rankPosition: 1,
      nationalRank: 80,
      coveragePct: 100,
    });
    expect(last).toMatchObject({
      regionId: '3372',
      compositeScoreDecimal: '9.57',
      rankPosition: 35,
      nationalRank: 487,
      coveragePct: 70,
      missingIndicators: ['hlt_stunting_prevalence'],
    });
  });

  it('keeps a missing component null, never 0, and uses the region weights (10 000 bps) of a partial region', () => {
    const surakarta = result.items.find((item) => item.regionId === '3372');
    expect(surakarta?.componentScoresDecimal['hlt_stunting_prevalence']).toBeNull();
    expect(surakarta?.effectiveWeightsRegion).toEqual({
      inf_safe_sanitation_pct: 2857,
      inf_safe_water_pct: 2857,
      soc_poverty_rate: 4286,
    });
    // Rebuilt with its own weights the score is 9.57; with the global weights (stunting counted as 0) it would be 6.70.
    const own = (14.24 * 4286 + 0.0 * 2857 + 12.13 * 2857) / 10_000;
    const global = (14.24 * 3000 + 0.0 * 2000 + 12.13 * 2000) / 10_000;
    expect(own).toBeCloseTo(9.57, 2);
    expect(global).toBeCloseTo(6.7, 1);
  });

  it('passes the integrity check, with the partial regions disclosed and no blocking issue', () => {
    const assessment = assess(result, 35, KMS_WEIGHTS);
    expect(blocking(assessment)).toEqual([]);
    expect(assessment.ok).toBe(true);
    expect(assessment.maxScoreError).toBeLessThanOrEqual(0.0051);
    expect(assessment.coverageTiers).toEqual({ complete: 31, partial: 4 });
    const partial = assessment.issues.find((issue) => issue.code === 'PARTIAL_COVERAGE');
    expect(partial?.severity).toBe('disclose');
    expect(partial?.count).toBe(4);
    expect(partial?.examples).toContain('3372');
    expect(assessment.requestedWeightAvailabilityPct).toBe(100);
    // total_regions is the 35 returned, not the national 513 nor the registry of 514.
    expect(codes(assessment)).not.toContain('REPORTED_COUNT_MISMATCH');
    expect(codes(assessment)).not.toContain('REGISTRY_COUNT_MISMATCH');
  });

  it('classifies coverage tiers by each region own coverage_pct', () => {
    const tiers = result.items.map((item) => classifyCoverage(item.coveragePct, result.minCoveragePct));
    expect(tiers.filter((tier) => tier === 'complete')).toHaveLength(31);
    expect(tiers.filter((tier) => tier === 'partial')).toHaveLength(4);
    expect(classifyCoverage(33.3, 70)).toBe('insufficient');
    expect(classifyCoverage(null, 70)).toBe('unreported');
  });
});

describe('Sumut disaster scenario (captured): Padangsidimpuan is insufficient data, never ranked', () => {
  const weights = {
    dis_multihazard_index: 3500,
    dis_flood_hazard_idx: 1500,
    inf_asphalt_road_village_pct: 2500,
    inf_electrification_pct: 2500,
  };
  const result = map(sumut, '12');

  it('lists Kota Padangsidimpuan (33.3%) under insufficient_data, with no rank and no score', () => {
    expect(result.items.some((item) => item.regionId === '1277')).toBe(false);
    expect(result.insufficient).toHaveLength(1);
    expect(result.insufficient[0]).toMatchObject({
      regionId: '1277',
      coveragePct: 33.3,
      reason: 'COVERAGE_BELOW_THRESHOLD',
      componentsUsed: ['inf_electrification_pct'],
    });
    expect(result.totalExcluded).toBe(1);
    expect(result.renormalized).toBe(true);
    expect(result.unavailableIndicatorIds).toEqual(['inf_asphalt_road_village_pct']);
  });

  it('passes: 32 ranked + 1 insufficient account for the 33 registry regions; 75% of the requested weight has data', () => {
    const assessment = assess(result, 33, weights);
    expect(assessment.ok).toBe(true);
    expect(codes(assessment)).not.toContain('REGISTRY_COUNT_MISMATCH');
    expect(assessment.requestedWeightAvailabilityPct).toBe(75);
  });

  it('blocks if the same region were ranked as well (synthetic, derived from this capture)', () => {
    const tampered = clone(sumut) as {
      data: { regions: Record<string, unknown>[]; insufficient_data: Record<string, unknown>[] };
    };
    const ranked = tampered.data.regions[0];
    if (!ranked) throw new Error('no ranked row');
    tampered.data.regions.push({ ...ranked, region_id: '1277', region_name: 'Kota Padangsidimpuan' });
    const assessment = assess(map(tampered, '12'), 33, weights);
    expect(blocking(assessment)).toContain('INSUFFICIENT_REGION_RANKED');
  });

  it('rejects an insufficient_data row that carries a rank (synthetic, derived from this capture)', () => {
    const tampered = clone(sumut) as { data: { insufficient_data: Record<string, unknown>[] } };
    const row = tampered.data.insufficient_data[0];
    if (!row) throw new Error('no insufficient row');
    row['rank'] = 33;
    expect(() => map(tampered, '12')).toThrow(/carries a rank or a score/);
  });
});

describe('National kemiskinan-stunting (captured, 513 ranked + 1 insufficient)', () => {
  const result = map(nationalKms);

  it('is sound: ties keep the server rank (145, 145, 145, then 148), nothing is re-ranked', () => {
    const assessment = assess(result, 514, KMS_WEIGHTS);
    expect(assessment.ok).toBe(true);
    const wireRanks = nationalKms.data.regions.map((row) => row.rank);
    expect(result.items.map((item) => item.rankPosition)).toEqual(wireRanks);
    const ranks = result.items.map((item) => item.rankPosition);
    expect(ranks.filter((rank) => rank === 145)).toHaveLength(3);
    expect(ranks[ranks.indexOf(145) + 3]).toBe(148);
    expect(result.items.every((item) => item.rankPosition === item.nationalRank)).toBe(true);
  });

  it('keeps an observed true zero as "0", which is a valid score and not a missing one', () => {
    const zero = result.items.find((item) => item.regionId === '6271');
    expect(zero?.componentScoresDecimal['inf_safe_water_pct']).toBe('0');
    expect(zero?.componentsUsed).toContain('inf_safe_water_pct');
  });

  it('lists Kabupaten Puncak (50%) as insufficient and discloses the IMPUTED_PROVINCE region (9507)', () => {
    expect(result.insufficient.map((region) => region.regionId)).toEqual(['9405']);
    const assessment = assess(result, 514, KMS_WEIGHTS);
    const imputed = assessment.issues.find((issue) => issue.code === 'IMPUTED_PROVINCE_DATA');
    expect(imputed).toMatchObject({ severity: 'disclose', count: 1, examples: ['9507'] });
    // Imputation is separate from completeness: the same region is a full 100%-coverage row.
    const row = result.items.find((item) => item.regionId === '9507');
    expect(row?.qualityFlags?.['inf_safe_water_pct']).toBe('IMPUTED_PROVINCE');
    expect(classifyCoverage(row?.coveragePct ?? null, 70)).toBe('complete');
  });
});

describe('National pendidikan 3T (captured): the backend ranks it although the preset is not rankable', () => {
  const result = map(nationalEdu);

  it('is held by the Nusa Matra frontend policy: only 45% of the requested weight has data', () => {
    const assessment = assess(result, 514, EDU_WEIGHTS);
    expect(assessment.requestedWeightAvailabilityPct).toBe(45);
    expect(assessment.ok).toBe(false);
    expect(blocking(assessment)).toEqual(['REQUESTED_WEIGHT_AVAILABILITY_LOW']);
    const policy = assessment.issues.find((issue) => issue.code === 'REQUESTED_WEIGHT_AVAILABILITY_LOW');
    expect(policy?.message).toMatch(/Kebijakan antarmuka Nusa Matra \(bukan aturan Data Hub\)/);
  });

  it('is held by the Data Hub verdict when the weights equal the preset marked rankable = false', () => {
    const assessment = assess(result, 514, EDU_WEIGHTS, false);
    expect(blocking(assessment)).toContain('PRESET_NOT_RANKABLE');
    expect(assessment.ok).toBe(false);
  });

  it('shows each region at 100% own coverage yet every region has an IMPUTED_PROVINCE component', () => {
    expect(result.items.every((item) => item.coveragePct === 100)).toBe(true);
    const assessment = assess(result, 514, EDU_WEIGHTS);
    expect(assessment.issues.find((issue) => issue.code === 'IMPUTED_PROVINCE_DATA')?.count).toBe(514);
    // The per-region arithmetic itself is sound: the block is about the request, not the scores.
    expect(codes(assessment)).not.toContain('SCORE_MISMATCH');
  });

  it('turns the policy off only when asked to (it is a product policy, not a data rule)', () => {
    const input = integrityInputFromResult(result, 514, EDU_WEIGHTS);
    expect(assessCompositeIntegrity({ ...input, minRequestedWeightPct: null }).ok).toBe(true);
  });
});

describe('National HDI (captured): 3 regions at 75% coverage', () => {
  it('is sound with three partial regions disclosed', () => {
    const result = map(nationalHdi);
    const weights = {
      soc_hdi: 2500,
      dis_multihazard_index: 2500,
      edu_expected_years_schooling: 2500,
      hlt_life_expectancy: 2500,
    };
    const assessment = assess(result, 514, weights);
    expect(assessment.ok).toBe(true);
    expect(assessment.coverageTiers.partial).toBe(3);
    expect(result.items.at(-1)?.rankPosition).toBeLessThanOrEqual(514);
  });
});

describe('fail-closed on contradictions (synthetic, derived in memory from the Jateng capture)', () => {
  type Tamperable = { data: Record<string, unknown> & { regions: Record<string, unknown>[] } };
  const run = (change: (copy: Tamperable) => void) => {
    const copy = clone(jateng) as unknown as Tamperable;
    change(copy);
    return assess(map(copy, '33'), 35, KMS_WEIGHTS);
  };
  const rowOf = (copy: Tamperable, regionId: string) => {
    const row = copy.data.regions.find((candidate) => candidate['region_id'] === regionId);
    if (!row) throw new Error(`no row ${regionId}`);
    return row;
  };

  it('a score that does not follow from its components and region weights', () => {
    expect(blocking(run((copy) => (rowOf(copy, '3372')['composite_score'] = 11.57)))).toContain(
      'SCORE_MISMATCH',
    );
  });

  it('a region weight set that does not sum to 10 000, or that is the global one for a partial region', () => {
    expect(
      blocking(
        run((copy) => {
          (rowOf(copy, '3372')['effective_weights_region'] as Record<string, number>)['soc_poverty_rate'] =
            4285;
        }),
      ),
    ).toContain('REGION_WEIGHTS_NOT_100_PERCENT');
    expect(
      blocking(
        run((copy) => {
          rowOf(copy, '3372')['effective_weights_region'] = clone(KMS_WEIGHTS);
        }),
      ),
    ).toContain('MISSING_COMPONENT');
  });

  it('a missing region weight map on a v2.1 response', () => {
    expect(blocking(run((copy) => delete rowOf(copy, '3307')['effective_weights_region']))).toContain(
      'REGION_WEIGHTS_MISSING',
    );
  });

  it('a score direction other than higher_is_need, or none at all in LIVE', () => {
    expect(blocking(run((copy) => (copy.data['score_direction'] = 'higher_is_better')))).toContain(
      'SCORE_DIRECTION_MISMATCH',
    );
    const missing = clone(jateng) as unknown as Tamperable;
    delete missing.data['score_direction'];
    for (const row of missing.data.regions) delete row['effective_weights_region'];
    expect(blocking(assess(map(missing, '33'), 35, KMS_WEIGHTS))).toContain('SCORE_DIRECTION_UNREPORTED');
  });

  it('a count, rank or coverage that contradicts the rows', () => {
    expect(blocking(run((copy) => (copy.data['total_regions'] = 513)))).toContain('REPORTED_COUNT_MISMATCH');
    expect(blocking(run((copy) => (rowOf(copy, '3372')['national_rank'] = 20)))).toContain(
      'NATIONAL_RANK_INCONSISTENT',
    );
    expect(blocking(run((copy) => (rowOf(copy, '3372')['coverage_pct'] = 85)))).toContain(
      'COVERAGE_MISMATCH',
    );
    expect(blocking(run((copy) => (copy.data['total_eligible_national'] = 20)))).toContain(
      'ELIGIBLE_COUNT_INCONSISTENT',
    );
  });

  it('a region ranked below the backend threshold (its own coverage under min_coverage_pct)', () => {
    expect(
      blocking(
        run((copy) => {
          copy.data['min_coverage_pct'] = 80;
        }),
      ),
    ).toContain('RANKED_BELOW_THRESHOLD');
  });

  it('a component list that disagrees with the null scores', () => {
    expect(
      blocking(
        run((copy) => {
          rowOf(copy, '3372')['missing_indicators'] = [];
        }),
      ),
    ).toContain('REGION_COMPONENTS_INCONSISTENT');
  });
});

describe('component direction under higher_is_need, on the captured production values', () => {
  const national = map(nationalKms);
  const reference = (values: typeof valuesPoverty, flagOf?: (flag: string) => string) =>
    Object.fromEntries(
      Object.entries(values.data.values_by_region).map(([regionId, cell]) => [
        regionId,
        { raw: cell.raw, normalized: cell.norm, qualityFlag: flagOf ? flagOf(cell.flag) : cell.flag },
      ]),
    );
  const componentsOf = (indicatorId: string) =>
    Object.fromEntries(
      national.items.map((item) => {
        const score = item.componentScoresDecimal[indicatorId];
        return [item.regionId, score === null || score === undefined ? null : Number(score)];
      }),
    );
  const check = (
    id: string,
    polarity: string,
    values: typeof valuesPoverty,
    overrides: Partial<Parameters<typeof checkComponentDirection>[0]> = {},
  ) =>
    checkComponentDirection({
      polarity,
      components: componentsOf(id),
      reference: reference(values),
      compareToPublished: true,
      ...overrides,
    });

  it('all VERIFIED (poverty, negative polarity): every region follows the order and equals the published norm', () => {
    expect(check('soc_poverty_rate', 'negative', valuesPoverty)).toEqual({
      status: 'consistent',
      checked: 513,
      imputedChecked: 0,
    });
  });

  it('all VERIFIED (HDI, positive polarity): need falls as HDI rises', () => {
    const hdi = map(nationalHdi);
    const components = Object.fromEntries(
      hdi.items.map((item) => [item.regionId, Number(item.componentScoresDecimal['soc_hdi'])]),
    );
    const verdict = checkComponentDirection({
      polarity: 'positive',
      components,
      reference: reference(valuesHdi),
      compareToPublished: true,
    });
    expect(verdict.status).toBe('consistent');
  });

  it('mixed quality (safe water: 512 VERIFIED + Lanny Jaya IMPUTED_PROVINCE): the estimate is named, not hidden, and the indicator is only partially verified', () => {
    const verdict = check('inf_safe_water_pct', 'positive', valuesWater);
    expect(verdict.status).toBe('partial');
    if (verdict.status !== 'partial') return;
    // Raw 32.89 gets need score 100 although 31.88 (VERIFIED, region 9506) gets 80.08 and 32.97 (9405) gets 78.79.
    expect(verdict.unverified).toEqual([{ regionId: '9507', raw: 32.89, score: 100 }]);
    expect(verdict.checked).toBe(512);
    expect(verdict.reason).toMatch(/1 nilai estimasi tingkat provinsi tidak mengikuti urutan/);
    const cells = valuesWater.data.values_by_region;
    expect(cells['9506']).toMatchObject({ raw: 31.88, norm: 80.08, flag: 'VERIFIED' });
    expect(cells['9405']).toMatchObject({ raw: 32.97, norm: 78.79, flag: 'VERIFIED' });
    expect(cells['9507']).toMatchObject({ raw: 32.89, norm: 100, flag: 'IMPUTED_PROVINCE' });
  });

  it('mixed quality: an imputed observation that DOES follow the order is verified, not skipped (synthetic: 9507 given the min-max score 78.89)', () => {
    const fits = structuredClone<typeof valuesWater>(valuesWater);
    fits.data.values_by_region['9507'].norm = 78.89;
    const components = { ...componentsOf('inf_safe_water_pct'), '9507': 78.89 };
    const verdict = check('inf_safe_water_pct', 'positive', fits, { components });
    expect(verdict).toEqual({ status: 'consistent', checked: 513, imputedChecked: 1 });
  });

  it('VERIFIED observations stay fully validated: one VERIFIED region out of order fails the indicator (synthetic: 9506 given 20)', () => {
    const tampered = { ...componentsOf('inf_safe_water_pct'), '9506': 20 };
    // Without the published-score comparison, so only the raw-to-score order can catch it.
    const verdict = check('inf_safe_water_pct', 'positive', valuesWater, {
      components: tampered,
      compareToPublished: false,
    });
    expect(verdict.status).toBe('inconsistent');
    if (verdict.status === 'inconsistent') expect(verdict.examples).toContain('9303');
    // And with it, the component no longer equals the published score either.
    expect(check('inf_safe_water_pct', 'positive', valuesWater, { components: tampered }).status).toBe(
      'inconsistent',
    );
  });

  it('an imputed observation is still compared with its published score (synthetic: 9507 component changed to 90)', () => {
    const tampered = { ...componentsOf('inf_safe_water_pct'), '9507': 90 };
    const verdict = check('inf_safe_water_pct', 'positive', valuesWater, { components: tampered });
    expect(verdict).toMatchObject({ status: 'inconsistent', examples: ['9507'] });
  });

  it('DERIVED observations are independent: validated in full, so an out-of-order one fails (synthetic flags on the poverty values)', () => {
    const derived = reference(valuesPoverty, () => 'DERIVED');
    const ok = checkComponentDirection({
      polarity: 'negative',
      components: componentsOf('soc_poverty_rate'),
      reference: derived,
      compareToPublished: true,
    });
    expect(ok).toEqual({ status: 'consistent', checked: 513, imputedChecked: 0 });
    const broken = checkComponentDirection({
      polarity: 'negative',
      components: { ...componentsOf('soc_poverty_rate'), '1101': 100 },
      reference: derived,
      compareToPublished: false,
    });
    expect(broken.status).toBe('inconsistent');
  });

  it('no independently testable observation (every value IMPUTED_PROVINCE): explicitly unverified, never consistent (synthetic flags on the poverty values)', () => {
    const allImputed = reference(valuesPoverty, () => 'IMPUTED_PROVINCE');
    const verdict = checkComponentDirection({
      polarity: 'negative',
      components: componentsOf('soc_poverty_rate'),
      reference: allImputed,
      compareToPublished: true,
    });
    expect(verdict.status).toBe('unverified');
    if (verdict.status === 'unverified') {
      expect(verdict.imputedCount).toBe(513);
      expect(verdict.reason).toMatch(/tidak dapat diverifikasi secara independen/);
    }
    // Estimates that contradict each other are still caught.
    const broken = checkComponentDirection({
      polarity: 'negative',
      components: { ...componentsOf('soc_poverty_rate'), '1101': 100 },
      reference: allImputed,
      compareToPublished: false,
    });
    expect(broken.status).toBe('inconsistent');
  });

  it('flags the pre-v2.1 orientation (score falls as poverty rises) as inconsistent with higher_is_need', () => {
    const flipped = Object.fromEntries(
      Object.entries(componentsOf('soc_poverty_rate')).map(([id, score]) => [
        id,
        score === null ? null : 100 - score,
      ]),
    );
    const verdict = checkComponentDirection({
      polarity: 'negative',
      components: flipped,
      reference: Object.fromEntries(
        Object.entries(reference(valuesPoverty)).map(([id, ref]) => [id, { raw: ref.raw, normalized: null }]),
      ),
      compareToPublished: false,
    });
    expect(verdict.status).toBe('inconsistent');
  });
});

describe('composite integrity stays active for imputed observations (synthetic tamper of the captured national composite)', () => {
  const tamper = (change: (row: Record<string, unknown>) => void) => {
    const copy = clone(nationalKms) as unknown as { data: { regions: Record<string, unknown>[] } };
    const row = copy.data.regions.find((candidate) => candidate['region_id'] === '9507');
    if (!row) throw new Error('no 9507');
    change(row);
    return assess(map(copy), 514, KMS_WEIGHTS);
  };
  const imputedRow = nationalKms.data.regions.find((row) => row.region_id === '9507');

  it('the untouched capture passes, with the imputed region disclosed', () => {
    const assessment = assess(map(nationalKms), 514, KMS_WEIGHTS);
    expect(assessment.ok).toBe(true);
    expect(imputedRow?.quality_flags.inf_safe_water_pct).toBe('IMPUTED_PROVINCE');
  });

  it('blocks a changed imputed component score: the composite no longer follows from it', () => {
    const assessment = tamper((row) => {
      (row['component_scores'] as Record<string, number>)['inf_safe_water_pct'] = 90;
    });
    expect(blocking(assessment)).toContain('SCORE_MISMATCH');
  });

  it('blocks a changed region weight of the imputed component, whether or not the total stays 10 000', () => {
    const lowered = tamper((row) => {
      (row['effective_weights_region'] as Record<string, number>)['inf_safe_water_pct'] = 1900;
    });
    expect(blocking(lowered)).toContain('REGION_WEIGHTS_NOT_100_PERCENT');
    const shifted = tamper((row) => {
      const weights = row['effective_weights_region'] as Record<string, number>;
      weights['inf_safe_water_pct'] = 1900;
      weights['soc_poverty_rate'] = 3100;
    });
    expect(blocking(shifted)).toContain('REGION_WEIGHTS_INCONSISTENT');
  });

  it('blocks a missing imputed component (null is never 0)', () => {
    const assessment = tamper((row) => {
      (row['component_scores'] as Record<string, number | null>)['inf_safe_water_pct'] = null;
    });
    expect(blocking(assessment)).toContain('MISSING_COMPONENT');
  });
});

// ---------------------------------------------------------------------------------------------
// Data Hub v2.2, CAPTURED FROM PRODUCTION 2026-10-24 (src/services/api/__fixtures__/live-v2.2).
// ---------------------------------------------------------------------------------------------

describe('v2.2 captures: the P0 guard stays in place and lets the corrected data through', () => {
  const META_22: AdaptedResponseMeta = {
    ...META,
    snapshotId: '2026.10.0-live-62354dfad392d985',
    contentSha256: '62354dfad392d985168450ac670b6c647ab097e800ee023768d5858387a984b5',
    snapshotImmutable: true,
    snapshotReproducible: true,
    methodologyVersion: 'v2.2-minmax-full-range',
  };
  const result = mapCompositeQueryData(nationalKms22.data, META_22, null);
  const integrity = assess(result, null, KMS_WEIGHTS);

  it('national kemiskinan + stunting passes the integrity check, with Lanny Jaya at 80.18, rank 3', () => {
    expect(blocking(integrity)).toEqual([]);
    expect(integrity.ok).toBe(true);
    const lanny = result.items.find((item) => item.regionId === '9507');
    expect(lanny).toMatchObject({ compositeScoreDecimal: '80.18', rankPosition: 3 });
  });

  it('the corrected water score of Lanny Jaya (32.89 -> 78.89, IMPUTED_PROVINCE) no longer withholds the ranking', () => {
    const water = mapIndicatorValuesData(valuesWater22.data, META_22);
    const checks = checkRankingDirections(
      result,
      ['inf_safe_water_pct'],
      () => 'positive',
      () => water,
    );
    expect(checks[0]?.verdict.status).toBe('consistent');
    expect(checks[0]?.nationalVerdict?.status).toBe('consistent');
    expect(
      assessDirectionImpact({
        checks,
        rows: impactRowsOf(result),
        weightsUsed: integrity.weightsUsed,
        filterProvinceId: null,
      }),
    ).toEqual({ status: 'clear' });
  });

  it('the same guard still withholds the ranking on the v2.1 capture (raw 32.89 published as 100)', () => {
    const old = map(nationalKms);
    const water = mapIndicatorValuesData(valuesWater.data, META);
    const checks = checkRankingDirections(
      old,
      ['inf_safe_water_pct'],
      () => 'positive',
      () => water,
    );
    const impact = assessDirectionImpact({
      checks,
      rows: impactRowsOf(old),
      weightsUsed: assess(old, null, KMS_WEIGHTS).weightsUsed,
      filterProvinceId: null,
    });
    expect(impact.status).toBe('ranking_withheld');
  });

  it('values from another snapshot than the ranking are not used as evidence either way', () => {
    const water = mapIndicatorValuesData(valuesWater.data, META); // v2.1 snapshot id
    const [check] = checkRankingDirections(
      result,
      ['inf_safe_water_pct'],
      () => 'positive',
      () => water,
    );
    expect(check?.verdict).toMatchObject({ status: 'unverifiable' });
  });

  it('a composite the Data Hub declares not rankable is blocked, quoting its reason', () => {
    const nonRankable = mapCompositeQueryData(nonRankable22.data, META_22, null);
    const verdict = assess(nonRankable, null, {
      dis_multihazard_index: 5000,
      edu_school_travel_time_p90: 5000,
    });
    expect(blocking(verdict)).toContain('COMPOSITE_NOT_RANKABLE');
    const issue = verdict.issues.find((item) => item.code === 'COMPOSITE_NOT_RANKABLE');
    expect(issue?.message).toContain('national weight coverage 50.0% is below the 70% threshold');
  });
});
