import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDataHub, requestedUrls } from '@/test/dataHubFixtures';
import {
  JATENG_WEIGHTS,
  capturedDemoBodies,
  capturedJateng,
  capturedJatengNoRegistry,
  capturedLiveBodies,
  hubFetch,
  withRegistry,
} from './evidenceTestKit';
import { EvidencePassport } from './EvidencePassport';
import { passportHref } from './evidenceQuery';
import {
  BROWSER_ASSEMBLED_LABEL,
  COMPLETENESS_CLAIM_NOTE,
  MANIFEST_CHECKSUM_LABEL,
  SNAPSHOT_MUTABILITY_NOTE,
} from './notices';
import type { DataMode } from '@/services/api';

/** The manifest checksum in the captured LIVE snapshot list (the server's value, identical before and after the data changed). */
const SERVER_CHECKSUM = '60c1d0314914ddca1cb41f13180481aecfdda3cc5e88dd6748e20a007f32325e';
const SNAPSHOT = '2026.10.0-official-live';

const REGION_URL = '/paspor-bukti?jenis=wilayah&mode=live&kode=1101';
const labUrl = (provinceId: string | null = '33') =>
  passportHref({
    kind: 'lab',
    mode: 'LIVE',
    snapshotId: null, // v2.1 captures: their snapshot id is no longer resolvable (see CompositePassport.test)
    weights: JATENG_WEIGHTS,
    provinceId,
    focusRegionId: provinceId ? '3372' : null,
  });

function renderPassport(path: string, bodies: Record<string, unknown>, dataMode: DataMode = 'DEMO') {
  return renderWithDataHub(<EvidencePassport />, { fetchImpl: hubFetch(bodies), path, dataMode });
}

const findRegionDocument = () => screen.findByRole('article', { name: /^Bukti indikator/ });
const findLabDocument = () => screen.findByRole('article', { name: /^Bukti hasil Lab/ });

interface Downloaded {
  readonly name: string;
  readonly text: string;
  readonly json: Record<string, unknown>;
}

/** Clicks "Unduh JSON" and returns the file that the browser would have saved. */
async function downloadJson(): Promise<Downloaded> {
  let blob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', {
    value: (value: Blob) => {
      blob = value;
      return 'blob:test';
    },
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  let name = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    name = this.download;
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Unduh JSON' }));
  const written = blob as Blob | null;
  const text = (await written?.text()) ?? '{}';
  return { name, text, json: JSON.parse(text) as Record<string, unknown> };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('snapshot id is not proof that data is the same', () => {
  it('says so in the source status and in the limitations, in a region passport', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const article = await findRegionDocument();

    const status = within(article).getByRole('region', { name: /Status sumber data/ });
    expect(status).toHaveTextContent(SNAPSHOT_MUTABILITY_NOTE);
    const limits = within(article).getByRole('region', { name: /Batasan dan catatan/ });
    expect(limits).toHaveTextContent(SNAPSHOT_MUTABILITY_NOTE);
    expect(article).not.toHaveTextContent(/snapshot (yang sama )?menjamin|data tidak berubah/i);
  });

  it('says so in the source status and in the limitations, in a Lab passport', async () => {
    renderPassport(labUrl(), capturedJateng());
    const article = await findLabDocument();
    expect(within(article).getByRole('region', { name: /Status sumber data/ })).toHaveTextContent(
      SNAPSHOT_MUTABILITY_NOTE,
    );
    expect(within(article).getByRole('region', { name: /Batasan dan catatan/ })).toHaveTextContent(
      SNAPSHOT_MUTABILITY_NOTE,
    );
  });

  it('puts it in the citation', async () => {
    const write = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    renderPassport(REGION_URL, capturedLiveBodies());
    await userEvent.click(await screen.findByRole('button', { name: 'Salin kutipan' }));
    const citation = write.mock.calls[0]?.[0] ?? '';
    expect(citation).toContain(`Snapshot Data Hub: ${SNAPSHOT}. ${SNAPSHOT_MUTABILITY_NOTE}`);
    expect(citation).toContain(BROWSER_ASSEMBLED_LABEL);
  });

  it('puts it in the JSON, keeps pinnedInputs false and says why', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const { json } = await downloadJson();
    const { fieldNotes, reproducibility } = json as {
      fieldNotes: Record<string, string>;
      reproducibility: { pinnedInputs: boolean; statement: string };
    };
    expect(fieldNotes.snapshotId).toBe(SNAPSHOT_MUTABILITY_NOTE);
    expect(reproducibility.pinnedInputs).toBe(false);
    expect(reproducibility.statement).toContain('tidak dikunci ke snapshot yang dapat direproduksi');
    expect(reproducibility.statement).toContain('tidak menjamin hasil yang sama');
  });

  it('says in the print header and in the JSON notice that it is browser-assembled, not an official archive', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const article = await findRegionDocument();
    expect(
      within(article).getByText(new RegExp(`Mode LIVE · Snapshot ${SNAPSHOT} · ${BROWSER_ASSEMBLED_LABEL}`)),
    ).toBeInTheDocument();
    const { json } = await downloadJson();
    expect((json as { notice: string }).notice.startsWith(BROWSER_ASSEMBLED_LABEL)).toBe(true);
  });
});

