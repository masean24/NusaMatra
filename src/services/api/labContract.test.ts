import coverageCapture from './__fixtures__/live-v2.1/indicators_coverage.json';
import jatengCapture from './__fixtures__/live-v2.1/composite_jateng_kemiskinan_stunting.json';
import nationalKmsCapture from './__fixtures__/live-v2.1/composite_national_kemiskinan_stunting.json';
import nationalHdiCapture from './__fixtures__/live-v2.1/composite_national_hdi.json';
import nationalEduCapture from './__fixtures__/live-v2.1/composite_national_pendidikan_3t.json';
import presetsCapture from './__fixtures__/live-v2.1/composite_presets.json';
import sumutCapture from './__fixtures__/live-v2.1/composite_sumut_bencana.json';
import { buildPool, compositeResponse, presetsResponse } from '@/test/labContractMock';
import { ApiError } from './apiError';
import { mapCompositeQueryData } from './domainMappers';
import { mapCompositePresetsData, mapIndicatorCoverageData } from './labContract';
import type { AdaptedResponseMeta } from './wireTypes';

const meta: AdaptedResponseMeta = {
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

describe('mapIndicatorCoverageData (captured production coverage, 2026-10-23)', () => {
  it('reads availability and coverage per indicator: 25 of 33 indicators hold data', () => {
    const coverage = mapIndicatorCoverageData(coverageCapture.data, meta);
    expect(coverage.totalIndicators).toBe(33);
    expect(Object.values(coverage.byIndicator).filter((entry) => entry.available)).toHaveLength(25);
    expect(coverage.byIndicator['soc_poverty_rate']).toMatchObject({ available: true, coverageCount: 514 });
    expect(coverage.byIndicator['edu_damaged_classrooms_pct']).toMatchObject({
      available: false,
      coverageCount: 0,
    });
  });

  it('rejects an entry whose availability contradicts its count, or has no count', () => {
    const contradictory = { indicators: { a: { available: true, coverage_count: 0 } } };
    expect(() => mapIndicatorCoverageData(contradictory, meta)).toThrow(ApiError);
    expect(() => mapIndicatorCoverageData({ indicators: { a: { available: false } } }, meta)).toThrow(
      ApiError,
    );
    expect(() => mapIndicatorCoverageData({ data: [] }, meta)).toThrow(ApiError);
  });
});

describe('mapCompositePresetsData (captured production presets, 2026-10-23)', () => {
  // `data` is a direct array in production.
  const presets = mapCompositePresetsData(presetsCapture.data, meta);

  it('reads the four presets with their national availability', () => {
    expect(Array.isArray(presetsCapture.data)).toBe(true);
    expect(presets.rejectedCount).toBe(0);
    expect(presets.presets.map((preset) => preset.presetId)).toEqual([
      'bencana_infrastruktur',
      'kemiskinan_stunting',
      'pendidikan_daerah_3t',
      'indeks_pembangunan_terpadu',
    ]);
    const bencana = presets.presets[0]?.availability;
    expect(bencana).toMatchObject({
      rankable: true,
      requestedWeightAvailabilityPct: 75,
      unavailableIndicators: ['inf_asphalt_road_village_pct'],
      // National renormalisation metadata is kept: 3500/1500/2500 of the 7500 available, in 10 000 bps.
      effectiveWeightsBasisPoints: {
        dis_multihazard_index: 4667,
        dis_flood_hazard_idx: 2000,
        inf_electrification_pct: 3333,
      },
    });
    expect(presets.presets[1]?.availability).toMatchObject({
      rankable: true,
      requestedWeightAvailabilityPct: 100,
    });
  });

  it('marks the education 3T preset as not rankable at 45 % of its weight', () => {
    const education = presets.presets.find((preset) => preset.presetId === 'pendidikan_daerah_3t');
    expect(education?.availability).toMatchObject({
      rankable: false,
      requestedWeightAvailabilityPct: 45,
      unavailableIndicators: ['edu_damaged_classrooms_pct', 'edu_student_teacher_ratio_sd'],
    });
    expect(education?.label).toBe('Pemerataan Kualitas Pendidikan Daerah 3T');
  });

  it('keeps presets whose weights are integers summing to 10 000 and counts the rest (synthetic invalid preset added)', () => {
    const withBad = mapCompositePresetsData(presetsResponse(presetsCapture).data, meta);
    expect(withBad.presets).toHaveLength(4);
    expect(withBad.rejectedCount).toBe(1);
  });

  it('accepts the list under "presets" and the alternative key names; availability stays null when not reported', () => {
    const mapped = mapCompositePresetsData(
      { presets: [{ preset_id: 'p', label: 'P', weights_basis_points: { a: 10000, b: 0 } }] },
      meta,
    );
    expect(mapped.presets[0]).toEqual({
      presetId: 'p',
      label: 'P',
      description: null,
      category: null,
      targetFocus: null,
      weightsBasisPoints: { a: 10000 },
      availability: null,
    });
  });

  it('rejects fractional or negative weights and a payload that is not a list', () => {
    const bad = mapCompositePresetsData(
      [
        { id: 'x', name: 'X', weights: { a: 9999.5, b: 0.5 } },
        { id: 'y', name: 'Y', weights: { a: 11000, b: -1000 } },
      ],
      meta,
    );
    expect(bad).toEqual({ presets: [], rejectedCount: 2 });
    expect(() => mapCompositePresetsData({}, meta)).toThrow(ApiError);
  });

  it('rejects a preset whose availability contradicts itself (synthetic, derived from the education preset)', () => {
    const education = structuredClone(presetsCapture.data[2]) as unknown as Record<string, unknown> & {
      availability: Record<string, unknown>;
    };
    const attempts: Record<string, unknown>[] = [
      { ...education, availability: { ...education.availability, rankable: 'no' } },
      { ...education, availability: { ...education.availability, coverage_weight_pct: 95 } },
      {
        ...education,
        availability: {
          ...education.availability,
          effective_weights: { edu_mean_years_schooling: 9000, inf_internet_household_pct: 500 },
        },
      },
      { ...education, availability: { ...education.availability, unavailable_indicators: [] } },
      { ...education, availability: 'rankable' },
    ];
    const result = mapCompositePresetsData(attempts, meta);
    expect(result.presets).toHaveLength(0);
    expect(result.rejectedCount).toBe(attempts.length);
  });
});

describe('mapCompositeQueryData with the v2.1 fields', () => {
  it('reads the production envelope and every per-region field (captured Jateng)', () => {
    const result = mapCompositeQueryData(jatengCapture.data, meta, '33');
    expect(result).toMatchObject({
      scoreDirection: 'higher_is_need',
      totalRegions: 35,
      totalEligibleNational: 513,
      totalExcluded: 0,
      minCoveragePct: 70,
      minComponents: 2,
      renormalized: false,
      unavailableIndicatorIds: [],
      filterProvinceId: '33',
    });
    expect(result.items[0]).toMatchObject({
      regionId: '3307',
      rankPosition: 1,
      nationalRank: 80,
      coveragePct: 100,
      componentsUsed: [
        'hlt_stunting_prevalence',
        'inf_safe_sanitation_pct',
        'inf_safe_water_pct',
        'soc_poverty_rate',
      ],
      missingIndicators: [],
      qualityFlags: { soc_poverty_rate: 'VERIFIED' },
    });
  });

  it('leaves the v2.1 fields null for a response that does not report them', () => {
    const result = mapCompositeQueryData(
      {
        total_regions: 1,
        weights_basis_points: { a: 10000 },
        regions: [{ region_id: '1', region_name: 'Wilayah', composite_score: 50, rank: 1 }],
      },
      meta,
    );
    expect(result).toMatchObject({
      scoreDirection: null,
      totalEligibleNational: null,
      totalExcluded: null,
      insufficient: [],
    });
    expect(result.items[0]).toMatchObject({
      nationalRank: null,
      coveragePct: null,
      effectiveWeightsRegion: null,
      qualityFlags: null,
    });
  });

  it('rejects a v2.1 field that is present with the wrong type, rather than guessing', () => {
    const bad = (change: (copy: { data: Record<string, unknown>; row: Record<string, unknown> }) => void) => {
      const copy = structuredClone(jatengCapture.data) as unknown as Record<string, unknown> & {
        regions: Record<string, unknown>[];
      };
      const row = copy.regions[0] ?? {};
      change({ data: copy, row });
      return () => mapCompositeQueryData(copy, meta, '33');
    };
    expect(bad(({ row }) => (row['national_rank'] = 'satu'))).toThrow(ApiError);
    expect(bad(({ row }) => (row['coverage_pct'] = 140))).toThrow(ApiError);
    expect(bad(({ row }) => (row['effective_weights_region'] = { soc_poverty_rate: 'banyak' }))).toThrow(
      ApiError,
    );
    expect(bad(({ row }) => (row['quality_flags'] = ['VERIFIED']))).toThrow(ApiError);
    expect(bad(({ data }) => (data['insufficient_data'] = 'tidak ada'))).toThrow(ApiError);
    expect(bad(({ data }) => (data['score_direction'] = 7))).toThrow(ApiError);
  });
});

describe('mock fidelity: the test simulator reproduces the captured production composites', () => {
  // These guard the mock itself. They compare the simulator with the real 2026-10-23 responses.
  const pool = buildPool([nationalKmsCapture, nationalHdiCapture, nationalEduCapture]);
  const kmsWeights = jatengCapture.data.weights_basis_points;

  it('Jateng: the same 35 regions, scores, ranks, national ranks and region weights', () => {
    const simulated = compositeResponse(pool, { weights: kmsWeights, filter_province_id: '33' }) as {
      data: typeof jatengCapture.data;
    };
    const pick = (data: typeof jatengCapture.data) =>
      data.regions.map((row) => [
        row.region_id,
        row.composite_score,
        row.rank,
        row.national_rank,
        row.coverage_pct,
        row.effective_weights_region,
      ]);
    expect(pick(simulated.data)).toEqual(pick(jatengCapture.data));
    expect(simulated.data.total_regions).toBe(35);
    expect(simulated.data.total_eligible_national).toBe(513);
  });

  it('National: the same 513 regions within rounding of the 2-decimal components, and the one insufficient region (Puncak, 50 %)', () => {
    const simulated = compositeResponse(pool, { weights: kmsWeights, filter_province_id: null }) as {
      data: typeof nationalKmsCapture.data;
    };
    const real = new Map(nationalKmsCapture.data.regions.map((row) => [row.region_id, row.composite_score]));
    expect(simulated.data.regions).toHaveLength(513);
    // The Data Hub works from unrounded components; the mock only has the 2-decimal ones.
    for (const row of simulated.data.regions) {
      expect(Math.abs(row.composite_score - (real.get(row.region_id) ?? Number.NaN))).toBeLessThanOrEqual(
        0.011,
      );
    }
    expect(simulated.data.insufficient_data.map((row) => [row.region_id, row.coverage_pct])).toEqual([
      ['9405', 50],
    ]);
  });

  it('Pendidikan 3T: renormalises over the two indicators that have data', () => {
    const simulated = compositeResponse(pool, {
      weights: nationalEduCapture.data.weights_basis_points,
      filter_province_id: null,
    }) as { data: typeof nationalEduCapture.data };
    expect(simulated.data.effective_weights).toEqual(nationalEduCapture.data.effective_weights);
    expect(simulated.data.unavailable_indicators).toEqual(nationalEduCapture.data.unavailable_indicators);
  });

  it('replays a recorded request untouched (Sumut)', () => {
    const body = { weights: sumutCapture.data.weights_basis_points, filter_province_id: '12' };
    expect(compositeResponse(pool, body, [{ body, response: sumutCapture }])).toBe(sumutCapture);
  });
});
