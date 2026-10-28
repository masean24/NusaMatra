/**
 * Paspor Bukti on the Data Hub v2.2 contract: snapshot pinning, digest checks and reproducibility.
 * Built on responses CAPTURED FROM PRODUCTION on 2026-10-24 (src/services/api/__fixtures__/live-v2.2,
 * unmodified). Tests that alter a capture say SYNTHETIC and do it in memory.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtureJson, renderWithDataHub, repositoryOver, requestedUrls } from '@/test/dataHubFixtures';
import { ApiError } from '@/services/api';
import { buildCompositeRecord } from './buildCompositeRecord';
import { buildEvidenceRecord } from './buildEvidenceRecord';
import { EvidencePassport } from './EvidencePassport';
import { passportHref, shareablePassportPath, type LabEvidenceQuery } from './evidenceQuery';
import {
  COMPOSITE_PATH,
  DEMO_COMPOSITE_WEIGHTS,
  DEMO_SNAPSHOT,
  DIGEST_22,
  KMS_WEIGHTS,
  NON_RANKABLE_WEIGHTS,
  SNAPSHOT_22,
  capturedDemoComposite,
  captured22NationalKms,
  captured22NonRankable,
  hubFetch,
  withStatus,
} from './evidenceTestKit';
import { buildExportPayload } from './exportRecord';
import { loadCompositeSources, loadEvidenceSources } from './useEvidenceSources';

type Json = Record<string, unknown>;

const labQuery = (
  weights: Readonly<Record<string, number>>,
  snapshotId: string | null = null,
): LabEvidenceQuery => ({
  kind: 'lab',
  mode: 'LIVE',
  snapshotId,
  weights,
  provinceId: null,
  focusRegionId: '9507',
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the passport to fail');
}

describe('pinned Lab passport, national kemiskinan + stunting (CAPTURED v2.2)', () => {
  it('pins every data request to the active reproducible versi data; only the versi data lookup is unpinned', async () => {
    const fetchImpl = hubFetch(captured22NationalKms());
    const raw = await loadCompositeSources(repositoryOver(fetchImpl), KMS_WEIGHTS, null, 'LIVE', null);
    expect(raw.pinning).toMatchObject({
      status: 'PINNED',
      origin: 'ACTIVE',
      pin: { snapshotId: SNAPSHOT_22, contentSha256: DIGEST_22 },
    });
    const urls = requestedUrls(fetchImpl);
    const lookups = ['/api/v1/snapshots', `/api/v1/snapshots/${SNAPSHOT_22}`];
    for (const url of urls) {
      expect(url.searchParams.get('snapshot'), url.pathname).toBe(
        lookups.includes(url.pathname) ? null : SNAPSHOT_22,
      );
    }
    expect(urls.map((url) => url.pathname)).toEqual(expect.arrayContaining([COMPOSITE_PATH, ...lookups]));
  });

  it('records a reproducible data versi data, shows the corrected ranking and the observation source of Lanny Jaya', async () => {
    const raw = await loadCompositeSources(
      repositoryOver(hubFetch(captured22NationalKms())),
      KMS_WEIGHTS,
      null,
      'LIVE',
      null,
    );
    const record = buildCompositeRecord(labQuery(KMS_WEIGHTS), raw);

    expect(record.source.reproducibility).toMatchObject({
      status: 'REPRODUCIBLE_SNAPSHOT',
      pinnedSnapshotId: SNAPSHOT_22,
      contentSha256: DIGEST_22,
      origin: 'ACTIVE',
    });
    expect(record.source.snapshot).toMatchObject({
      contentSha256: DIGEST_22,
      isImmutable: true,
      isReproducible: true,
      observationCount: 14745,
    });
    expect(record.source.consistent).toBe(true);

    // The P0 guard ran and found nothing: the corrected score passes, nothing is withheld.
    expect(record.ranking).toBe('SHOWN');
    expect(record.withheldReason).toBeNull();
    expect(record.direction).toMatchObject({ checked: true, anomalies: [], nationalRankWithheld: false });
    const lanny = record.rows.find((row) => row.regionId === '9507');
    expect(lanny).toMatchObject({ rank: 3, nationalRank: 3, scoreRaw: '80.18' });
    const water = lanny?.components.find((component) => component.indicatorId === 'inf_safe_water_pct');
    expect(water).toMatchObject({
      scoreRaw: '78.89',
      flag: 'IMPUTED_PROVINCE',
      observationDatasetId: 'bps_provincial_sdgs_2025',
      sourceRecordRef: 'BPS Susenas 2025 Provinsi PAPUA PEGUNUNGAN (legacy BPS 9700)',
      catalogDatasetId: 'bps_susenas_sakernas_2025',
    });

    // Every response logged with the digest it carried and the snapshot it was pinned to.
    for (const entry of record.fetched) expect(entry.contentSha256, entry.resource).toBe(DIGEST_22);
    const composite = record.fetched.find((entry) => entry.resource === 'composite-query');
    expect(composite?.query).toMatchObject({ snapshot: SNAPSHOT_22, mode: 'live' });

    const limitations = record.limitations.join(' ');
    expect(limitations).toContain(DIGEST_22);
    expect(limitations).toContain('Paspor ini tidak diarsipkan');
    expect(limitations).not.toContain('dipublikasikan ulang dengan isi berbeda');

    const exported = buildExportPayload(record, 'link');
    expect(exported.reproducibility.pinnedInputs).toBe(true);

    // Opened without a snapshot: the link to copy or share names the one the record was pinned to.
    const opened = passportHref(labQuery(KMS_WEIGHTS)).replace('/paspor-bukti', '');
    expect(opened).not.toContain('snap=');
    expect(shareablePassportPath(opened, record.source)).toBe(
      passportHref(labQuery(KMS_WEIGHTS, SNAPSHOT_22)),
    );
    expect(record.linkWarnings[0]?.message).toContain(
      `dikunci ke versi data aktif saat dibuka (${SNAPSHOT_22})`,
    );
  });

  it('pins to the versi data named in the link, without asking for the list', async () => {
    const fetchImpl = hubFetch(captured22NationalKms());
    const raw = await loadCompositeSources(repositoryOver(fetchImpl), KMS_WEIGHTS, null, 'LIVE', SNAPSHOT_22);
    expect(raw.pinning).toMatchObject({ status: 'PINNED', origin: 'LINK' });
    expect(requestedUrls(fetchImpl).some((url) => url.pathname === '/api/v1/snapshots')).toBe(false);
    const record = buildCompositeRecord(labQuery(KMS_WEIGHTS, SNAPSHOT_22), raw);
    expect(record.source.reproducibility.status).toBe('REPRODUCIBLE_SNAPSHOT');
    expect(record.unavailableSources).not.toContain('daftar versi data');
    expect(record.linkWarnings).toEqual([]);
  });

  it('SYNTHETIC: a supporting response with another digest fails the passport instead of becoming a gap', async () => {
    const bodies = captured22NationalKms();
    const catalog = bodies['/api/v1/indicators'] as { meta: Json };
    catalog.meta.content_sha256 = 'b'.repeat(64);
    const error = await failure(
      loadCompositeSources(repositoryOver(hubFetch(bodies)), KMS_WEIGHTS, null, 'LIVE', null),
    );
    expect(error.code).toBe('SNAPSHOT_DIGEST_MISMATCH');
  });

  it('SYNTHETIC: a versi data detail that disagrees with the list on the digest is refused', async () => {
    const bodies = captured22NationalKms();
    const list = bodies['/api/v1/snapshots'] as { data: Json[] };
    const [entry] = list.data;
    if (!entry) throw new Error('captured list is empty');
    entry.content_sha256 = 'c'.repeat(64);
    const error = await failure(
      loadCompositeSources(repositoryOver(hubFetch(bodies)), KMS_WEIGHTS, null, 'LIVE', null),
    );
    expect(error.code).toBe('SNAPSHOT_DIGEST_MISMATCH');
  });

  it('a linked versi data the Data Hub does not have fails with 404 and asks for nothing else', async () => {
    const fetchImpl = hubFetch({
      ...captured22NationalKms(),
      '/api/v1/snapshots/2026.10.0-official-live': withStatus(404, fixtureJson('live-v2.2/snapshot_404')),
    });
    const error = await failure(
      loadCompositeSources(repositoryOver(fetchImpl), KMS_WEIGHTS, null, 'LIVE', '2026.10.0-official-live'),
    );
    expect(error).toMatchObject({ status: 404, code: 'SNAPSHOT_NOT_FOUND' });
    expect(requestedUrls(fetchImpl)).toHaveLength(1);
  });

  it('SYNTHETIC: a linked versi data that is neither reproducible nor active is refused', async () => {
    const detail = fixtureJson('live-v2.2/snapshot_detail') as { meta: Json; data: Json };
    const legacy = '2026.10.0-official-live';
    detail.meta = { ...detail.meta, snapshot_id: legacy, content_sha256: null };
    detail.data = {
      ...detail.data,
      snapshot_id: legacy,
      content_sha256: null,
      is_reproducible: false,
      is_immutable: false,
      is_active_default: false,
    };
    const fetchImpl = hubFetch({ ...captured22NationalKms(), [`/api/v1/snapshots/${legacy}`]: detail });
    const error = await failure(
      loadCompositeSources(repositoryOver(fetchImpl), KMS_WEIGHTS, null, 'LIVE', legacy),
    );
    expect(error.code).toBe('SNAPSHOT_NOT_REPRODUCIBLE');
  });
});

describe('non-rankable composite (CAPTURED v2.2: multihazard 5000 + school travel time 5000)', () => {
  it('withholds the ranking, quotes the Data Hub reason and lists no region', async () => {
    const raw = await loadCompositeSources(
      repositoryOver(hubFetch(captured22NonRankable())),
      NON_RANKABLE_WEIGHTS,
      null,
      'LIVE',
      null,
    );
    const record = buildCompositeRecord(labQuery(NON_RANKABLE_WEIGHTS), raw);
    expect(record.ranking).toBe('WITHHELD');
    expect(record.rows).toEqual([]);
    expect(record.insufficient).toEqual([]);
    const issue = record.integrity.issues.find((item) => item.code === 'COMPOSITE_NOT_RANKABLE');
    expect(issue).toMatchObject({ severity: 'block' });
    expect(issue?.message).toContain('below the 70% threshold');
  });
});

describe('unpinned passports', () => {
  it('DEMO: the linked DEMO versi data is active but not reproducible, so nothing is pinned or claimed', async () => {
    const fetchImpl = hubFetch(capturedDemoComposite());
    const raw = await loadCompositeSources(
      repositoryOver(fetchImpl),
      DEMO_COMPOSITE_WEIGHTS,
      null,
      'DEMO',
      DEMO_SNAPSHOT,
    );
    expect(raw.pinning.status).toBe('UNPINNED');
    expect(requestedUrls(fetchImpl).every((url) => url.searchParams.get('snapshot') === null)).toBe(true);
    const record = buildCompositeRecord(
      { kind: 'lab', mode: 'DEMO', snapshotId: DEMO_SNAPSHOT, weights: DEMO_COMPOSITE_WEIGHTS },
      raw,
    );
    expect(record.source.reproducibility).toMatchObject({ status: 'NOT_REPRODUCIBLE', contentSha256: null });
    expect(record.source.reproducibility.statement).toContain('tidak dapat direproduksi');
    expect(buildExportPayload(record, 'link').reproducibility.pinnedInputs).toBe(false);
  });
});

describe('pinned region passport (CAPTURED v2.2 region 9507)', () => {
  it('shows the observation-level dataset of the imputed water value, pinned to the versi data', async () => {
    const bodies = captured22NationalKms();
    const fetchImpl = hubFetch({
      '/api/v1/snapshots': bodies['/api/v1/snapshots'],
      [`/api/v1/snapshots/${SNAPSHOT_22}`]: bodies[`/api/v1/snapshots/${SNAPSHOT_22}`],
      '/api/v1/regions/9507': fixtureJson('live-v2.2/region_9507'),
      '/api/v1/indicators': bodies['/api/v1/indicators'],
      '/api/v1/datasets': bodies['/api/v1/datasets'],
      '/api/v1/indicators/coverage': bodies['/api/v1/indicators/coverage'],
    });
    const raw = await loadEvidenceSources(repositoryOver(fetchImpl), ['9507'], 'LIVE', null);
    const record = buildEvidenceRecord({ kind: 'wilayah', regionId: '9507', mode: 'LIVE' }, raw);
    expect(record.source.reproducibility.status).toBe('REPRODUCIBLE_SNAPSHOT');
    expect(record.source.observedCoverage).toEqual({
      availableIndicators: 29,
      totalIndicators: 33,
      regionCoveragePct: 100,
    });
    const water = record.indicators.find((indicator) => indicator.indicatorId === 'inf_safe_water_pct');
    expect(water?.values[0]).toMatchObject({
      rawDecimal: '32.89',
      normalizedScore: '78.89',
      rawFlag: 'IMPUTED_PROVINCE',
      source: { datasetId: 'bps_provincial_sdgs_2025' },
    });
  });
});

describe('Paspor Bukti page on v2.2 (CAPTURED)', () => {
  it('states the reproducible versi data and its digest, and names the observation source of Lanny Jaya', async () => {
    const path = passportHref({
      kind: 'lab',
      mode: 'LIVE',
      snapshotId: SNAPSHOT_22,
      weights: KMS_WEIGHTS,
      focusRegionId: '9507',
    });
    renderWithDataHub(<EvidencePassport />, {
      fetchImpl: hubFetch(captured22NationalKms()),
      path,
      dataMode: 'LIVE',
    });
    const article = await screen.findByRole('article', { name: /^Bukti hasil Lab/ });
    const status = within(article).getByRole('region', { name: /Status sumber data/ });
    expect(status).toHaveTextContent('Dapat direproduksi: tautan ini selalu membuka versi data yang sama.');
    expect(status).not.toHaveTextContent(DIGEST_22);
    expect(article).toHaveTextContent('sumber observasi: bps_provincial_sdgs_2025');
    expect(article).toHaveTextContent('Dirangkai di peramban, bukan arsip/sertifikat resmi.');
    expect(screen.queryByText('Peringkat ditahan: skor sumber tidak konsisten')).not.toBeInTheDocument();
  });
});
