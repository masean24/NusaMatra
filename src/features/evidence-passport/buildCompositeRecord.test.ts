import valuesPoverty from '@/services/api/__fixtures__/live-v2.1/values_soc_poverty_rate.json';
import { buildCompositeRecord } from './buildCompositeRecord';
import type { CompositeEvidenceRecord } from './compositeTypes';
import {
  COMPOSITE_PATH,
  JATENG_WEIGHTS,
  PENDIDIKAN_3T_WEIGHTS,
  capturedNationalHdi,
  capturedNationalKms,
  capturedJateng,
  capturedSumut,
  captured3T,
  DEMO_COMPOSITE_WEIGHTS,
  capturedDemoComposite,
  loadCompositeSources,
  withCapturedWater,
} from './evidenceTestKit';
import type { LabEvidenceQuery } from './evidenceQuery';

const NATIONAL_WEIGHTS = JATENG_WEIGHTS;
const HDI_WEIGHTS = {
  soc_hdi: 2500,
  dis_multihazard_index: 2500,
  edu_expected_years_schooling: 2500,
  hlt_life_expectancy: 2500,
};

async function build(
  bodies: Record<string, unknown>,
  weights: Readonly<Record<string, number>>,
  options: { provinceId?: string | null; focusRegionId?: string | null; snapshotId?: string | null } = {},
): Promise<CompositeEvidenceRecord> {
  const query: LabEvidenceQuery = {
    kind: 'lab',
    mode: 'LIVE',
    snapshotId: options.snapshotId === undefined ? '2026.10.0-official-live' : options.snapshotId,
    weights,
    provinceId: options.provinceId ?? null,
    focusRegionId: options.focusRegionId ?? null,
  };
  return buildCompositeRecord(
    query,
    await loadCompositeSources(bodies, 'LIVE', weights, options.provinceId ?? null),
  );
}

