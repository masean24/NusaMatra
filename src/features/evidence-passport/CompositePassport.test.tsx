import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithDataHub, requestedUrls } from '@/test/dataHubFixtures';
import jatengCapture from '@/services/api/__fixtures__/live-v2.1/composite_jateng_kemiskinan_stunting.json';
import capture3T from '@/services/api/__fixtures__/live-v2.1/composite_national_pendidikan_3t.json';
import {
  JATENG_WEIGHTS,
  PENDIDIKAN_3T_WEIGHTS,
  SUMUT_WEIGHTS,
  capturedJateng,
  capturedSumut,
  captured3T,
  DEMO_COMPOSITE_WEIGHTS,
  capturedDemoComposite,
  hubFetch,
  COMPOSITE_PATH,
} from './evidenceTestKit';
import { EvidencePassport } from './EvidencePassport';
import { passportHref } from './evidenceQuery';
import type { DataMode } from '@/services/api';

const SNAPSHOT = '2026.10.0-official-live';

const jatengUrl = (focusRegionId?: string, snapshotId: string | null = SNAPSHOT) =>
  passportHref({
    kind: 'lab',
    mode: 'LIVE',
    snapshotId,
    weights: JATENG_WEIGHTS,
    provinceId: '33',
    focusRegionId: focusRegionId ?? null,
  });
const sumutUrl = (focusRegionId?: string) =>
  passportHref({
    kind: 'lab',
    mode: 'LIVE',
    snapshotId: SNAPSHOT,
    weights: SUMUT_WEIGHTS,
    provinceId: '12',
    focusRegionId: focusRegionId ?? null,
  });
const url3T = (focusRegionId?: string) =>
  passportHref({
    kind: 'lab',
    mode: 'LIVE',
    snapshotId: SNAPSHOT,
    weights: PENDIDIKAN_3T_WEIGHTS,
    focusRegionId: focusRegionId ?? null,
  });

function renderPassport(path: string, bodies: Record<string, unknown>, dataMode: DataMode = 'DEMO') {
  return renderWithDataHub(<EvidencePassport />, { fetchImpl: hubFetch(bodies), path, dataMode });
}

const findDocument = () => screen.findByRole('article', { name: /^Bukti hasil Lab/ });

function sectionsOf(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('section[aria-labelledby]')];
}

const rankingTable = (root: HTMLElement) =>
  within(root).getByRole('table', { name: /^Peringkat \d+ wilayah/ });

