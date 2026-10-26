import { describe, expect, it } from 'vitest';
import {
  createFixtureFetch,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  repositoryOver,
  requestedUrls,
} from '@/test/dataHubFixtures';
import { ApiError } from './apiError';
import { selectActiveReproducible } from './snapshotPinning';
import type { DataHubSnapshotDTO, SnapshotPin } from './wireTypes';

// CAPTURED production state, 2026-10-24 (src/services/api/__fixtures__/live-v2.2/README.md).
const SNAPSHOT = '2026.10.0-live-62354dfad392d985';
const DIGEST = '62354dfad392d985168450ac670b6c647ab097e800ee023768d5858387a984b5';
const PIN: SnapshotPin = { snapshotId: SNAPSHOT, contentSha256: DIGEST };
const WATER_PATH = '/api/v1/indicators/inf_safe_water_pct/values';

const v22 = (name: string) => `live-v2.2/${name}`;
const overWater = () =>
  repositoryOver(createFixtureFetch({ [WATER_PATH]: () => fixtureResponse(v22('values_water')) }));

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('snapshot pinning (CAPTURED v2.2 responses)', () => {
  it('sends ?snapshot=<id> and accepts a response with the same id and digest (meta and headers)', async () => {
    const fetchImpl = createFixtureFetch({ [WATER_PATH]: () => fixtureResponse(v22('values_water')) });
    const envelope = await repositoryOver(fetchImpl).getIndicatorValues({
      dataMode: 'LIVE',
      indicatorId: 'inf_safe_water_pct',
      snapshot: PIN,
    });
    const [url] = requestedUrls(fetchImpl);
    expect(url?.searchParams.get('snapshot')).toBe(SNAPSHOT);
    expect(url?.searchParams.get('mode')).toBe('live');
    expect(envelope.meta).toMatchObject({
      snapshotId: SNAPSHOT,
      contentSha256: DIGEST,
      snapshotImmutable: true,
      snapshotReproducible: true,
      methodologyVersion: 'v2.2-minmax-full-range',
    });
  });

  it('SYNTHETIC pin: refuses a response whose digest differs from the pinned one', async () => {
    const error = await rejection(
      overWater().getIndicatorValues({
        dataMode: 'LIVE',
        indicatorId: 'inf_safe_water_pct',
        snapshot: { snapshotId: SNAPSHOT, contentSha256: 'f'.repeat(64) },
      }),
    );
    expect(error.code).toBe('SNAPSHOT_DIGEST_MISMATCH');
  });

  it('SYNTHETIC pin: refuses a response from another snapshot id', async () => {
    const error = await rejection(
      overWater().getIndicatorValues({
        dataMode: 'LIVE',
        indicatorId: 'inf_safe_water_pct',
        snapshot: { snapshotId: '2026.10.0-live-0000000000000000', contentSha256: DIGEST },
      }),
    );
    expect(error.code).toBe('SNAPSHOT_MISMATCH');
  });

  it('SYNTHETIC header: refuses a response whose digest header contradicts its meta', async () => {
    const fetchImpl = createFixtureFetch({
      [WATER_PATH]: () =>
        new Response(JSON.stringify(fixtureJson(v22('values_water'))), {
          headers: { 'Content-Type': 'application/json', 'X-NusaMatra-Content-SHA256': 'a'.repeat(64) },
        }),
    });
    const error = await rejection(
      repositoryOver(fetchImpl).getIndicatorValues({ dataMode: 'LIVE', indicatorId: 'inf_safe_water_pct' }),
    );
    expect(error.code).toBe('SNAPSHOT_DIGEST_MISMATCH');
  });

  it('takes the digest from the header when meta leaves it null (CAPTURED /datasets, 2026-10-24)', async () => {
    const fetchImpl = createFixtureFetch({ '/api/v1/datasets': () => fixtureResponse(v22('datasets')) });
    const envelope = await repositoryOver(fetchImpl).getDatasets('LIVE', undefined, PIN);
    expect(envelope.meta.contentSha256).toBe(DIGEST);
  });

  it('maps the captured 404 for an unknown snapshot, and never answers with another snapshot', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/snapshots/does-not-exist': () => jsonResponse(fixtureJson(v22('snapshot_404')), 404),
    });
    const error = await rejection(
      repositoryOver(fetchImpl).getSnapshotDetail({ dataMode: 'LIVE', snapshotId: 'does-not-exist' }),
    );
    expect(error).toMatchObject({ status: 404, code: 'SNAPSHOT_NOT_FOUND' });
  });

  it('maps the captured 422 for two different snapshot parameters', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/indicators/coverage': () => jsonResponse(fixtureJson(v22('coverage_conflict')), 422),
    });
    const error = await rejection(repositoryOver(fetchImpl).getIndicatorCoverage({ dataMode: 'LIVE' }));
    expect(error).toMatchObject({ status: 422, code: 'SNAPSHOT_PARAM_CONFLICT' });
  });

  it('reads the snapshot detail: digest, immutability and counts as the Data Hub states them', async () => {
    const fetchImpl = createFixtureFetch({
      [`/api/v1/snapshots/${SNAPSHOT}`]: () => fixtureResponse(v22('snapshot_detail')),
    });
    const { data } = await repositoryOver(fetchImpl).getSnapshotDetail({
      dataMode: 'LIVE',
      snapshotId: SNAPSHOT,
    });
    expect(data).toMatchObject({
      snapshotId: SNAPSHOT,
      contentSha256: DIGEST,
      contentHashSpec: 'canonical-json-v1',
      isImmutable: true,
      isReproducible: true,
      isActiveDefault: true,
      observationCount: 14745,
      indicatorCount: 33,
      availableIndicatorCount: 29,
      regionCount: 514,
      datasetCount: 18,
      referencePeriods: [2023, 2024, 2025, 2026],
    });
    // metadata_checksum is NOT the content digest.
    expect(data.metadataChecksum).not.toBe(DIGEST);
  });

  it('SYNTHETIC: refuses a detail for another snapshot than the one asked for', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/snapshots/other': () => fixtureResponse(v22('snapshot_detail')),
    });
    const error = await rejection(
      repositoryOver(fetchImpl).getSnapshotDetail({ dataMode: 'LIVE', snapshotId: 'other' }),
    );
    expect(error.code).toBe('SNAPSHOT_MISMATCH');
  });

  it('DEMO detail: not reproducible, no digest, and the placeholder checksum is not shown as one', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/snapshots/2026.10.0-wia-demo': () => jsonResponse(fixtureJson(v22('demo_snapshot_detail'))),
    });
    const { data } = await repositoryOver(fetchImpl).getSnapshotDetail({
      dataMode: 'DEMO',
      snapshotId: '2026.10.0-wia-demo',
    });
    expect(data).toMatchObject({
      isReproducible: false,
      isImmutable: false,
      contentSha256: null,
      metadataChecksum: null,
    });
  });
});

