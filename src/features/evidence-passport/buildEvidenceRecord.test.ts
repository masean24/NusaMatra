import { assessLinkContext, buildEvidenceRecord } from './buildEvidenceRecord';
import {
  capturedDemoBodies,
  capturedLiveBodies,
  indicatorOf,
  loadSources,
  profileIn,
  relabelledProfile,
} from './evidenceTestKit';
import type { EvidenceRecord } from './evidenceTypes';

const REAL_LIVE_CHECKSUM = '60c1d0314914ddca1cb41f13180481aecfdda3cc5e88dd6748e20a007f32325e';

async function liveRecord(
  query: Parameters<typeof buildEvidenceRecord>[0] = { kind: 'wilayah', regionId: '1101' },
): Promise<EvidenceRecord> {
  return buildEvidenceRecord(query, await loadSources(capturedLiveBodies(), 'LIVE', ['1101']));
}

function valueOf(record: EvidenceRecord, indicatorId: string) {
  const value = record.indicators.find((indicator) => indicator.indicatorId === indicatorId)?.values[0];
  if (!value) throw new Error(`No value for ${indicatorId}`);
  return value;
}

describe('buildEvidenceRecord, CAPTURED LIVE region 1101', () => {
  it('reads mode, snapshot and snapshot details from the responses', async () => {
    const { source } = await liveRecord();
    expect(source).toMatchObject({
      dataMode: 'LIVE',
      snapshotId: '2026.10.0-official-live',
      consistent: true,
    });
    expect(source.snapshot).toMatchObject({
      publishedAt: '2026-10-21 17:14:49',
      boundaryVersion: 'BIG-20260601',
      completenessPct: 51.6,
      reportedManifestChecksum: REAL_LIVE_CHECKSUM,
    });
    expect(source.receivedByBrowserAt).not.toBeNull();
  });

  it('classifies every value: IMPUTED_PROVINCE from the flag, DERIVED from the catalog join', async () => {
    const record = await liveRecord();
    expect(record.indicators).toHaveLength(16);
    expect(valueOf(record, 'inf_electrification_pct').evidenceClass).toBe('IMPUTED_PROVINCE');
    expect(valueOf(record, 'inf_safe_water_pct').evidenceClass).toBe('IMPUTED_PROVINCE');
    expect(valueOf(record, 'dis_flood_hazard_idx').evidenceClass).toBe('DERIVED');
    expect(valueOf(record, 'soc_hdi').evidenceClass).toBe('VERIFIED');
    expect(record.coverage[0]?.byClass).toEqual({ VERIFIED: 11, DERIVED: 3, IMPUTED_PROVINCE: 2 });
  });

  it('keeps completeness apart from granularity and lists indicators without a value', async () => {
    const coverage = (await liveRecord()).coverage[0];
    expect(coverage).toMatchObject({
      indicatorsWithValue: 16,
      indicatorsWithoutValue: 17,
      catalogIndicatorCount: 33,
      imputedCount: 2,
    });
    const unavailable = coverage?.missing.find((item) => item.indicatorId === 'hlt_realtime_icu_occupancy');
    expect(unavailable?.reason).toContain('UNAVAILABLE');
  });

  it('gives each value its agency, dataset title from /datasets, year and a safe https link', async () => {
    const record = await liveRecord();
    for (const indicator of record.indicators) {
      const value = indicator.values[0];
      expect(value?.source.agencyCode, indicator.indicatorId).not.toBeNull();
      expect(value?.source.officialUrl, indicator.indicatorId).toMatch(/^https:/);
      expect(value?.referenceYear, indicator.indicatorId).not.toBeNull();
    }
    expect(valueOf(record, 'dis_multihazard_index').source.datasetTitle).toContain('IRBI');
    expect(record.sources.map((source) => source.datasetId)).toEqual([
      'bnpb_irbi_2024',
      'bps_susenas_sakernas_2025',
      'kemenkes_ski_2023',
    ]);
    expect(record.sources.find((source) => source.datasetId === 'kemenkes_ski_2023')?.years).toEqual([2023]);
  });

  it('says the definition is absent when the catalog only repeats the name', async () => {
    const record = await liveRecord();
    expect(record.indicators.every((indicator) => indicator.definition === null)).toBe(true);
  });

  it('states what the record cannot claim', async () => {
    const { limitations } = await liveRecord();
    const text = limitations.join('\n');
    expect(text).toContain('2 nilai diimputasi');
    expect(text).toContain('17 indikator tidak memiliki nilai');
    expect(text).toContain('2023 sampai 2025');
    expect(text).toContain('tidak memuat bobot');
    expect(text).not.toContain('simulasi');
  });

  it('builds a record for a limited indicator list and names a requested indicator the snapshot lacks', async () => {
    const record = await liveRecord({
      kind: 'wilayah',
      regionId: '1101',
      indicatorIds: ['soc_hdi', 'edu_school_travel_time_p90', 'tidak_ada_id'],
    });
    expect(record.indicators.map((indicator) => indicator.indicatorId)).toEqual(['soc_hdi']);
    const reasons = record.coverage[0]?.missing.map((item) => item.indicatorId);
    expect(reasons).toEqual(['edu_school_travel_time_p90', 'tidak_ada_id']);
  });
});