describe('buildCompositeRecord, CAPTURED LIVE responses', () => {
  it('Jawa Tengah: shows the ranking, names the matching preset and reads the source from the responses', async () => {
    const record = await build(capturedJateng(), JATENG_WEIGHTS, { provinceId: '33' });
    expect(record).toMatchObject({
      ranking: 'SHOWN',
      withheldReason: null,
      serverRankedCount: 35,
      source: { dataMode: 'LIVE', snapshotId: '2026.10.0-official-live', consistent: true },
      scope: { totalRegions: 35, totalEligibleNational: 513, scoreDirection: 'higher_is_need' },
      preset: { presetId: 'kemiskinan_stunting', rankable: true },
    });
    expect(record.integrity.ok).toBe(true);
    expect(record.rows).toHaveLength(35);
    expect(record.linkWarnings).toEqual([]);
  });

  it('Jawa Tengah: Wonosobo is rank 1 at 100% and Surakarta is partial at 70% with its own weights', async () => {
    const record = await build(capturedJateng(), JATENG_WEIGHTS, { provinceId: '33', focusRegionId: '3372' });
    const wonosobo = record.rows.find((row) => row.regionId === '3307');
    expect(wonosobo).toMatchObject({
      rank: 1,
      nationalRank: 80,
      coveragePct: 100,
      tier: 'complete',
      weightsDiffer: false,
    });

    const surakarta = record.rows.find((row) => row.regionId === '3372');
    expect(surakarta).toMatchObject({
      rank: 35,
      nationalRank: 487,
      coveragePct: 70,
      tier: 'partial',
      weightsDiffer: true,
      missingIndicators: ['hlt_stunting_prevalence'],
      isFocus: true,
    });
    expect(surakarta?.effectiveWeightsRegion).toEqual({
      inf_safe_sanitation_pct: 2857,
      inf_safe_water_pct: 2857,
      soc_poverty_rate: 4286,
    });
    const stunting = surakarta?.components.find(
      (component) => component.indicatorId === 'hlt_stunting_prevalence',
    );
    expect(stunting).toMatchObject({ hasScore: false, scoreText: 'tidak tersedia', weightBps: null });
    const water = surakarta?.components.find((component) => component.indicatorId === 'inf_safe_water_pct');
    expect(water).toMatchObject({ hasScore: true, scoreText: '0' });
    expect(record.focus).toMatchObject({ regionId: '3372', status: 'RANKED' });
  });

  it('Sumatera Utara: Padangsidimpuan is only in the insufficient list, with no rank or score', async () => {
    const record = await build(
      capturedSumut(),
      {
        dis_multihazard_index: 3500,
        dis_flood_hazard_idx: 1500,
        inf_asphalt_road_village_pct: 2500,
        inf_electrification_pct: 2500,
      },
      { provinceId: '12', focusRegionId: '1277' },
    );
    expect(record.ranking).toBe('SHOWN');
    expect(record.rows.some((row) => row.regionId === '1277')).toBe(false);
    expect(record.insufficient).toMatchObject([
      { regionId: '1277', coveragePct: 33.3, reason: 'COVERAGE_BELOW_THRESHOLD', isFocus: true },
    ]);
    expect(Object.keys(record.insufficient[0] ?? {})).not.toContain('rank');
    expect(record.focus).toMatchObject({ status: 'NOT_RANKED' });
    expect(record.unavailableIndicatorIds).toEqual(['inf_asphalt_road_village_pct']);
    expect(record.effectiveWeights).toEqual({
      dis_multihazard_index: 4667,
      dis_flood_hazard_idx: 2000,
      inf_electrification_pct: 3333,
    });
  });

  it('national kemiskinan + stunting: keeps tie ranks as sent and keeps imputation apart from coverage', async () => {
    const record = await build(capturedNationalKms(), NATIONAL_WEIGHTS);
    expect(record.ranking).toBe('SHOWN');
    const ranks = record.rows.map((row) => row.rank);
    // Equal scores share a rank, exactly as the Data Hub sent them.
    expect(ranks.length - new Set(ranks).size).toBeGreaterThan(0);

    const imputed = record.rows.filter((row) => row.imputedIndicators.length > 0);
    expect(imputed.map((row) => row.regionId)).toEqual(['9507']);
    // Complete coverage and an estimate from the province are different facts about the same region.
    expect(imputed[0]).toMatchObject({
      coveragePct: 100,
      tier: 'complete',
      imputedIndicators: ['inf_safe_water_pct'],
    });
    expect(imputed[0]?.components.find((c) => c.indicatorId === 'inf_safe_water_pct')?.evidenceClass).toBe(
      'IMPUTED_PROVINCE',
    );
    expect(record.insufficient.map((row) => row.name)).toEqual(['Kabupaten Puncak']);
    expect(record.limitations.join('\n')).toContain('IMPUTED_PROVINCE');
  });

  it('national HDI: partial regions carry their own redistributed weights', async () => {
    const record = await build(capturedNationalHdi(), HDI_WEIGHTS);
    const partial = record.rows.filter((row) => row.tier === 'partial');
    expect(partial).toHaveLength(3);
    for (const row of partial) {
      expect(row.coveragePct).toBe(75);
      expect(row.weightsDiffer).toBe(true);
      expect(Object.values(row.effectiveWeightsRegion ?? {}).reduce((sum, bps) => sum + bps, 0)).toBe(10000);
    }
    expect(record.limitations.join('\n')).toContain('3 wilayah berstatus parsial');
  });
});

