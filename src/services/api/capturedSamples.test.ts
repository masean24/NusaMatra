import { describe, expect, it, vi } from 'vitest';
import { fixtureHeaders, fixtureJson, fixtureText } from '@/test/dataHubFixtures';
import { ApiError } from './apiError';
import {
  mapBoundariesData,
  mapCompositeQueryData,
  mapDatasetsData,
  mapEnvelope,
  mapHealthResponse,
  mapIndicatorCatalogData,
  mapIndicatorValuesData,
  mapRegionDetailData,
  mapRegionsListData,
  mapSnapshotsData,
} from './domainMappers';
import { DataHubHttpClient, type HttpResponseContext } from './httpClient';
import { DataHubCacheKeys, NusaMatraDataHubRepository } from './repositories';

/** Verifies the adapter against the real responses captured from the Data Hub (see __fixtures__/README.md). */
const sample = fixtureJson;
const sampleHeaders = fixtureHeaders;

const context: HttpResponseContext = {
  status: 200,
  requestId: null,
  dataFallback: null,
  serverMode: 'DEMO',
  clientReceivedAt: '2026-10-21T00:00:00.000Z',
};

function decode<T>(
  name: string,
  mapper: (data: unknown, meta: Parameters<Parameters<typeof mapEnvelope<T>>[3]>[1]) => T,
) {
  return mapEnvelope(sample(name), 'DEMO', context, mapper);
}

describe('adapter vs captured runtime JSON: regions_nonempty.json', () => {
  const regions = decode('regions_nonempty', (data, meta) => mapRegionsListData(data, meta));

  it('maps all 514 kabupaten/kota with unique ids and the captured totals', () => {
    expect(regions.meta.totalCount).toBe(514);
    expect(regions.meta.snapshotId).toBe('2026.10.0-wia-demo');
    expect(regions.data).toHaveLength(514);
    expect(new Set(regions.data.map((region) => region.regionId)).size).toBe(514);
  });

  it('keeps kabupaten and kota apart (415 + 99) and never guesses a level', () => {
    expect(regions.data.filter((region) => region.adminLevel === 'REGENCY')).toHaveLength(415);
    expect(regions.data.filter((region) => region.adminLevel === 'CITY')).toHaveLength(99);
    const onlyCities = mapEnvelope(sample('regions_nonempty'), 'DEMO', context, (data, meta) =>
      mapRegionsListData(data, meta, 'CITY'),
    );
    expect(onlyCities.data).toHaveLength(99);
  });

  it('preserves the synthetic names verbatim and flags every one of them', () => {
    expect(regions.data.every((region) => region.isSyntheticDemoName)).toBe(true);
    expect(regions.data.every((region) => /demo/i.test(region.displayName))).toBe(true);
    expect(regions.data.some((region) => /bogor/i.test(region.displayName))).toBe(false);
    const jabar1 = regions.data.find((region) => region.regionId === '3201');
    expect(jabar1?.displayName).toBe('Kabupaten Demo Jabar 1');
  });

  it('carries codes, anchor points and bounding boxes without inventing any', () => {
    for (const region of regions.data) {
      expect(region.identifiers.length).toBeGreaterThan(0);
      expect(region.anchorPoint).not.toBeNull();
      expect(region.bbox).toHaveLength(4);
    }
  });

  it('refuses to decode the same payload as LIVE data (mode isolation)', () => {
    expect(() =>
      mapEnvelope(sample('regions_nonempty'), 'LIVE', context, (data, meta) =>
        mapRegionsListData(data, meta),
      ),
    ).toThrow(expect.objectContaining({ code: 'MODE_MISMATCH' }));
  });
});

describe('adapter vs captured runtime JSON: datasets.json', () => {
  const datasets = decode('datasets', (data, meta) => mapDatasetsData(data, meta));

  it('maps the 13 datasets with agency, licence and access method', () => {
    expect(datasets.meta.totalCount).toBe(13);
    expect(datasets.data).toHaveLength(13);
    expect(new Set(datasets.data.map((dataset) => dataset.agencyCode))).toEqual(
      new Set(['BNPB', 'BPS', 'KEMENDIKDASMEN', 'KEMENKES', 'NUSAMATRA']),
    );
    expect(datasets.data.every((dataset) => dataset.licenseName !== null)).toBe(true);
  });

  it('treats every placeholder checksum as unverified, never as an integrity digest', () => {
    for (const dataset of datasets.data) {
      expect(dataset.isChecksumPlaceholder).toBe(true);
      expect(dataset.checksumSyntaxValid).toBe(false);
      expect(dataset.verifiedSha256).toBeNull();
      expect(dataset.rawChecksum).toMatch(/^demo_placeholder_/);
    }
  });

  it('keeps the internal pseudo-URL as data, so the UI can refuse to link it', () => {
    const internal = datasets.data.find((dataset) => dataset.agencyCode === 'NUSAMATRA');
    expect(internal?.officialPortalUrl).toBe('internal://nusamatra-data-hub');
  });
});