describe('Paspor Bukti for Lab, CAPTURED LIVE Jawa Tengah (kemiskinan + stunting)', () => {
  it('shows LIVE in every section and the ranking exactly as the Data Hub sent it', async () => {
    renderPassport(jatengUrl('3372'), capturedJateng());
    const article = await findDocument();

    for (const section of sectionsOf(article)) {
      expect(
        within(section).getAllByText('LIVE').length,
        section.getAttribute('aria-labelledby') ?? '',
      ).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(article).not.toHaveTextContent(/lolos/i);
    expect(article).toHaveTextContent('Dirangkai di peramban, bukan arsip/sertifikat resmi.');

    const table = rankingTable(article);
    expect(table).toHaveAccessibleName('Peringkat 35 wilayah, urutan dari Data Hub');
    expect(within(table).getAllByRole('row')).toHaveLength(36);

    const wonosobo = within(table).getByRole('row', { name: /Kabupaten Wonosobo/ });
    expect(wonosobo).toHaveTextContent('35,06');
    expect(wonosobo.querySelectorAll('td')[0]).toHaveTextContent('1');
    expect(wonosobo.querySelectorAll('td')[1]).toHaveTextContent('80');
    expect(wonosobo).toHaveTextContent('100%');
    expect(wonosobo).toHaveTextContent('Lengkap');
    expect(wonosobo).not.toHaveAttribute('data-focus');
  });

  it('shows Surakarta as partial: 70% coverage, stunting not available, its own region weights', async () => {
    renderPassport(jatengUrl('3372'), capturedJateng());
    const article = await findDocument();
    const row = within(rankingTable(article)).getByRole('row', { name: /Kota Surakarta/ });

    expect(row).toHaveAttribute('data-focus', 'true');
    expect(row).toHaveTextContent('Wilayah yang Anda buka');
    expect(row.querySelectorAll('td')[0]).toHaveTextContent('35');
    expect(row.querySelectorAll('td')[1]).toHaveTextContent('487');
    expect(row).toHaveTextContent('9,57');
    expect(row).toHaveTextContent('70%');
    expect(row).toHaveTextContent('Parsial, bobot dialihkan');
    expect(row).toHaveTextContent(/Tidak ada data:.*[Ss]tunting/);
    expect(row).toHaveTextContent(/[Ss]tunting.*: tidak tersedia \(tidak dihitung, bukan nol\)/);
    // The three weights the Data Hub gave this region (2857 / 2857 / 4286), against the requested 20% / 20% / 30%.
    expect(row.textContent.match(/bobot wilayah 28,57%/g)).toHaveLength(2);
    expect(row).toHaveTextContent('bobot wilayah 42,86% (diminta 30%)');
    expect(row).toHaveTextContent('Bobot berbeda dari bobot global');
    // A genuinely observed zero stays a zero.
    expect(row).toHaveTextContent(/skor 0 · bobot wilayah 28,57%/);

    const focus = screen.getByRole('region', { name: /Wilayah yang Anda buka/ });
    expect(focus).toHaveTextContent('peringkat 35 dari 35');
    expect(focus).toHaveTextContent('peringkat nasional 487 dari 513');
  });

  it('keeps rank and national rank separate and does not re-sort what the Data Hub sent', async () => {
    renderPassport(jatengUrl(), capturedJateng());
    const article = await findDocument();
    const rows = within(rankingTable(article)).getAllByRole('row').slice(1);
    const sentRanks = (
      jatengCapture as {
        data: { regions: { rank: number; national_rank: number }[] };
      }
    ).data.regions;
    expect(rows.map((row) => Number(row.querySelectorAll('td')[0]?.textContent))).toEqual(
      sentRanks.map((region) => region.rank),
    );
    expect(rows.map((row) => Number(row.querySelectorAll('td')[1]?.textContent))).toEqual(
      sentRanks.map((region) => region.national_rank),
    );
    expect(article).toHaveTextContent('peringkat 1 adalah prioritas tertinggi');
  });

  it('records requested weights, the scope and the criteria sources', async () => {
    renderPassport(jatengUrl(), capturedJateng());
    const article = await findDocument();

    const weights = within(article).getByRole('table', { name: /Bobot yang diminta dan bobot efektif/ });
    expect(weights).toHaveTextContent('30%');
    expect(weights).toHaveTextContent('20%');
    const scope = within(article).getByRole('region', { name: /Cakupan hasil dan bobot/ });
    expect(scope).toHaveTextContent('Provinsi Jawa Tengah (kode 33)');
    expect(scope).toHaveTextContent('513');
    expect(scope).toHaveTextContent('higher_is_need');
    expect(scope).toHaveTextContent('31 wilayah lengkap (100%); 4 wilayah parsial');
    const links = within(article).getAllByRole('link', { name: /membuka tab baru/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute('href')?.startsWith('https://'))).toBe(true);
  });

  it('warns when the snapshot in the link is not the snapshot received', async () => {
    renderPassport(jatengUrl('3372', '2026.09.0-older'), capturedJateng());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('2026.09.0-older');
    expect(alert).toHaveTextContent(SNAPSHOT);
    expect(alert).toHaveTextContent('tidak sama dengan tautan');
  });

  it('fetches in the mode of the link and posts the weights of the link', async () => {
    const fetchImpl = hubFetch(capturedJateng());
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: jatengUrl(), dataMode: 'DEMO' });
    await findDocument();
    const urls = requestedUrls(fetchImpl);
    expect(urls.every((url) => url.searchParams.get('mode') === 'live')).toBe(true);
    const index = urls.findIndex((url) => url.pathname === COMPOSITE_PATH);
    const body = fetchImpl.mock.calls[index]?.[1]?.body;
    expect(typeof body).toBe('string');
    const sent = JSON.parse(typeof body === 'string' ? body : '{}') as {
      weights: unknown;
      filter_province_id: unknown;
    };
    expect(sent.weights).toEqual(JATENG_WEIGHTS);
    expect(sent.filter_province_id).toBe('33');
  });
});