describe('the manifest checksum is not a content digest', () => {
  it('is labelled as such in "Detail teknis" and never as proof of integrity', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const article = await findRegionDocument();
    const status = within(article).getByRole('region', { name: /Status sumber data/ });
    expect(status).toHaveTextContent(`Checksum manifest: ${MANIFEST_CHECKSUM_LABEL}`);
    expect(status).toHaveTextContent(SERVER_CHECKSUM);
    expect(status).toHaveTextContent('bukan sidik isi data');
    expect(article).not.toHaveTextContent(/bukti keutuhan|terverifikasi|menjamin keutuhan/i);
  });

  it('keeps the checksum in the JSON as received, with the same label', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const { json } = await downloadJson();
    const record = json.record as { source: { snapshot: { reportedManifestChecksum: string } } };
    expect(record.source.snapshot.reportedManifestChecksum).toBe(SERVER_CHECKSUM);
    expect((json.fieldNotes as Record<string, string>)['source.snapshot.reportedManifestChecksum']).toBe(
      MANIFEST_CHECKSUM_LABEL,
    );
  });
});

describe('snapshot completeness is shown as the server claims it, beside what /indicators/coverage counts', () => {
  it('LIVE: shows both figures and a note that they can disagree, without computing a replacement', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const article = await findRegionDocument();
    const status = within(article).getByRole('region', { name: /Status sumber data/ });
    expect(status).toHaveTextContent('Kelengkapan snapshot51,6%');
    // The captured coverage response (2026-10-23T15:19Z) counts 25 of 33.
    expect(status).toHaveTextContent('Indikator berdata25 dari 33');
    // Where each figure comes from is stated in the technical details.
    expect(status).toHaveTextContent(
      'Indikator berdata dibaca dari /indicators/coverage; kelengkapan snapshot dinyatakan server',
    );
    expect(status).toHaveTextContent(COMPLETENESS_CLAIM_NOTE);
  });

  it('keeps both figures in the JSON', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const { json } = await downloadJson();
    const source = (json.record as { source: Record<string, unknown> }).source as {
      snapshot: { completenessPct: number };
      observedCoverage: { availableIndicators: number; totalIndicators: number };
    };
    expect(source.snapshot.completenessPct).toBe(51.6);
    expect(source.observedCoverage).toEqual({
      availableIndicators: 25,
      totalIndicators: 33,
      regionCoveragePct: null,
    });
    expect((json.fieldNotes as Record<string, string>)['source.snapshot.completenessPct']).toContain(
      'Menurut server',
    );
  });

  it('DEMO: says the coverage response does not exist rather than showing a number', async () => {
    const fetchImpl = hubFetch(capturedDemoBodies());
    renderWithDataHub(<EvidencePassport />, {
      fetchImpl,
      path: '/paspor-bukti?jenis=wilayah&mode=demo&kode=3201',
      dataMode: 'LIVE',
    });
    const article = await findRegionDocument();
    expect(within(article).getByRole('region', { name: /Status sumber data/ })).toHaveTextContent(
      'tidak tersedia pada mode DEMO',
    );
    // DEMO has no coverage response, so none is asked for and no gap is reported for it.
    expect(requestedUrls(fetchImpl).some((url) => url.pathname.endsWith('/coverage'))).toBe(false);
    expect(within(article).getByRole('region', { name: /Batasan dan catatan/ })).not.toHaveTextContent(
      '/indicators/coverage',
    );
  });

  it('LIVE without the coverage response: says it is missing and lists the gap', async () => {
    const bodies = capturedLiveBodies();
    delete bodies['/api/v1/indicators/coverage'];
    renderPassport(REGION_URL, bodies);
    const article = await findRegionDocument();
    const status = within(article).getByRole('region', { name: /Status sumber data/ });
    expect(status).toHaveTextContent('Indikator berdatabelum tersedia');
    expect(within(article).getByRole('region', { name: /Batasan dan catatan/ })).toHaveTextContent(
      'cakupan indikator (/indicators/coverage)',
    );
  });
});