describe('selectActiveReproducible', () => {
  const listOf = async (name: string, mode: 'LIVE' | 'DEMO') => {
    const fetchImpl = createFixtureFetch({ '/api/v1/snapshots': () => jsonResponse(fixtureJson(v22(name))) });
    return (await repositoryOver(fetchImpl).getSnapshots(mode)).data;
  };

  it('pins the one active reproducible snapshot of the captured LIVE list', async () => {
    expect(selectActiveReproducible(await listOf('snapshots', 'LIVE'))).toMatchObject(PIN);
  });

  it('pins nothing for the captured DEMO list (not reproducible)', async () => {
    expect(selectActiveReproducible(await listOf('demo_snapshots', 'DEMO'))).toBeNull();
  });

  it('SYNTHETIC: pins nothing when two snapshots claim to be the active default', async () => {
    const [entry] = await listOf('snapshots', 'LIVE');
    if (!entry) throw new Error('captured list is empty');
    const twin: DataHubSnapshotDTO = { ...entry, snapshotId: '2026.10.0-live-1111111111111111' };
    expect(selectActiveReproducible([entry, twin])).toBeNull();
  });
});

describe('v2.2 contract fields (CAPTURED)', () => {
  it('Lanny Jaya water: raw 32.89, published score 78.89, IMPUTED_PROVINCE, with its own observation source', async () => {
    const { data } = await overWater().getIndicatorValues({
      dataMode: 'LIVE',
      indicatorId: 'inf_safe_water_pct',
    });
    const cell = data.valuesByRegion['9507'];
    expect(cell).toMatchObject({
      value: { status: 'AVAILABLE', decimal: '32.89' },
      normalizedScoreDecimal: '78.89',
      qualityFlag: 'IMPUTED_PROVINCE',
      datasetId: 'bps_provincial_sdgs_2025',
      sourceRecordRef: 'BPS Susenas 2025 Provinsi PAPUA PEGUNUNGAN (legacy BPS 9700)',
    });
    // The observation's dataset wins over the indicator's catalog dataset.
    expect(data.indicator.provenance.datasetId).toBe('bps_susenas_sakernas_2025');
    const observation = data.observations.find((item) => item.regionId === '9507');
    expect(observation?.source.datasetId).toBe('bps_provincial_sdgs_2025');
  });

  it('coverage: indicator counts (29 of 33) kept apart from region coverage (100%)', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/indicators/coverage': () => fixtureResponse(v22('coverage')),
    });
    const { data } = await repositoryOver(fetchImpl).getIndicatorCoverage({ dataMode: 'LIVE' });
    expect(data.indicatorCounts).toEqual({
      totalIndicators: 33,
      availableIndicators: 29,
      unavailableIndicators: 4,
      completenessPct: 87.9,
      availableDataPct: 100,
    });
    expect(data.regionCoveragePct).toBe(100);
    expect(data.totalRegions).toBe(514);
  });

  it('SYNTHETIC coverage: a count the per-indicator entries contradict is refused', async () => {
    const body = structuredClone(fixtureJson(v22('coverage'))) as {
      data: { available_indicators_count: number };
    };
    body.data.available_indicators_count = 33;
    const fetchImpl = createFixtureFetch({ '/api/v1/indicators/coverage': () => jsonResponse(body) });
    const error = await rejection(repositoryOver(fetchImpl).getIndicatorCoverage({ dataMode: 'LIVE' }));
    expect(error.code).toBe('MALFORMED_ENVELOPE');
  });

  const compositeOver = (name: string) =>
    repositoryOver(
      createFixtureFetch({ '/api/v1/indicators/composite-query': () => fixtureResponse(v22(name)) }),
    );

  it('non-rankable composite: the verdict, its reason and no regions', async () => {
    const { data } = await compositeOver('composite_nonrankable').runExploratoryCompositeQuery({
      dataMode: 'LIVE',
      criteria: [
        { indicatorId: 'dis_multihazard_index', basisPoints: 5000 },
        { indicatorId: 'edu_school_travel_time_p90', basisPoints: 5000 },
      ],
    });
    expect(data).toMatchObject({
      rankable: false,
      nationalCoveragePct: 50,
      availableWeightBasisPoints: 5000,
      availableIndicatorIds: ['dis_multihazard_index'],
      items: [],
      insufficient: [],
    });
    expect(data.notRankableReason).toContain('below the 70% threshold');
  });

  it('SYNTHETIC: a composite that is rankable = false but still lists regions is refused', async () => {
    const body = structuredClone(fixtureJson(v22('composite_jateng_kms'))) as { data: { rankable: boolean } };
    body.data.rankable = false;
    const fetchImpl = createFixtureFetch({ '/api/v1/indicators/composite-query': () => jsonResponse(body) });
    const error = await rejection(
      repositoryOver(fetchImpl).runExploratoryCompositeQuery({
        dataMode: 'LIVE',
        criteria: [{ indicatorId: 'soc_poverty_rate', basisPoints: 10000 }],
      }),
    );
    expect(error.code).toBe('MALFORMED_ENVELOPE');
  });

  it('national kemiskinan + stunting: rankable, and Lanny Jaya is 80.18 at rank 3 (not 84.40 at rank 2)', async () => {
    const { data } = await compositeOver('composite_national_kms').runExploratoryCompositeQuery({
      dataMode: 'LIVE',
      criteria: [
        { indicatorId: 'soc_poverty_rate', basisPoints: 3000 },
        { indicatorId: 'hlt_stunting_prevalence', basisPoints: 3000 },
        { indicatorId: 'inf_safe_water_pct', basisPoints: 2000 },
        { indicatorId: 'inf_safe_sanitation_pct', basisPoints: 2000 },
      ],
    });
    expect(data.rankable).toBe(true);
    const lanny = data.items.find((item) => item.regionId === '9507');
    expect(lanny).toMatchObject({ compositeScoreDecimal: '80.18', rankPosition: 3, nationalRank: 3 });
    expect(lanny?.componentScoresDecimal.inf_safe_water_pct).toBe('78.89');
    expect(lanny?.qualityFlags?.inf_safe_water_pct).toBe('IMPUTED_PROVINCE');
  });
});