describe('Paspor Bukti for Lab, CAPTURED LIVE Sumatera Utara (insufficient region)', () => {
  it('lists Padangsidimpuan only as not ranked, with its reason and no rank', async () => {
    renderPassport(sumutUrl('1277'), capturedSumut());
    const article = await findDocument();

    const table = rankingTable(article);
    expect(table).toHaveAccessibleName('Peringkat 32 wilayah, urutan dari Data Hub');
    expect(within(table).queryByText(/Padangsidimpuan/)).not.toBeInTheDocument();

    const unranked = within(article).getByRole('table', { name: /Wilayah tidak diperingkat \(1\)/ });
    const row = within(unranked).getByRole('row', { name: /Padangsidimpuan/ });
    expect(row).toHaveTextContent('Tidak diperingkat');
    expect(row).toHaveTextContent('33,3%');
    expect(row).toHaveTextContent('COVERAGE_BELOW_THRESHOLD');
    expect(row).toHaveAttribute('data-focus', 'true');
    expect(within(unranked).queryByRole('columnheader', { name: /Peringkat|Skor/ })).not.toBeInTheDocument();

    const focus = screen.getByRole('region', { name: /Wilayah yang Anda buka/ });
    expect(focus).toHaveTextContent('tidak diperingkat');
    expect(focus).toHaveTextContent('tidak mendapat skor ataupun peringkat');
  });

  it('shows the global renormalisation: the criterion with no national data is left out', async () => {
    renderPassport(sumutUrl(), capturedSumut());
    const article = await findDocument();
    const weights = within(article).getByRole('table', { name: /Bobot yang diminta dan bobot efektif/ });
    expect(weights).toHaveTextContent('46,67%');
    expect(weights).toHaveTextContent('tidak dipakai');
    expect(weights).toHaveTextContent('Tidak ada data nasional');
    expect(article).toHaveTextContent('1 wilayah tidak diperingkat');
  });

  it('says so when the region in the link is not in the result at all', async () => {
    renderPassport(sumutUrl('3374'), capturedSumut());
    await findDocument();
    const focus = screen.getByRole('region', { name: /Wilayah yang Anda buka/ });
    expect(focus).toHaveTextContent('tidak ada dalam hasil ini');
    expect(focus).toHaveTextContent('bukan bagian dari provinsi 12');
  });
});

describe('Paspor Bukti for Lab, CAPTURED LIVE Pendidikan 3T (not rankable)', () => {
  it('withholds the ranking: no ranking table, reasons in plain words, nothing says it passed', async () => {
    renderPassport(url3T('3201'), captured3T());
    const article = await findDocument();

    expect(screen.getByRole('alert')).toHaveTextContent('Peringkat ditahan');
    expect(within(article).queryByRole('table', { name: /Peringkat/ })).not.toBeInTheDocument();
    expect(within(article).queryByRole('table', { name: /tidak diperingkat/i })).not.toBeInTheDocument();
    const firstName = (
      capture3T as {
        data: { regions: { region_name: string }[] };
      }
    ).data.regions[0]?.region_name;
    expect(firstName).toBeTruthy();
    expect(within(article).queryByText(firstName ?? '')).not.toBeInTheDocument();

    const check = within(article).getByRole('region', { name: /Pemeriksaan hasil/ });
    expect(check).toHaveTextContent('PRESET_NOT_RANKABLE');
    expect(check).toHaveTextContent('REQUESTED_WEIGHT_AVAILABILITY_LOW');
    expect(check).toHaveTextContent('Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub)');
    expect(check).toHaveTextContent('Penanda dari Data Hub (rankable = false)');
    expect(article).not.toHaveTextContent(/lolos/i);

    const limits = within(article).getByRole('region', { name: /Batasan dan catatan/ });
    expect(limits).toHaveTextContent('Anomali backend');
    expect(limits).toHaveTextContent('rankable = false');
    expect(limits).toHaveTextContent('514 wilayah');
    expect(limits).toHaveTextContent('Kebijakan antarmuka Nusa Matra (bukan aturan Data Hub)');

    expect(screen.getByRole('region', { name: /Wilayah yang Anda buka/ })).toHaveTextContent(
      'Peringkat ditahan',
    );
  });
});

