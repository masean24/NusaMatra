import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  buildPool,
  compositeResponse,
  presetsResponse,
  valuesResponse,
  type CapturedCatalog,
  type CapturedComposite,
  type Replay,
} from '@/test/labContractMock';
import {
  createFixtureFetch,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  renderWithDataHub,
  requestedUrls,
  type FixtureHandler,
} from '@/test/dataHubFixtures';
import { PriorityLab } from './PriorityLab';

interface CompositeRequest {
  readonly weights: Record<string, number>;
  readonly filter_province_id: string | null;
}

/** jsdom does not toggle <details> on a summary click; open the criteria picker directly. */
function openPicker() {
  const details = screen.getByText('Tambah kriteria').closest('details');
  if (!details) throw new Error('no criteria picker');
  details.open = true;
}

/** Weights apply only on "Hitung ulang peringkat" (never while a slider moves). */
function recompute() {
  const button = screen.getByRole('button', { name: 'Hitung ulang peringkat' });
  if (!(button as HTMLButtonElement).disabled) fireEvent.click(button);
}

/** Chooses a Data Hub scenario in the native select (it becomes the draft weights). */
async function chooseScenario(name: RegExp) {
  const option = await screen.findByRole<HTMLOptionElement>('option', { name });
  fireEvent.change(screen.getByLabelText('Skenario awal'), { target: { value: option.value } });
}

/** Chooses a province in "Cakupan wilayah" (a glass combobox with a listbox, not a native select). */
async function chooseScope(name: RegExp) {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Cakupan wilayah' }));
  fireEvent.pointerUp(await screen.findByRole('option', { name }));
}

/** Chooses a Data Hub scenario and applies it with "Hitung ulang peringkat". */
async function applyScenario(name: RegExp) {
  await chooseScenario(name);
  recompute();
}

/** Opens a ranking row's breakdown (the rows are an accordion, all closed at first). */
function openRow(row: HTMLElement) {
  fireEvent.click(row);
  expect(row).toHaveAttribute('aria-expanded', 'true');
}

const sumOf = (weights: Record<string, number>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);
const requestBody = (init: RequestInit | undefined) =>
  JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as CompositeRequest;

// ---------------------------------------------------------------------------------------------
// DEMO: the captured DEMO responses.
// ---------------------------------------------------------------------------------------------

function labFetch(catalog: () => Response = () => fixtureResponse('indicators')) {
  const bodies: CompositeRequest[] = [];
  const fetchImpl = createFixtureFetch({
    '/api/v1/indicators': catalog,
    '/api/v1/regions': () => fixtureResponse('regions_nonempty'),
    '/api/v1/indicators/composite-presets': () => jsonResponse({ detail: 'Not Found' }, 404),
    '/api/v1/indicators/composite-query': (_url, init) => {
      bodies.push(requestBody(init));
      return fixtureResponse('composite_valid');
    },
  });
  return { fetchImpl, bodies };
}