describe('adapter vs the other captured endpoints', () => {
  it('health: decoded directly, without an envelope', () => {
    const health = mapHealthResponse(sample('health'), context);
    expect(health.dataMode).toBe('DEMO');
    expect(health.activeSnapshotId).toBe('2026.10.0-wia-demo');
    expect(health.database.tables?.['dim_regions']).toBe(552);
  });

  it('regions_search: q=bogor is an honest empty result, not a renamed region', () => {
    const result = decode('regions_search', (data, meta) => mapRegionsListData(data, meta));
    expect(result.data).toEqual([]);
    expect(result.meta.totalCount).toBe(0);
  });

  it('region_detail: region 3201 keeps its synthetic name and every value is DEMO_EXAMPLE', () => {
    const detail = decode('region_detail', mapRegionDetailData).data;
    expect(detail.region.regionId).toBe('3201');
    expect(detail.region.displayName).toBe('Kabupaten Demo Jabar 1');
    expect(detail.indicators.length).toBeGreaterThan(0);
    expect(detail.indicators.every((item) => item.isDemoExample && item.origin === 'DEMO')).toBe(true);
    expect(
      detail.indicators.every((item) => item.observation.methodologyId.startsWith('UNVERIFIED_DEMO_METHOD:')),
    ).toBe(true);
    expect(detail.indicators.every((item) => item.observation.comparabilityGroupId === null)).toBe(true);
  });

  it('indicators: six categories, 33 indicators, polarity mapped explicitly', () => {
    const catalog = decode('indicators', mapIndicatorCatalogData).data;
    expect(catalog.categories).toHaveLength(6);
    expect(catalog.items).toHaveLength(33);
    expect(catalog.items.some((item) => item.indicatorId === 'soc_poverty_rate')).toBe(true);
  });

  it('indicator_values: 514 region cells keyed by string id, all DEMO_EXAMPLE', () => {
    const values = decode('indicator_values', mapIndicatorValuesData).data;
    expect(Object.keys(values.valuesByRegion)).toHaveLength(514);
    expect(Object.values(values.valuesByRegion).every((cell) => cell.isDemoExample)).toBe(true);
    expect(values.valuesByRegion['1101']?.value.status).toBe('AVAILABLE');
  });

  it('composite_valid: 514 ranked rows, no run id and no invented contribution ledger', () => {
    const result = decode('composite_valid', mapCompositeQueryData).data;
    expect(result.items).toHaveLength(514);
    expect(result.items[0]?.rankPosition).toBe(1);
    expect(result.runId).toBeNull();
    expect(result.isExploratoryPreview).toBe(true);
    expect(result.weightedContributionsAvailable).toBe(false);
    expect(result.contributions).toBeNull();
    expect(Object.values(result.weightsBasisPoints).reduce((sum, bps) => sum + bps, 0)).toBe(10000);
  });

  it('boundaries: Point-only DEMO placeholder is never extrudable as polygons', () => {
    const boundaries = decode('boundaries_kabupaten', mapBoundariesData).data;
    expect(boundaries.features).toHaveLength(27);
    expect(boundaries.features.every((feature) => feature.geometry?.type === 'Point')).toBe(true);
    expect(boundaries.geometryStatus.geometryAvailable).toBe(false);
    expect(boundaries.geometryStatus.source).toBe('DEMO_PLACEHOLDER');
    expect(boundaries.geometryStatus.canExtrudePolygons).toBe(false);
  });

  it('snapshots: the manifest checksum is flagged as a placeholder', () => {
    const snapshots = decode('snapshots', (data, meta) => mapSnapshotsData(data, meta)).data;
    expect(snapshots[0]?.isChecksumPlaceholder).toBe(true);
    expect(snapshots[0]?.verifiedDigestSha256).toBeNull();
  });
});

describe('error captures through the real HTTP client', () => {
  function clientReturning(
    name: string,
    status: number,
  ): { repository: NusaMatraDataHubRepository; fetchMock: ReturnType<typeof vi.fn> } {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(fixtureText(`${name}.json`), {
          status,
          headers: sampleHeaders(name),
        }),
      ),
    );
    const client = new DataHubHttpClient({
      baseUrl: 'https://api.orangkeren.me',
      fetchImpl: fetchMock,
    });
    return { repository: new NusaMatraDataHubRepository(client), fetchMock };
  }

  it('LIVE 503 is a blocked state: no retry and no request for DEMO data', async () => {
    const { repository, fetchMock } = clientReturning('regions_live', 503);
    const failure: unknown = await repository.searchRegions({ dataMode: 'LIVE', query: 'bogor' }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).isLiveUnavailable).toBe(true);
    expect((failure as ApiError).messageId).toBe('data.live_unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers['X-Data-Mode']).toBe('LIVE');
  });

  it('a DEMO capture served for a LIVE request fails closed with MODE_MISMATCH', async () => {
    const { repository } = clientReturning('regions_nonempty', 200);
    await expect(repository.searchRegions({ dataMode: 'LIVE' })).rejects.toMatchObject({
      code: 'MODE_MISMATCH',
    });
  });

  it('composite_invalid: the nested 422 detail becomes WEIGHT_SUM_INVALID', async () => {
    const { repository } = clientReturning('composite_invalid', 422);
    const call = repository.runExploratoryCompositeQuery({
      dataMode: 'DEMO',
      criteria: [
        { indicatorId: 'soc_poverty_rate', basisPoints: 5000 },
        { indicatorId: 'dis_multihazard_index', basisPoints: 5000 },
      ],
    });
    await expect(call).rejects.toMatchObject({ status: 422, code: 'WEIGHT_SUM_INVALID' });
  });
});

describe('cache keys', () => {
  it('never share an entry between DEMO and LIVE or between snapshots', () => {
    expect(DataHubCacheKeys.regionDetail('DEMO', '3201')).not.toEqual(
      DataHubCacheKeys.regionDetail('LIVE', '3201'),
    );
    expect(DataHubCacheKeys.regionDetail('DEMO', '3201', 'a')).not.toEqual(
      DataHubCacheKeys.regionDetail('DEMO', '3201', 'b'),
    );
  });
});
