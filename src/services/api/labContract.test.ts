import {
  coverageResponse,
  compositeResponse,
  presetsResponse,
  type CapturedCatalog,
  type CapturedComposite,
} from '@/test/labContractMock';
import { fixtureJson } from '@/test/dataHubFixtures';
import { ApiError } from './apiError';
import { mapCompositeQueryData } from './domainMappers';
import { mapCompositePresetsData, mapIndicatorCoverageData } from './labContract';
import type { AdaptedResponseMeta } from './wireTypes';

const meta: AdaptedResponseMeta = {
  serverRequestId: null,
  apiVersion: 'v1',
  serverGeneratedAt: null,
  clientReceivedAt: '2026-10-22T05:00:00Z',
  dataMode: 'LIVE',
  snapshotId: '2026.10.0-official-live',
  boundaryVersion: null,
  totalCount: null,
};
const catalog = () => fixtureJson('live/indicators') as CapturedCatalog;
const composite = () => fixtureJson('live/composite') as CapturedComposite;

describe('mapIndicatorCoverageData', () => {
  it('reads availability and coverage per indicator', () => {
    const coverage = mapIndicatorCoverageData(coverageResponse(catalog(), composite()).data, meta);
    expect(coverage.totalIndicators).toBe(33);
    expect(coverage.totalRegions).toBe(514);
    expect(coverage.byIndicator['soc_poverty_rate']).toMatchObject({ available: true, coverageCount: 487 });
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

describe('mapCompositePresetsData', () => {
  it('keeps presets whose weights are integers summing to 10 000 and counts the rest', () => {
    const presets = mapCompositePresetsData(presetsResponse().data, meta);
    expect(presets.presets.map((preset) => preset.presetId)).toEqual([
      'ketahanan-sosial',
      'risiko-dan-sekolah',
    ]);
    expect(presets.rejectedCount).toBe(1);
  });

  it('accepts the list under "presets" and the alternative key names', () => {
    const presets = mapCompositePresetsData(
      { presets: [{ preset_id: 'p', label: 'P', weights_basis_points: { a: 10000, b: 0 } }] },
      meta,
    );
    expect(presets.presets[0]).toEqual({
      presetId: 'p',
      label: 'P',
      description: null,
      weightsBasisPoints: { a: 10000 },
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
});

describe('mapCompositeQueryData with the guide v2 fields', () => {
  it('reads renormalisation provenance and the province filter', () => {
    const body = {
      weights: {
        dis_multihazard_index: 3500,
        soc_poverty_rate: 2500,
        edu_damaged_classrooms_pct: 2000,
        hlt_stunting_prevalence: 2000,
      },
      filter_province_id: '33',
    };
    const result = mapCompositeQueryData(compositeResponse(composite(), body).data, meta, '33');
    expect(result.renormalized).toBe(true);
    expect(result.unavailableIndicatorIds).toEqual(['edu_damaged_classrooms_pct']);
    expect(result.effectiveWeightsBasisPoints).toEqual({
      dis_multihazard_index: 4375,
      soc_poverty_rate: 3125,
      hlt_stunting_prevalence: 2500,
    });
    expect(result.filterProvinceId).toBe('33');
    expect(result.items.every((item) => item.regionId.startsWith('33'))).toBe(true);
  });

  it('leaves the v2 fields null for a v1 response that does not report them', () => {
    const result = mapCompositeQueryData(composite().data, meta);
    expect(result.renormalized).toBeNull();
    expect(result.unavailableIndicatorIds).toBeNull();
    expect(result.effectiveWeightsBasisPoints).toBeNull();
  });
});