describe('PriorityLab in DEMO (captured DEMO composite)', () => {
  it('starts from the Data Hub preview weights and labels the ranking as a DEMO preview without a run id', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(await screen.findByText('10 dari 514 wilayah')).toBeInTheDocument();
    expect(screen.getByText('Data simulasi (DEMO)')).toBeInTheDocument();
    expect(screen.getByText(/bukan data atau rekomendasi resmi/)).toBeInTheDocument();
    expect(bodies[0]).toEqual({
      weights: {
        dis_multihazard_index: 3500,
        soc_poverty_rate: 2500,
        edu_damaged_classrooms_pct: 2000,
        hlt_stunting_prevalence: 2000,
      },
      filter_province_id: null,
    });
    // DEMO never asks for LIVE coverage.
    expect(requestedUrls(fetchImpl).some((url) => url.pathname.endsWith('/coverage'))).toBe(false);

    const first = screen.getAllByText('Kabupaten Demo Lampung 11')[0]?.closest('li');
    expect(first).toHaveTextContent('1');
    expect(first).toHaveTextContent('91,1');
  });

  it('flags a composite whose scores do not reproduce from its components, and neither hides nor repairs it', async () => {
    const tampered = fixtureJson('composite_valid') as { data: { regions: { composite_score: number }[] } };
    const [first] = tampered.data.regions;
    if (!first) throw new Error('fixture has no rows');
    first.composite_score = 12.34;
    const { fetchImpl } = labFetch();
    fetchImpl.mockImplementation((input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname.endsWith('/composite-query')) return Promise.resolve(jsonResponse(tampered));
      if (url.pathname.endsWith('/composite-presets')) return Promise.resolve(jsonResponse({}, 404));
      if (url.pathname.endsWith('/regions')) return Promise.resolve(fixtureResponse('regions_nonempty'));
      return Promise.resolve(fixtureResponse('indicators'));
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(await screen.findByText('Hasil simulasi tidak konsisten')).toBeInTheDocument();
    expect(screen.getAllByText(/tidak sama dengan jumlah berbobot skor komponennya/).length).toBeGreaterThan(
      0,
    );
    // DEMO still shows its (simulated) rows, exactly as the backend sent them.
    expect(screen.getAllByText('12,34').length).toBeGreaterThan(0);
  });

  it('moves one slider, rebalances the others to exactly 100%, says so, and queries again only on "Hitung ulang"', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('10 dari 514 wilayah');

    fireEvent.change(screen.getByLabelText('Bobot Persentase Penduduk Miskin (P0)'), {
      target: { value: '60' },
    });

    expect(screen.getByText(/^Total 100%/)).toBeInTheDocument();
    expect(screen.getByText(/Bobot lain ikut menyesuaikan/)).toBeInTheDocument();
    // Moving a slider never recalculates on its own: the ranking says it still uses the old weights.
    expect(screen.getByText('Bobot berubah. Peringkat masih memakai bobot sebelumnya.')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    recompute();
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    const next = bodies[1]?.weights ?? {};
    expect(next['soc_poverty_rate']).toBe(6000);
    expect(sumOf(next)).toBe(10000);
    expect(Object.values(next).every(Number.isInteger)).toBe(true);
  });

  it('resets to the starting weights', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: labFetch().fetchImpl });
    await screen.findByText('10 dari 514 wilayah');
    const slider = screen.getByLabelText('Bobot Persentase Penduduk Miskin (P0)');

    fireEvent.change(slider, { target: { value: '60' } });
    expect(slider).toHaveValue('60');
    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang bobot' }));
    expect(slider).toHaveValue('25');
  });

  it('adds and removes criteria while the total stays exactly 100%', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('10 dari 514 wilayah');

    openPicker();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Indeks Pembangunan Manusia (IPM / HDI)' }));
    recompute();
    await waitFor(() => {
      expect(Object.keys(bodies.at(-1)?.weights ?? {})).toContain('soc_hdi');
    });
    expect(sumOf(bodies.at(-1)?.weights ?? {})).toBe(10000);

    fireEvent.click(screen.getByRole('button', { name: 'Lepas kriteria Persentase Penduduk Miskin (P0)' }));
    recompute();
    await waitFor(() => {
      expect(Object.keys(bodies.at(-1)?.weights ?? {})).not.toContain('soc_poverty_rate');
    });
    expect(sumOf(bodies.at(-1)?.weights ?? {})).toBe(10000);
  });

  it('leaves out a starting criterion missing from the catalog and says so; nothing replaces it', async () => {
    const catalog = structuredClone(fixtureJson('indicators')) as {
      data: Record<string, { indicator_id: string }[]>;
    };
    catalog.data['disaster_risk'] = (catalog.data['disaster_risk'] ?? []).filter(
      (item) => item.indicator_id !== 'dis_multihazard_index',
    );
    const { fetchImpl, bodies } = labFetch(() => jsonResponse(catalog));
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(
      await screen.findByText(/Kriteria awal tanpa data tidak dipakai: dis_multihazard_index/),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(Object.keys(bodies[0]?.weights ?? {}).sort()).toEqual([
      'edu_damaged_classrooms_pct',
      'hlt_stunting_prevalence',
      'soc_poverty_rate',
    ]);
    expect(sumOf(bodies[0]?.weights ?? {})).toBe(10000);
  });

  it('shows a focused page of results, more on request, and finds a region by name', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: labFetch().fetchImpl });
    await screen.findByText('10 dari 514 wilayah');
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan 10 lagi' }));
    expect(screen.getByText('20 dari 514 wilayah')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cari wilayah dalam peringkat'), {
      target: { value: 'Lampung 11' },
    });
    expect(screen.getByText('1 hasil pencarian')).toBeInTheDocument();
  });

  it('is blocked in LIVE: a quiet note, no ranking, no query, and no DEMO numbers', async () => {
    const { fetchImpl, bodies } = labFetch(() => fixtureResponse('regions_live', 503));
    fetchImpl.mockImplementation(() => Promise.resolve(fixtureResponse('regions_live', 503)));
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByText('Tidak ada data LIVE untuk ditampilkan di sini.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// LIVE, contract v2.1. Fixtures under live-v2.1/ are CAPTURED PRODUCTION responses (2026-10-23): the
// catalog, the coverage matrix, the presets, the poverty / HDI / safe-water values, and the Jateng,
// Sumut and national composites that are replayed untouched. Any OTHER weight set is answered by the
// labContractMock simulator (a MOCK that follows the production rules and is checked against the captures
// in labContract.test.ts). Tests below say which one they rely on.
// ---------------------------------------------------------------------------------------------

const liveFiles = import.meta.glob<string>('../../services/api/__fixtures__/live-v2.1/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const live = (name: string): unknown => {
  const text = liveFiles[`../../services/api/__fixtures__/live-v2.1/${name}.json`];
  if (text === undefined) throw new Error(`Missing captured fixture: live-v2.1/${name}`);
  return JSON.parse(text);
};
const liveCatalog = () => live('indicators_catalog') as CapturedCatalog;
const capture = (name: string) =>
  live(name) as CapturedComposite & { data: { weights_basis_points: Record<string, number> } };

const POOL = buildPool([
  capture('composite_national_kemiskinan_stunting'),
  capture('composite_national_hdi'),
  capture('composite_national_pendidikan_3t'),
]);
/** Recorded production responses, returned untouched for exactly their request. */
const REPLAYS: Replay[] = [
  {
    body: {
      weights: capture('composite_jateng_kemiskinan_stunting').data.weights_basis_points,
      filter_province_id: '33',
    },
    response: live('composite_jateng_kemiskinan_stunting'),
  },
  {
    body: { weights: capture('composite_sumut_bencana').data.weights_basis_points, filter_province_id: '12' },
    response: live('composite_sumut_bencana'),
  },
  {
    body: {
      weights: capture('composite_national_kemiskinan_stunting').data.weights_basis_points,
      filter_province_id: null,
    },
    response: live('composite_national_kemiskinan_stunting'),
  },
];
const CAPTURED_VALUES = {
  soc_poverty_rate: live('values_soc_poverty_rate'),
  soc_hdi: live('values_soc_hdi'),
  inf_safe_water_pct: live('values_inf_safe_water_pct'),
};
const LIVE_DEFAULT_WEIGHTS = {
  soc_hdi: 3000,
  dis_multihazard_index: 3000,
  soc_poverty_rate: 2000,
  hlt_stunting_prevalence: 2000,
};

/** The 514 real LIVE region ids; names from the captured composites. */
function liveRegistryResponse(): Response {
  const { region_ids: ids } = fixtureJson('live/registry_ids') as { region_ids: string[] };
  const names = new Map(POOL.map((region) => [region.region_id, region.region_name]));
  return jsonResponse({
    status: 'success',
    meta: {
      snapshot_id: '2026.10.0-official-live',
      mode: 'LIVE',
      boundary_version: null,
      total_count: ids.length,
    },
    data: ids.map((id) => ({
      region_id: id,
      parent_region_id: id.slice(0, 2),
      province_name: `Provinsi ${id.slice(0, 2)}`,
      level: 'kabupaten',
      name: names.get(id) ?? `Wilayah ${id}`,
      short_name: id,
      codes: { bps: id },
    })),
  });
}

function liveLabFetch(overrides: Readonly<Record<string, FixtureHandler>> = {}) {
  const bodies: CompositeRequest[] = [];
  const handlers: Record<string, FixtureHandler> = {
    '/api/v1/indicators': () => jsonResponse(liveCatalog()),
    '/api/v1/indicators/coverage': () => jsonResponse(live('indicators_coverage')),
    '/api/v1/indicators/composite-presets': () =>
      jsonResponse(presetsResponse(live('composite_presets') as { data: unknown[] })),
    '/api/v1/regions': liveRegistryResponse,
    '/api/v1/indicators/composite-query': (_url, init) => {
      const body = requestBody(init);
      bodies.push(body);
      return jsonResponse(compositeResponse(POOL, body, REPLAYS));
    },
    ...overrides,
  };
  for (const item of Object.values(liveCatalog().data).flat()) {
    handlers[`/api/v1/indicators/${item.indicator_id}/values`] ??= () =>
      jsonResponse(valuesResponse(item.indicator_id, liveCatalog(), POOL, CAPTURED_VALUES));
  }
  return { fetchImpl: createFixtureFetch(handlers), bodies };
}

const simulatedDefault = () =>
  (
    compositeResponse(POOL, { weights: LIVE_DEFAULT_WEIGHTS, filter_province_id: null }) as {
      data: { total_regions: number; regions: { region_name: string; coverage_pct: number }[] };
    }
  ).data;

const renderLive = (overrides: Readonly<Record<string, FixtureHandler>> = {}) => {
  const lab = liveLabFetch(overrides);
  renderWithDataHub(<PriorityLab />, { fetchImpl: lab.fetchImpl, dataMode: 'LIVE' });
  return lab;
};
const rankingRegion = () => screen.findByRole('region', { name: 'Peringkat wilayah' });

describe('PriorityLab in LIVE (contract v2.1)', () => {
  it('lists every indicator, disables those without LIVE data and says why, with the need-oriented direction (captured catalog + coverage)', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');

    expect(screen.getByText(/25 dari 33 indikator punya data/)).toBeInTheDocument();
    openPicker();
    const empty = screen.getByRole('checkbox', {
      name: 'Persentase Ruang Kelas Rusak Sedang/Berat (SD & SMP)',
    });
    expect(empty).toBeDisabled();
    expect(empty).toHaveAccessibleDescription(/Belum ada data resmi untuk indikator ini pada snapshot LIVE/);
    const poverty = screen.getByRole('checkbox', { name: 'Persentase Penduduk Miskin (P0)' });
    expect(poverty).toBeChecked();
    expect(poverty).toHaveAccessibleDescription(
      /BPS .*percent.*Nilai rendah = kondisi lebih baik \(skor kebutuhan lebih rendah\).*514 wilayah/,
    );
  });

  it('ranks with rank 1 = highest need, explains the scale, and checks direction against the source (mock composite)', async () => {
    const { bodies } = renderLive();
    const expected = simulatedDefault();

    expect(await screen.findByText('Hasil siap dan sudah diperiksa')).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`^${String(expected.total_regions)} wilayah dihitung dari data resmi LIVE`),
      ),
    ).toBeInTheDocument();
    expect(bodies[0]?.weights).toEqual(LIVE_DEFAULT_WEIGHTS);
    const ranking = await rankingRegion();
    // One sentence above the ranking; the full reading is under "Cara membaca skor".
    expect(within(ranking).getByText(/makin tinggi, makin tinggi kebutuhan intervensi/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /makin tinggi skor, makin tinggi kebutuhannya, dan peringkat 1 adalah prioritas tertinggi/,
      ),
    ).toBeInTheDocument();
    expect(within(ranking).queryByText(/kondisi terbaik/i)).not.toBeInTheDocument();
    const firstRow = within(within(ranking).getByRole('list')).getAllByRole('button')[0];
    expect(firstRow).toHaveTextContent(expected.regions[0]?.region_name ?? 'tidak ada');
    expect(firstRow).toHaveTextContent(/^1/);
    // Direction under higher_is_need, checked on the captured production values.
    expect(
      screen.getByText(/Arah skor Persentase Penduduk Miskin \(P0\): sesuai data sumber \(\d+ wilayah/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Arah skor Indeks Pembangunan Manusia.*: sesuai data sumber/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat Paspor Bukti' })).toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  });

  it('charts the ranking, explains a selected region as weight x score, and reverses the view without renumbering', async () => {
    renderLive();
    const ranking = await rankingRegion();
    const list = within(ranking).getByRole('list');
    // Every row starts closed; opening one shows its breakdown right under it.
    expect(within(list).queryAllByRole('button', { expanded: true })).toHaveLength(0);
    expect(
      screen.queryByRole('table', { name: /Sumbangan setiap kriteria ke skor/ }),
    ).not.toBeInTheDocument();
    const first = within(list).getAllByRole('button')[0] as HTMLElement;
    const firstName = first.textContent;
    openRow(first);
    const detail = document.getElementById(first.getAttribute('aria-controls') ?? '');
    expect(detail).not.toBeNull();
    expect(
      within(detail as HTMLElement).getByRole('table', { name: /Sumbangan setiap kriteria ke skor/ }),
    ).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText('Skor gabungan')).toBeInTheDocument();
    // One region at a time: opening the second closes the first.
    const second = within(list).getAllByRole('button')[1] as HTMLElement;
    openRow(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(within(ranking).getByRole('button', { name: 'Terendah' }));
    const lowest = within(list).getAllByRole('button')[0] as HTMLElement;
    expect(lowest.textContent).not.toBe(firstName);
    // The lowest need carries the highest rank number; ranks are the Data Hub's, not renumbered from 1.
    expect(Number(/^\d+/.exec(lowest.textContent)?.[0])).toBeGreaterThan(400);
  });

  it('Jateng (captured): 35 returned, Wonosobo 35,06 is rank 1, Surakarta 9,57 is rank 35 at 70 % coverage with stunting omitted', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await chooseScope(/Jawa Tengah|Provinsi 33/);

    expect(
      await screen.findByText(/^35 wilayah di Provinsi 33 dihitung dari data resmi LIVE/),
    ).toBeInTheDocument();
    const ranking = await rankingRegion();
    const list = within(ranking).getByRole('list');
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent(/^1.*Kabupaten Wonosobo.*35,06/);
    // The captured national rank (80) is computed with Lanny Jaya, whose water score is inconsistent:
    // it is left out, never recomputed; the provincial order does not use Lanny Jaya and stays.
    expect(within(list).getAllByRole('button')[0]).not.toHaveTextContent('Peringkat nasional');
    expect(
      screen.getByText(
        /Peringkat nasional tidak ditampilkan: skor sumber Kabupaten Lanny Jaya \(9507\) \(di luar daftar ini\) tidak konsisten/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/4 wilayah dihitung dari sebagian kriteria saja/).length).toBeGreaterThan(0);

    fireEvent.click(within(ranking).getByRole('button', { name: 'Terendah' }));
    const surakarta = within(list).getAllByRole('button')[0];
    expect(surakarta).toHaveTextContent(/^35.*Kota Surakarta.*Data sebagian · 70% bobot.*9,57/);
    // Its breakdown, opened in its row, names the omitted criterion and does not turn it into a zero.
    openRow(surakarta as HTMLElement);
    const table = screen.getByRole('table', { name: /Sumbangan setiap kriteria ke skor Kota Surakarta/ });
    expect(
      within(table).getByText(
        /Data tidak tersedia untuk wilayah ini — tidak dihitung, bukan dihitung sebagai 0/,
      ),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 3 + 1 + 1); // header, 3 used, 1 omitted, total

    // Showing only complete regions hides the partial ones but renumbers nothing.
    fireEvent.click(screen.getByLabelText('Hanya data lengkap'));
    expect(screen.getByText(/4 wilayah berdata sebagian disembunyikan/)).toBeInTheDocument();
    expect(within(ranking).queryByText('Kota Surakarta')).not.toBeInTheDocument();
    expect(screen.getByText('10 dari 31 wilayah')).toBeInTheDocument();
  });

  it('Sumut disaster scenario (captured): Padangsidimpuan is listed as insufficient data, never ranked', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Mitigasi Bencana & Ketahanan Infrastruktur/);
    await chooseScope(/Sumatera Utara|Provinsi 12/);

    expect(
      await screen.findByText(/^32 wilayah di Provinsi 12 dihitung dari data resmi LIVE/),
    ).toBeInTheDocument();
    const insufficient = screen.getByRole('region', { name: /Tidak diperingkat: data belum cukup \(1\)/ });
    expect(within(insufficient).getByText(/Kota Padangsidimpuan/)).toHaveTextContent(
      'Kota Padangsidimpuan 1277',
    );
    expect(within(insufficient).getByText(/^Cakupan 33,3%/)).toBeInTheDocument();
    // The Data Hub's raw reason code is not shown (owner decision 2026-10-27).
    expect(insufficient).not.toHaveTextContent('COVERAGE_BELOW_THRESHOLD');
    expect(screen.getByText(/1 wilayah tidak diperingkat karena datanya belum cukup/)).toBeInTheDocument();
    const ranking = await rankingRegion();
    fireEvent.change(within(ranking).getByLabelText('Cari wilayah dalam peringkat'), {
      target: { value: 'Padangsidimpuan' },
    });
    expect(
      within(ranking).getByText(/Tidak ada wilayah yang cocok dengan “Padangsidimpuan”/),
    ).toBeInTheDocument();
  });

  it('national ties keep the server rank (captured 145, 145, 145) and an observed zero is shown as data; an imputed value is flagged', async () => {
    // SYNTHETIC: the water values cannot be loaded, so its direction is unverified (insufficient
    // evidence, a warning) instead of the known inconsistency that withholds this scenario.
    renderLive({
      '/api/v1/indicators/inf_safe_water_pct/values': () => jsonResponse({ detail: 'unavailable' }, 503),
    });
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await screen.findByText(/^513 wilayah dihitung dari data resmi LIVE/);
    expect(screen.getByText(/1 wilayah tidak diperingkat karena datanya belum cukup/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 wilayah memakai estimasi tingkat provinsi untuk sebagian kriteria/),
    ).toBeInTheDocument();

    const ranking = await rankingRegion();
    const search = within(ranking).getByLabelText('Cari wilayah dalam peringkat');
    for (const name of ['Bireuen', 'Sijunjung', 'Lampung Barat']) {
      fireEvent.change(search, { target: { value: name } });
      expect(within(within(ranking).getByRole('list')).getAllByRole('button')[0]).toHaveTextContent(/^145/);
    }
    fireEvent.change(search, { target: { value: 'Lanny Jaya' } });
    const lanny = within(within(ranking).getByRole('list')).getAllByRole('button')[0] as HTMLElement;
    expect(lanny).toHaveTextContent('Estimasi tingkat provinsi');
    fireEvent.click(lanny);
    const table = screen.getByRole('table', {
      name: /Sumbangan setiap kriteria ke skor Kabupaten Lanny Jaya/,
    });
    expect(within(table).getByText('Estimasi tingkat provinsi')).toBeInTheDocument();
  });

  it('withholds the Data Hub scenario marked rankable = false, even though the server returns scores (captured national 3T composite)', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse(live('composite_national_pendidikan_3t')),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    const option = await screen.findByRole('option', { name: /Pemerataan Kualitas Pendidikan Daerah 3T/ });
    expect(option).toHaveTextContent('Belum dapat diperingkat · data nasional 45% bobot');
    await chooseScenario(/Pemerataan Kualitas Pendidikan Daerah 3T/);
    recompute();
    expect(
      await screen.findByText(
        /Skenario “Pemerataan Kualitas Pendidikan Daerah 3T” ditandai Data Hub belum dapat diperingkat di LIVE \(hanya 45% bobotnya punya data nasional\)/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Sumbangan setiap kriteria/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/\[PRESET_NOT_RANKABLE\]/).length).toBeGreaterThan(0);
    // The chosen weights stay visible.
    expect(screen.getByText(/^Total 100%/)).toBeInTheDocument();
  });

  it('holds a CUSTOM scenario whose requested weight mostly lacks national data, and labels it as a Nusa Matra policy (mock composite)', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    // In the mock the pool lacks flood / asphalt / electrification, so only 35 % of this preset has data.
    await applyScenario(/Mitigasi Bencana & Ketahanan Infrastruktur/);
    expect(
      (await screen.findAllByText(/Kebijakan antarmuka Nusa Matra \(bukan aturan Data Hub\)/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/saat ini 35%/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
    expect(screen.queryByText(/ditandai Data Hub belum dapat diperingkat/)).not.toBeInTheDocument();
  });

  it('drops a preset whose weights are not exactly 100%, and says how many (synthetic invalid preset)', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    expect(screen.queryByRole('button', { name: 'Preset tidak lengkap' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 skenario dari Data Hub tidak ditampilkan/)).toBeInTheDocument();
    expect(screen.getByText(/bukan rekomendasi resmi/)).toBeInTheDocument();
    expect(
      screen.getByText(/tetap bisa dipilih untuk melihat bobotnya, tetapi peringkatnya tidak ditampilkan/),
    ).toBeInTheDocument();
  });

  it('withholds the pre-v2.1 composite (no score_direction, no region weights; captured 2026-10-22 v1)', async () => {
    renderLive({ '/api/v1/indicators/composite-query': () => jsonResponse(fixtureJson('live/composite')) });

    expect(await screen.findByText('Peringkat belum dapat ditampilkan')).toBeInTheDocument();
    expect(
      screen.getByText(/Arah skor dari Data Hub tidak jelas atau berbeda dari kontrak/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\[SCORE_DIRECTION_UNREPORTED\]/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dihitung sebagai 0, padahal data kosong bukan nol/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/Kota Surakarta \(3372\)/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
  });

  it('withholds a v2.1 response whose score does not follow from the region weights (synthetic tamper of the captured Jateng)', async () => {
    const tampered = structuredClone(live('composite_jateng_kemiskinan_stunting')) as {
      data: { regions: { region_id: string; composite_score: number }[] };
    };
    const surakarta = tampered.data.regions.find((row) => row.region_id === '3372');
    if (surakarta) surakarta.composite_score = 12.57;
    renderLive({ '/api/v1/indicators/composite-query': () => jsonResponse(tampered) });
    await chooseScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await chooseScope(/Jawa Tengah|Provinsi 33/);
    await waitFor(() => {
      expect(screen.getAllByText(/\[SCORE_MISMATCH\]/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
  });

  it('withholds a ranking whose component runs against the indicator direction', async () => {
    const catalog = structuredClone(liveCatalog()) as unknown as {
      data: Record<string, { indicator_id: string; polarity: string }[]>;
    };
    for (const items of Object.values(catalog.data)) {
      for (const item of items) if (item.indicator_id === 'soc_poverty_rate') item.polarity = 'positive';
    }
    renderLive({ '/api/v1/indicators': () => jsonResponse(catalog) });

    expect(await screen.findByText('Peringkat belum dapat ditampilkan')).toBeInTheDocument();
    expect(screen.getByText(/Arah skor tidak cocok dengan data sumber/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when the calculation fails, and never falls back to DEMO', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse({ detail: 'boom' }, 500),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByRole('button', { name: /Coba lagi/ })).toBeInTheDocument();
    expect(screen.getByText('Perhitungan belum berhasil')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
    expect(requestedUrls(fetchImpl).every((url) => url.searchParams.get('mode') === 'live')).toBe(true);
  });

  it('does not run without the coverage matrix in LIVE', async () => {
    const { fetchImpl, bodies } = liveLabFetch({
      '/api/v1/indicators/coverage': () => jsonResponse({ detail: 'boom' }, 500),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByRole('button', { name: /Coba lagi/ })).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});

describe('Paspor Bukti link in the calculation notes', () => {
  const link = () => screen.queryByRole('link', { name: 'Buat Paspor Bukti' });
  const withheldNote = 'Paspor Bukti tidak dibuat karena peringkat ditahan.';

  it('LIVE: links to the exact passport address, with weights, province, mode and snapshot of the result (captured Jateng)', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await chooseScope(/Jawa Tengah|Provinsi 33/);
    await screen.findByText(/^35 wilayah di Provinsi 33 dihitung dari data resmi LIVE/);

    const cta = await screen.findByRole('link', { name: 'Buat Paspor Bukti' });
    expect(cta.getAttribute('href')).toBe(
      '/paspor-bukti?jenis=lab&mode=live&snap=2026.10.0-official-live' +
        '&bobot=hlt_stunting_prevalence%3A3000%2Cinf_safe_sanitation_pct%3A2000%2Cinf_safe_water_pct%3A2000%2Csoc_poverty_rate%3A3000' +
        '&prov=33',
    );
    expect(screen.queryByText(withheldNote)).not.toBeInTheDocument();
  });

  it('takes mode and snapshot from the fetched result, not from anywhere else (synthetic snapshot id on the captured Jateng)', async () => {
    const other = structuredClone(live('composite_jateng_kemiskinan_stunting')) as {
      meta: { snapshot_id: string };
    };
    other.meta.snapshot_id = '2026.10.9-other-snapshot';
    renderLive({ '/api/v1/indicators/composite-query': () => jsonResponse(other) });
    await chooseScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    recompute();
    await chooseScope(/Jawa Tengah|Provinsi 33/);
    const cta = await screen.findByRole('link', { name: 'Buat Paspor Bukti' });
    expect(cta.getAttribute('href')).toContain('snap=2026.10.9-other-snapshot');
    expect(cta.getAttribute('href')).toContain('mode=live');
  });

  it('LIVE default scenario: the requested weights, national scope (no province parameter) (mock composite)', async () => {
    renderLive();
    const cta = await screen.findByRole('link', { name: 'Buat Paspor Bukti' });
    const href = cta.getAttribute('href') ?? '';
    expect(href).toContain(
      'bobot=dis_multihazard_index%3A3000%2Chlt_stunting_prevalence%3A2000%2Csoc_hdi%3A3000%2Csoc_poverty_rate%3A2000',
    );
    expect(href).not.toContain('prov=');
  });

  it('DEMO: links with mode=demo and the DEMO snapshot of the result', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: labFetch().fetchImpl });
    await screen.findByText('Data simulasi (DEMO)');
    const cta = await screen.findByRole('link', { name: 'Buat Paspor Bukti' });
    const href = cta.getAttribute('href') ?? '';
    expect(href).toContain('mode=demo');
    expect(href).toContain('snap=2026.10.0-wia-demo');
  });

  it('shows no link while loading, and none after a failed calculation', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse({ detail: 'boom' }, 500),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    expect(link()).not.toBeInTheDocument();
    await screen.findByText('Perhitungan belum berhasil');
    expect(link()).not.toBeInTheDocument();
  });

  it('shows no link for a scenario the Data Hub marks not rankable, and says why (captured national 3T composite)', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse(live('composite_national_pendidikan_3t')),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    await chooseScenario(/Pemerataan Kualitas Pendidikan Daerah 3T/);
    recompute();
    await screen.findByText(/ditandai Data Hub belum dapat diperingkat di LIVE/);
    expect(link()).not.toBeInTheDocument();
    expect(screen.getByText(withheldNote)).toBeInTheDocument();
  });

  it('shows no link when the policy gate or an integrity check withholds the ranking', async () => {
    renderLive();
    await screen.findByRole('link', { name: 'Buat Paspor Bukti' });
    // Mock composite: only 35 % of this preset has national data, so the frontend policy gate holds it.
    await applyScenario(/Mitigasi Bencana & Ketahanan Infrastruktur/);
    await screen.findAllByText(/Kebijakan antarmuka Nusa Matra \(bukan aturan Data Hub\)/);
    expect(link()).not.toBeInTheDocument();
    expect(screen.getByText(withheldNote)).toBeInTheDocument();
  });

  it('shows no link for the pre-v2.1 composite', async () => {
    renderLive({
      '/api/v1/indicators/composite-query': () => jsonResponse(fixtureJson('live/composite')),
    });
    await screen.findByText('Peringkat belum dapat ditampilkan');
    expect(link()).not.toBeInTheDocument();
    expect(screen.getByText(withheldNote)).toBeInTheDocument();
  });

  it('shows no link when the direction check against the source fails', async () => {
    const catalog = structuredClone(liveCatalog()) as unknown as {
      data: Record<string, { indicator_id: string; polarity: string }[]>;
    };
    for (const items of Object.values(catalog.data)) {
      for (const item of items) if (item.indicator_id === 'soc_poverty_rate') item.polarity = 'positive';
    }
    renderLive({ '/api/v1/indicators': () => jsonResponse(catalog) });
    await screen.findByText('Peringkat belum dapat ditampilkan');
    expect(link()).not.toBeInTheDocument();
  });
});

describe('A known direction anomaly withholds the ranking it reaches (captured national composite + captured water values)', () => {
  it('withholds the national ranking whose weighted water score for Lanny Jaya does not follow its raw value, and names it', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);

    expect(await screen.findByText('Peringkat ditahan: skor sumber tidak konsisten')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Skor Persentase Rumah Tangga Akses Air Minum Layak untuk Kabupaten Lanny Jaya \(9507\) di Data Hub tidak sesuai/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nilai mentah 32,89, skor terpublikasi 100\. Frontend tidak mengoreksi skor ini\./),
    ).toBeInTheDocument();
    // Withheld: no ranking, no chart, no passport; nothing removed and renumbered in its place.
    expect(screen.queryByRole('region', { name: 'Peringkat wilayah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buat Paspor Bukti' })).not.toBeInTheDocument();
    expect(screen.getByText('Paspor Bukti tidak dibuat karena peringkat ditahan.')).toBeInTheDocument();
  });

  it('shows the same scenario again once water carries no weight: an unaffected scenario is not blocked', async () => {
    const { bodies } = renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await screen.findByText('Peringkat ditahan: skor sumber tidak konsisten');
    openPicker();
    fireEvent.click(screen.getByRole('checkbox', { name: /Persentase Rumah Tangga Akses Air Minum Layak/ }));
    recompute();

    await waitFor(() => {
      expect(bodies.at(-1)?.weights.inf_safe_water_pct).toBeUndefined();
    });
    expect(await screen.findByRole('region', { name: 'Peringkat wilayah' })).toBeInTheDocument();
    expect(screen.queryByText('Peringkat ditahan: skor sumber tidak konsisten')).not.toBeInTheDocument();
  });

  it('keeps only a warning when the water values cannot be loaded (insufficient evidence, not a known inconsistency)', async () => {
    // SYNTHETIC: the values endpoint fails; nothing is known to be wrong, so nothing is withheld.
    renderLive({
      '/api/v1/indicators/inf_safe_water_pct/values': () => jsonResponse({ detail: 'unavailable' }, 503),
    });
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await screen.findByText(/^513 wilayah dihitung dari data resmi LIVE/);
    expect(screen.getByText(/Pemeriksaan arah skor belum selesai/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Peringkat wilayah' })).toBeInTheDocument();
    expect(screen.queryByText('Peringkat ditahan: skor sumber tidak konsisten')).not.toBeInTheDocument();
  });

  it('never fetches LIVE values for a DEMO ranking', async () => {
    const { fetchImpl } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('Data simulasi (DEMO)');
    expect(requestedUrls(fetchImpl).some((url) => url.pathname.endsWith('/values'))).toBe(false);
    expect(screen.queryByText('Peringkat ditahan: skor sumber tidak konsisten')).not.toBeInTheDocument();
  });
});

describe('A province filter keeps its own ranking when the anomaly lies outside it (captured Jateng + captured water values)', () => {
  it('shows the provincial ranking, withholds only the national ranks, and still reports the verified checks', async () => {
    renderLive();
    await screen.findByText('Hasil siap dan sudah diperiksa');
    await applyScenario(/Pengentasan Kemiskinan Ekstrem & Stunting/);
    await chooseScope(/Jawa Tengah|Provinsi 33/);
    await screen.findByText(/^35 wilayah di Provinsi 33 dihitung dari data resmi LIVE/);

    expect(screen.getByRole('region', { name: 'Peringkat wilayah' })).toBeInTheDocument();
    expect(screen.queryByText(/Peringkat nasional \d/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Peringkat nasional tidak ditampilkan: skor sumber Kabupaten Lanny Jaya \(9507\)/),
    ).toBeInTheDocument();
    // The passport stays available for this scenario; it carries the same national-rank limitation.
    expect(screen.getByRole('link', { name: 'Buat Paspor Bukti' })).toBeInTheDocument();
    // Poverty has verified raw values: it is checked and consistent.
    expect(
      screen.getByText(/Arah skor Persentase Penduduk Miskin \(P0\): sesuai data sumber \(\d+ wilayah\)/),
    ).toBeInTheDocument();
  });
});