describe('buildEvidenceRecord, CAPTURED DEMO region 3201', () => {
  it('is DEMO throughout: every value is DEMO_EXAMPLE and a placeholder checksum is never shown', async () => {
    const raw = await loadSources(capturedDemoBodies(), 'DEMO', ['3201']);
    const record = buildEvidenceRecord({ kind: 'wilayah', regionId: '3201' }, raw);

    expect(record.source).toMatchObject({ dataMode: 'DEMO', snapshotId: '2026.10.0-wia-demo' });
    expect(record.source.snapshot?.reportedManifestChecksum).toBeNull();
    expect(record.regions[0]?.isSyntheticDemoName).toBe(true);
    const classes = new Set(record.indicators.flatMap((i) => i.values.map((v) => v?.evidenceClass)));
    expect([...classes]).toEqual(['DEMO_EXAMPLE']);
    expect(record.limitations[0]).toContain('data simulasi (DEMO)');
  });
});

describe('buildEvidenceRecord, gaps', () => {
  it('reports unavailable supporting data instead of guessing classes or sources', async () => {
    const raw = await loadSources(capturedLiveBodies(), 'LIVE', ['1101'], { withSupporting: false });
    const record = buildEvidenceRecord({ kind: 'wilayah', regionId: '1101' }, raw);

    expect(record.unavailableSources).toEqual([
      'katalog indikator',
      'daftar dataset',
      'daftar snapshot',
      'cakupan indikator (/indicators/coverage)',
    ]);
    expect(record.source.snapshot).toBeNull();
    expect(valueOf(record, 'soc_hdi').evidenceClass).toBe('UNSPECIFIED');
    expect(valueOf(record, 'inf_safe_water_pct').evidenceClass).toBe('IMPUTED_PROVINCE');
    expect(record.coverage[0]?.catalogIndicatorCount).toBeNull();
    expect(record.limitations.join('\n')).toContain('"katalog indikator" tidak dapat dimuat');
  });

  it('SYNTHETIC: missing provenance, an unsafe link and a missing value stay visibly missing', async () => {
    const bodies = capturedLiveBodies();
    const profile = profileIn(bodies, '/api/v1/regions/1101');
    delete indicatorOf(profile, 'soc_hdi').provenance;
    indicatorOf(profile, 'soc_poverty_rate').provenance = {
      dataset_id: 'bps_susenas_sakernas_2025',
      agency_code: 'BPS',
      official_url: 'internal://catalog/soc_poverty_rate',
    };
    indicatorOf(profile, 'hlt_stunting_prevalence').raw_value = null;

    const raw = await loadSources(bodies, 'LIVE', ['1101'], { withSupporting: false });
    const record = buildEvidenceRecord({ kind: 'wilayah', regionId: '1101' }, raw);

    expect(valueOf(record, 'soc_hdi').source).toEqual({
      agencyCode: null,
      datasetId: null,
      datasetTitle: null,
      officialUrl: null,
    });
    expect(valueOf(record, 'soc_poverty_rate').source.officialUrl).toBeNull();
    const missing = valueOf(record, 'hlt_stunting_prevalence');
    expect(missing).toMatchObject({ status: 'MISSING', rawDecimal: null, evidenceClass: null });
    expect(missing.valueText).toBe('Data belum tersedia');
    expect(record.coverage[0]?.missing.map((item) => item.indicatorId)).toContain('hlt_stunting_prevalence');
  });
});