describe('the JSON preserves what was fetched and invents no identity', () => {
  it('region: raw values, flags, units, years, provenance, snapshot metadata as sent, receive times and requests', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const { json } = await downloadJson();
    const record = json.record as {
      source: { snapshot: Record<string, unknown> };
      indicators: {
        indicatorId: string;
        rawUnit: string;
        values: {
          rawDecimal: string | null;
          rawFlag: string | null;
          normalizedScore: string | null;
          referenceYear: number | null;
          source: { agencyCode: string | null; datasetId: string | null; officialUrl: string | null };
        }[];
      }[];
      fetched: {
        resource: string;
        method: string;
        path: string;
        query: Record<string, string>;
        body: unknown;
        mode: string;
        snapshotId: string;
        receivedByBrowserAt: string;
      }[];
    };

    const hdi = record.indicators.find((indicator) => indicator.indicatorId === 'soc_hdi');
    expect(hdi?.values[0]).toMatchObject({ rawDecimal: '69.1', rawFlag: 'VERIFIED', referenceYear: 2024 });
    expect(hdi?.values[0]?.normalizedScore).not.toBeNull();
    expect(hdi?.values[0]?.source).toMatchObject({
      agencyCode: 'BPS',
      datasetId: 'bps_susenas_sakernas_2025',
    });
    expect(hdi?.values[0]?.source.officialUrl).toMatch(/^https:/);
    expect(hdi?.rawUnit).not.toBe('');
    const water = record.indicators.find((indicator) => indicator.indicatorId === 'inf_safe_water_pct');
    expect(water?.values[0]).toMatchObject({ rawDecimal: '92.06', rawFlag: 'IMPUTED_PROVINCE' });

    // Snapshot metadata exactly as sent: the timestamp string is not parsed, reformatted or given a zone.
    expect(record.source.snapshot).toMatchObject({
      createdAt: '2026-10-21 17:14:49',
      publishedAt: '2026-10-21 17:14:49',
      boundaryVersion: 'BIG-20260601',
      completenessPct: 51.6,
    });

    const region = record.fetched.find((entry) => entry.resource === 'region-detail:1101');
    expect(region).toMatchObject({
      method: 'GET',
      path: '/api/v1/regions/1101',
      query: { mode: 'live' },
      body: null,
      mode: 'LIVE',
      snapshotId: SNAPSHOT,
    });
    expect(record.fetched.map((entry) => entry.resource)).toEqual(
      expect.arrayContaining(['indicator-catalog', 'datasets', 'snapshots', 'indicator-coverage']),
    );
    for (const entry of record.fetched) {
      expect(Number.isNaN(new Date(entry.receivedByBrowserAt).getTime()), entry.resource).toBe(false);
      // Request descriptions carry no host and no credentials.
      expect(entry.path.startsWith('/api/v1/')).toBe(true);
      expect(Object.keys(entry.query)).toEqual(expect.not.arrayContaining(['key', 'token', 'authorization']));
    }
  });

  it('Lab: composite scores as sent, region weights, the request body and the receive time per response', async () => {
    renderPassport(labUrl(), capturedJateng());
    const { json } = await downloadJson();
    const record = json.record as {
      rows: {
        regionId: string;
        scoreRaw: string | null;
        effectiveWeightsRegion: Record<string, number> | null;
        components: { indicatorId: string; scoreRaw: string | null }[];
      }[];
      fetched: {
        resource: string;
        method: string;
        body: Record<string, unknown> | null;
        receivedByBrowserAt: string;
      }[];
    };
    const wonosobo = record.rows.find((row) => row.regionId === '3307');
    expect(wonosobo?.scoreRaw).toBe('35.06');
    expect(wonosobo?.components.find((c) => c.indicatorId === 'soc_poverty_rate')?.scoreRaw).toBe('28.14');
    const surakarta = record.rows.find((row) => row.regionId === '3372');
    expect(
      surakarta?.components.find((c) => c.indicatorId === 'hlt_stunting_prevalence')?.scoreRaw,
    ).toBeNull();
    expect(surakarta?.components.find((c) => c.indicatorId === 'inf_safe_water_pct')?.scoreRaw).toBe('0');

    const post = record.fetched.find((entry) => entry.resource === 'composite-query');
    expect(post).toMatchObject({
      method: 'POST',
      body: { weights: JATENG_WEIGHTS, filter_province_id: '33' },
    });
    expect(
      record.fetched.every((entry) => !Number.isNaN(new Date(entry.receivedByBrowserAt).getTime())),
    ).toBe(true);
  });

  it('adds no report id, content hash or server timestamp: the only 64-hex value is the server checksum', async () => {
    renderPassport(REGION_URL, capturedLiveBodies());
    const { text, json } = await downloadJson();

    expect(text.match(/\b[a-f0-9]{64}\b/gi) ?? []).toEqual([SERVER_CHECKSUM]);
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key);
          walk(inner);
        }
      }
    };
    walk(json);
    // `contentSha256` / `contentHashSpec` are copied from Data Hub responses (v2.2). These v2.1
    // captures carry none, so every such value must be null: nothing is made up in the browser.
    const SERVER_COPIED = new Set(['contentSha256', 'contentHashSpec']);
    const suspicious = [...keys].filter(
      (key) =>
        !SERVER_COPIED.has(key) &&
        /report.?id|laporan|digest|hash|sha|signature|generatedAt|issuedAt/i.test(key),
    );
    expect(suspicious).toEqual([]);
    expect(text).not.toMatch(/"contentSha256": "/);
    expect(text).not.toMatch(/"contentHashSpec": "/);
    expect(Object.keys(json).sort()).toEqual(
      ['fieldNotes', 'link', 'notice', 'record', 'reproducibility', 'schema'].sort(),
    );
    expect(text).not.toMatch(/NM-20\d\d-\d+/);
  });
});