describe('buildCompositeRecord, ranking withheld', () => {
  it('Pendidikan 3T: withholds the ranking, keeps no region rows, and records the backend anomaly', async () => {
    const record = await build(captured3T(), PENDIDIKAN_3T_WEIGHTS);
    expect(record).toMatchObject({
      ranking: 'WITHHELD',
      withheldReason: 'INTEGRITY',
      serverRankedCount: 514,
      rows: [],
      insufficient: [],
      preset: { presetId: 'pendidikan_daerah_3t', rankable: false },
    });
    expect(record.integrity.ok).toBe(false);
    const codes = record.integrity.issues.map((issue) => issue.code);
    expect(codes).toContain('PRESET_NOT_RANKABLE');
    expect(codes).toContain('REQUESTED_WEIGHT_AVAILABILITY_LOW');
    const policy = record.integrity.issues.find(
      (issue) => issue.code === 'REQUESTED_WEIGHT_AVAILABILITY_LOW',
    );
    expect(policy).toMatchObject({
      origin: 'policy',
      originLabel: 'Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub)',
    });
    expect(record.integrity.requestedWeightAvailabilityPct).toBe(45);
    expect(record.limitations.join('\n')).toContain('Anomali backend');
    expect(record.limitations.join('\n')).not.toMatch(/lolos/i);
  });

  it('SYNTHETIC: a rank that disagrees with the scores withholds the ranking', async () => {
    const bodies = capturedJateng();
    const composite = bodies[COMPOSITE_PATH] as { data: { regions: { rank: number }[] } };
    // A copy of the captured response with two ranks swapped, built in memory only.
    const [first, second] = composite.data.regions;
    if (first && second) [first.rank, second.rank] = [second.rank, first.rank];
    const record = await build(bodies, JATENG_WEIGHTS, { provinceId: '33' });
    expect(record.ranking).toBe('WITHHELD');
    expect(record.integrity.issues.map((issue) => issue.code)).toContain('RANK_ORDER');
  });

  it('SYNTHETIC: a result for a different versi data than its presets is not shown as one record', async () => {
    const bodies = capturedJateng();
    const presets = bodies['/api/v1/indicators/composite-presets'] as { meta: { snapshot_id: string } };
    presets.meta.snapshot_id = 'another-snapshot';
    const record = await build(bodies, JATENG_WEIGHTS, { provinceId: '33' });
    expect(record).toMatchObject({ ranking: 'WITHHELD', withheldReason: 'MIXED_SOURCES' });
    expect(record.source.consistent).toBe(false);
    expect(record.rows).toEqual([]);
  });
});