describe('buildEvidenceRecord, comparison', () => {
  async function comparison() {
    const bodies = capturedLiveBodies();
    const a = profileIn(bodies, '/api/v1/regions/1101');
    const b = relabelledProfile(a, '1102', 'Kabupaten Uji');
    // SYNTHETIC variant of the captured profile, built to reach each comparison rule.
    indicatorOf(b, 'soc_hdi').reference_year = 2021;
    indicatorOf(b, 'hlt_stunting_prevalence').raw_value = null;
    indicatorOf(b, 'soc_poverty_rate').raw_value = 19.78;
    indicatorOf(b, 'edu_mean_years_schooling').provenance = {
      dataset_id: 'another_dataset',
      agency_code: 'BPS',
      official_url: 'https://example.org/',
    };
    bodies['/api/v1/regions/1102'] = b;
    const raw = await loadSources(bodies, 'LIVE', ['1101', '1102']);
    return buildEvidenceRecord({ kind: 'bandingkan', regionA: '1101', regionB: '1102' }, raw);
  }

  const outcome = (record: EvidenceRecord, id: string) =>
    record.indicators.find((indicator) => indicator.indicatorId === id)?.comparison;

  it('shows a difference only where the comparison is allowed', async () => {
    const record = await comparison();
    expect(outcome(record, 'soc_poverty_rate')).toMatchObject({ allowed: true, blockers: [] });
    expect(outcome(record, 'soc_poverty_rate')?.differenceText).toContain('Kabupaten Uji lebih tinggi');
    expect(outcome(record, 'soc_poverty_rate')?.differenceText).toContain('9,89');
  });

  it('blocks missing values, different datasets and imputed values, with no difference text', async () => {
    const record = await comparison();
    expect(outcome(record, 'hlt_stunting_prevalence')?.blockers.join()).toContain('tidak memiliki data');
    expect(outcome(record, 'edu_mean_years_schooling')?.blockers.join()).toContain('dataset');
    expect(outcome(record, 'inf_safe_water_pct')?.blockers.join()).toContain('diimputasi');
    for (const id of ['hlt_stunting_prevalence', 'edu_mean_years_schooling', 'inf_safe_water_pct']) {
      expect(outcome(record, id)).toMatchObject({ allowed: false, differenceText: null });
    }
  });

  it('names both years when they differ and shows no difference unless the comparison policy allows one', async () => {
    const hdi = outcome(await comparison(), 'soc_hdi');
    // Whether a cross-year difference is allowed is the comparability policy's decision (domain);
    // the record only has to follow it and name both years.
    expect([...(hdi?.blockers ?? []), ...(hdi?.warnings ?? [])].join(' ')).toContain('2024 dan 2021');
    if (hdi && !hdi.allowed) expect(hdi.differenceText).toBeNull();
  });

  it('refuses to compare regions whose responses disagree on snapshot', async () => {
    const bodies = capturedLiveBodies();
    const b = relabelledProfile(bodies['/api/v1/regions/1101'], '1102', 'Kabupaten Uji');
    b.meta.snapshot_id = 'another-snapshot';
    bodies['/api/v1/regions/1102'] = b;
    const raw = await loadSources(bodies, 'LIVE', ['1101', '1102']);
    const record = buildEvidenceRecord({ kind: 'bandingkan', regionA: '1101', regionB: '1102' }, raw);

    expect(record.source.consistent).toBe(false);
    expect(record.indicators.every((indicator) => indicator.comparison?.allowed === false)).toBe(true);
    expect(record.limitations.join('\n')).toContain('mode atau snapshot yang berbeda');
  });
});

describe('assessLinkContext', () => {
  const source = { dataMode: 'LIVE', snapshotId: 'snap-now' } as const;

  it('is quiet when the link matches what was received', () => {
    expect(assessLinkContext({ mode: 'live', snapshotId: 'snap-now' }, source)).toEqual([]);
  });

  it('warns that the record is not the one the link was made from when the snapshot changed', () => {
    const [warning] = assessLinkContext({ mode: 'LIVE', snapshotId: 'snap-old' }, source);
    expect(warning).toMatchObject({ code: 'SNAPSHOT_CHANGED', severity: 'warning' });
    expect(warning?.message).toContain('snap-old');
    expect(warning?.message).toContain('snap-now');
  });

  it('warns when the link named another mode', () => {
    const codes = assessLinkContext({ mode: 'DEMO', snapshotId: 'snap-now' }, source).map((w) => w.code);
    expect(codes).toEqual(['MODE_DIFFERS']);
  });

  it('notes, without alarm, a link that pins no snapshot', () => {
    expect(assessLinkContext({}, source)).toMatchObject([{ code: 'SNAPSHOT_NOT_PINNED', severity: 'info' }]);
  });
});