describe('Lab passport names the province from the Data Hub', () => {
  it('shows the name from the region registry (the same call Lab uses) in the title, scope, citation and JSON', async () => {
    const fetchImpl = hubFetch(capturedJateng());
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: labUrl(), dataMode: 'DEMO' });
    const article = await findLabDocument();

    expect(article).toHaveAccessibleName('Bukti hasil Lab Prioritas (Provinsi Jawa Tengah (kode 33))');
    expect(within(article).getByRole('region', { name: /Cakupan hasil dan bobot/ })).toHaveTextContent(
      'Provinsi Jawa Tengah (kode 33)',
    );
    const registryCalls = requestedUrls(fetchImpl).filter((url) => url.pathname === '/api/v1/regions');
    expect(registryCalls).toHaveLength(1);
    expect(registryCalls[0]?.searchParams.get('mode')).toBe('live');

    const { json } = await downloadJson();
    expect((json.record as { scope: { provinceName: string } }).scope.provinceName).toBe(
      'Provinsi Jawa Tengah',
    );
  });

  it('falls back to the code and says the name is unavailable when the registry cannot be loaded', async () => {
    renderPassport(labUrl(), capturedJatengNoRegistry());
    const article = await findLabDocument();

    expect(article).toHaveAccessibleName(
      'Bukti hasil Lab Prioritas (provinsi kode 33 (nama belum tersedia))',
    );
    expect(within(article).getByRole('region', { name: /Cakupan hasil dan bobot/ })).toHaveTextContent(
      'provinsi kode 33 (nama belum tersedia)',
    );
    expect(within(article).getByRole('region', { name: /Batasan dan catatan/ })).toHaveTextContent(
      'daftar wilayah (nama provinsi)',
    );
    const { json } = await downloadJson();
    expect((json.record as { scope: { provinceName: unknown } }).scope.provinceName).toBeNull();
  });

  it('falls back when the registry holds no region of that province', async () => {
    const bodies = withRegistry(capturedJatengNoRegistry(), '99', 'Provinsi Lain');
    renderPassport(labUrl(), bodies);
    const article = await findLabDocument();
    expect(article).toHaveAccessibleName(
      'Bukti hasil Lab Prioritas (provinsi kode 33 (nama belum tersedia))',
    );
  });

  it('does not ask for the registry when the scope is national', async () => {
    const fetchImpl = hubFetch(capturedJatengNoRegistry());
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: labUrl(null), dataMode: 'DEMO' });
    await findLabDocument();
    expect(requestedUrls(fetchImpl).some((url) => url.pathname === '/api/v1/regions')).toBe(false);
    expect(screen.getByRole('region', { name: /Cakupan hasil dan bobot/ })).toHaveTextContent(
      'seluruh Indonesia',
    );
  });
});