describe('Paspor Bukti for Lab, SYNTHETIC integrity failure', () => {
  it('SYNTHETIC: a score that is not the sum of its parts withholds the ranking and names the check', async () => {
    const bodies = capturedJateng();
    const composite = bodies[COMPOSITE_PATH] as { data: { regions: { composite_score: number }[] } };
    // A copy of the captured response with the first region's score altered, built in memory only.
    const first = composite.data.regions[0];
    if (first) first.composite_score = 71.5;

    renderPassport(jatengUrl('3372'), bodies);
    const article = await findDocument();

    expect(screen.getByRole('alert')).toHaveTextContent('Peringkat ditahan');
    expect(within(article).queryByRole('table', { name: /Peringkat/ })).not.toBeInTheDocument();
    const check = within(article).getByRole('region', { name: /Pemeriksaan hasil/ });
    expect(check).toHaveTextContent('SCORE_MISMATCH');
    expect(check).toHaveTextContent('Pemeriksaan konsistensi antarmuka');
    expect(article).not.toHaveTextContent(/lolos/i);
    expect(within(article).queryByText(/Kabupaten Wonosobo/)).not.toBeInTheDocument();
  });
});

describe('Paspor Bukti for Lab, actions', () => {
  it('exports the requested weights, effective weights and insufficient regions', async () => {
    let blob: Blob | null = null;
    Object.defineProperty(URL, 'createObjectURL', {
      value: (value: Blob) => {
        blob = value;
        return 'blob:test';
      },
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    renderPassport(sumutUrl('1277'), capturedSumut());
    await userEvent.click(await screen.findByRole('button', { name: 'Unduh JSON' }));

    expect(downloads).toEqual(['nusa-matra-paspor-bukti-lab-live-prov-12.json']);
    const written = blob as Blob | null;
    const payload = JSON.parse((await written?.text()) ?? '{}') as {
      reproducibility: { pinnedInputs: boolean };
      record: {
        kind: string;
        ranking: string;
        requestedWeights: Record<string, number>;
        effectiveWeights: Record<string, number>;
        insufficient: { regionId: string; reason: string }[];
        rows: { effectiveWeightsRegion: Record<string, number> | null }[];
        integrity: { ok: boolean };
        source: { dataMode: string; snapshotId: string };
      };
    };
    expect(payload.reproducibility.pinnedInputs).toBe(false);
    expect(payload.record).toMatchObject({
      kind: 'lab',
      ranking: 'SHOWN',
      requestedWeights: SUMUT_WEIGHTS,
      effectiveWeights: {
        dis_multihazard_index: 4667,
        dis_flood_hazard_idx: 2000,
        inf_electrification_pct: 3333,
      },
      source: { dataMode: 'LIVE', snapshotId: SNAPSHOT },
    });
    expect(payload.record.insufficient).toMatchObject([
      { regionId: '1277', reason: 'COVERAGE_BELOW_THRESHOLD' },
    ]);
    expect(payload.record.rows[0]?.effectiveWeightsRegion).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('exports a withheld result without any region rows and says the ranking was not shown', async () => {
    let blob: Blob | null = null;
    Object.defineProperty(URL, 'createObjectURL', {
      value: (value: Blob) => {
        blob = value;
        return 'blob:test';
      },
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderPassport(url3T(), captured3T());
    await userEvent.click(await screen.findByRole('button', { name: 'Unduh JSON' }));

    const written = blob as Blob | null;
    const payload = JSON.parse((await written?.text()) ?? '{}') as {
      record: { ranking: string; rows: unknown[]; integrity: { ok: boolean; issues: { code: string }[] } };
    };
    expect(payload.record.ranking).toBe('WITHHELD');
    expect(payload.record.rows).toEqual([]);
    expect(payload.record.integrity.ok).toBe(false);
    expect(payload.record.integrity.issues.map((issue) => issue.code)).toContain('PRESET_NOT_RANKABLE');
    vi.restoreAllMocks();
  });

  it('copies a citation that states the weights and that the ranking is quoted, not recomputed', async () => {
    const write = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    renderPassport(jatengUrl(), capturedJateng());
    await userEvent.click(await screen.findByRole('button', { name: 'Salin sitasi' }));

    await waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1);
    });
    const citation = write.mock.calls[0]?.[0] ?? '';
    expect(citation).toContain('Mode data: LIVE');
    expect(citation).toContain(`Snapshot Data Hub: ${SNAPSHOT}`);
    expect(citation).toContain('Bobot diminta:');
    expect(citation).toContain('dikutip apa adanya dari Data Hub');
    expect(citation).toContain('bukan arsip resmi');
    Reflect.deleteProperty(navigator, 'clipboard');
  });
});

describe('Paspor Bukti for Lab, states', () => {
  it('does not show a Lab passport from DEMO data when LIVE cannot be loaded', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: jatengUrl(), dataMode: 'DEMO' });
    expect(await screen.findByText('Data LIVE tidak dapat dimuat, Paspor Bukti tidak dibuat')).toBeVisible();
    expect(screen.queryByRole('article', { name: /^Bukti hasil Lab/ })).not.toBeInTheDocument();
  });

  it('rejects a response that breaks the contract instead of showing it', async () => {
    const bodies = capturedJateng();
    const composite = bodies[COMPOSITE_PATH] as { data: { regions: { rank: number | null }[] } };
    const first = composite.data.regions[0];
    // SYNTHETIC: a score with no rank, which the adapter must refuse.
    if (first) first.rank = null;
    renderPassport(jatengUrl(), bodies);
    expect(await screen.findByText('Respons Data Hub ditolak')).toBeVisible();
    expect(screen.queryByRole('article', { name: /^Bukti hasil Lab/ })).not.toBeInTheDocument();
  });
});