describe('buildCompositeRecord, direction checked against CAPTURED source values', () => {
  it('national: withholds the ranking reached by Lanny Jaya, keeps its source facts, and corrects nothing', async () => {
    const record = await build(withCapturedWater(capturedNationalKms()), NATIONAL_WEIGHTS);
    expect(record).toMatchObject({ ranking: 'WITHHELD', withheldReason: 'DIRECTION_ANOMALY' });
    expect(record.rows).toEqual([]);
    expect(record.direction).toMatchObject({
      checked: true,
      anomalies: [{ indicatorId: 'inf_safe_water_pct', regionId: '9507', raw: 32.89, score: 100 }],
      nationalRankWithheld: false,
    });
    // As for every withheld result, no region rows; the server's count, the criteria and their sources stay.
    expect(record.serverRankedCount).toBeGreaterThan(500);
    expect(record.insufficient).toEqual([]);
    expect(record.indicators.map((indicator) => indicator.indicatorId)).toContain('inf_safe_water_pct');
    const limits = record.limitations.join('\n');
    expect(limits).toContain('Peringkat ditahan');
    expect(limits).toContain('nilai mentah 32.89, skor terpublikasi 100');
    expect(limits).toContain('tidak mengoreksi atau menghitung ulang');
  });

  it('Jawa Tengah: shows the provincial ranking as sent, leaves out every national rank, and says why', async () => {
    const plain = await build(capturedJateng(), JATENG_WEIGHTS, { provinceId: '33' });
    const record = await build(withCapturedWater(capturedJateng()), JATENG_WEIGHTS, { provinceId: '33' });
    expect(record).toMatchObject({ ranking: 'SHOWN', withheldReason: null });
    expect(record.direction.nationalRankWithheld).toBe(true);
    // Same rows, same ranks and scores; only the national rank is withheld, never recomputed.
    expect(record.rows.map((row) => [row.regionId, row.rank, row.scoreRaw])).toEqual(
      plain.rows.map((row) => [row.regionId, row.rank, row.scoreRaw]),
    );
    expect(record.rows.every((row) => row.nationalRank === null)).toBe(true);
    expect(plain.rows.some((row) => row.nationalRank !== null)).toBe(true);
    expect(record.limitations.join('\n')).toContain('Peringkat nasional tidak dicantumkan');
  });

  it('SYNTHETIC: verified observations against the catalog direction withhold the ranking as before', async () => {
    // The captured catalog with soc_poverty_rate declared positive, and the captured poverty values.
    const bodies = capturedNationalKms();
    const catalog = bodies['/api/v1/indicators'] as {
      data: Record<string, { indicator_id: string; polarity: string }[]>;
    };
    for (const item of Object.values(catalog.data).flat()) {
      if (item.indicator_id === 'soc_poverty_rate') item.polarity = 'positive';
    }
    bodies['/api/v1/indicators/soc_poverty_rate/values'] = structuredClone(valuesPoverty);
    const record = await build(bodies, NATIONAL_WEIGHTS);
    expect(record).toMatchObject({ ranking: 'WITHHELD', withheldReason: 'DIRECTION_ANOMALY' });
    expect(record.direction.inconsistentIndicatorIds).toEqual(['soc_poverty_rate']);
    expect(record.rows).toEqual([]);
  });

  it('marks a ranking whose weighted directions could not be checked as not fully verified', async () => {
    // No values are loaded for any criterion: insufficient evidence, shown with a limitation, not withheld.
    const record = await build(capturedJateng(), JATENG_WEIGHTS, { provinceId: '33' });
    expect(record.ranking).toBe('SHOWN');
    expect(record.direction.notFullyVerifiedIndicatorIds).toEqual(Object.keys(JATENG_WEIGHTS).sort());
    expect(record.limitations.join('\n')).toContain('bukan sebagai hasil yang terverifikasi penuh');
  });
});

describe('buildCompositeRecord, link context and DEMO', () => {
  it('warns when the versi data in the link differs from the one received', async () => {
    const record = await build(capturedJateng(), JATENG_WEIGHTS, { provinceId: '33', snapshotId: 'old' });
    expect(record.linkWarnings).toMatchObject([{ code: 'SNAPSHOT_CHANGED', severity: 'warning' }]);
  });

  it('CAPTURED DEMO (v0.1): stays DEMO and does not claim a score direction the response never stated', async () => {
    const weights = DEMO_COMPOSITE_WEIGHTS;
    const raw = await loadCompositeSources(capturedDemoComposite(), 'DEMO', weights, null);
    const record = buildCompositeRecord(
      { kind: 'lab', mode: 'DEMO', snapshotId: '2026.10.0-wia-demo', weights },
      raw,
    );
    expect(record.source).toMatchObject({ dataMode: 'DEMO', snapshotId: '2026.10.0-wia-demo' });
    // DEMO is never checked against LIVE source values.
    expect(raw.indicatorValues).toBeNull();
    expect(record.direction).toMatchObject({ checked: false, anomalies: [], nationalRankWithheld: false });
    expect(record.limitations[0]).toContain('data simulasi (DEMO)');
    // v0.1 has no direction, region weights or coverage: they stay unreported, never invented.
    expect(record.scope.scoreDirection).toBeNull();
    expect(record.scoreMeaning).toContain('tidak dinyatakan');
    expect(record.scoreMeaning).not.toContain('prioritas tertinggi');
    expect(record.integrity.issues.map((issue) => issue.code)).toContain('SCORE_DIRECTION_UNREPORTED');
    expect(record.rows[0]).toMatchObject({
      coveragePct: null,
      tier: 'unreported',
      effectiveWeightsRegion: null,
    });
    expect(record.rows[0]?.components.every((component) => component.weightBps === null)).toBe(true);
  });
});