describe('Paspor Bukti for Lab, CAPTURED DEMO responses', () => {
  it('is DEMO in every section, never LIVE, and reports what v0.1 does not say as unreported', async () => {
    const path = passportHref({
      kind: 'lab',
      mode: 'DEMO',
      snapshotId: '2026.10.0-wia-demo',
      weights: DEMO_COMPOSITE_WEIGHTS,
    });
    renderPassport(path, capturedDemoComposite(), 'LIVE');
    const article = await findDocument();

    for (const section of sectionsOf(article)) {
      expect(within(section).getAllByText('DEMO · data simulasi').length).toBeGreaterThan(0);
    }
    expect(within(article).queryByText('LIVE')).not.toBeInTheDocument();
    const table = rankingTable(article);
    const first = within(table).getAllByRole('row')[1];
    expect(first).toHaveTextContent('Cakupan tidak dilaporkan');
    expect(first).toHaveTextContent('bobot wilayah belum dilaporkan');
    expect(article).toHaveTextContent('belum dilaporkan');
    expect(article).not.toHaveTextContent(/lolos/i);
  });
});

describe('Paspor Bukti for Lab keeps wide tables inside their own scroll box', () => {
  it('puts the ranking and every other table in a labelled, focusable scroll region', async () => {
    renderPassport(jatengUrl('3372'), capturedJateng());
    const article = await findDocument();
    const tables = within(article).getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(3);
    for (const table of tables) {
      const region = table.closest('[role="region"]');
      expect(region).toHaveAttribute('tabindex', '0');
      expect(region?.className).toMatch(/tableScroll/);
      expect(region?.children).toHaveLength(1);
    }
    expect(rankingTable(article).closest('[role="region"]')).toHaveAccessibleName(
      'Peringkat 35 wilayah, urutan dari Data Hub',
    );
  });
});
