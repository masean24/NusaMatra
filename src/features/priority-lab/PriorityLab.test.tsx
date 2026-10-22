import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  coverageResponse,
  compositeResponse,
  presetsResponse,
  valuesResponse,
  type CapturedCatalog,
  type CapturedComposite,
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
  const details = screen.getByText('Pilih kriteria').closest('details');
  if (!details) throw new Error('no criteria picker');
  details.open = true;
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

    const first = screen.getByText('Kabupaten Demo Lampung 11').closest('li');
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

  it('moves one slider, rebalances the others to exactly 100%, says so, and queries again', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('10 dari 514 wilayah');

    fireEvent.change(screen.getByLabelText('Bobot Persentase Penduduk Miskin (P0)'), {
      target: { value: '60' },
    });

    expect(screen.getByText(/^Total: 100%/)).toBeInTheDocument();
    expect(screen.getByText(/Bobot lain ikut menyesuaikan/)).toBeInTheDocument();
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
    await waitFor(() => {
      expect(Object.keys(bodies.at(-1)?.weights ?? {})).toContain('soc_hdi');
    });
    expect(sumOf(bodies.at(-1)?.weights ?? {})).toBe(10000);

    fireEvent.click(screen.getByRole('button', { name: 'Lepas kriteria Persentase Penduduk Miskin (P0)' }));
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
    expect(screen.queryByRole('region', { name: 'Daftar peringkat' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// LIVE: the guide v2 contract, simulated from the captured LIVE responses (labContractMock).
// ---------------------------------------------------------------------------------------------

const liveCatalog = () => fixtureJson('live/indicators') as CapturedCatalog;
const liveComposite = () => fixtureJson('live/composite') as CapturedComposite;

/** The 514 real LIVE region ids; names from the captured composite where it has them. */
function liveRegistryResponse(): Response {
  const { region_ids: ids } = fixtureJson('live/registry_ids') as { region_ids: string[] };
  const names = new Map(liveComposite().data.regions.map((region) => [region.region_id, region.region_name]));
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
  const poverty = fixtureJson('live/indicator_values_soc_poverty_rate');
  const handlers: Record<string, FixtureHandler> = {
    '/api/v1/indicators': () => jsonResponse(liveCatalog()),
    '/api/v1/indicators/coverage': () => jsonResponse(coverageResponse(liveCatalog(), liveComposite())),
    '/api/v1/indicators/composite-presets': () => jsonResponse(presetsResponse()),
    '/api/v1/regions': liveRegistryResponse,
    '/api/v1/indicators/composite-query': (_url, init) => {
      const body = requestBody(init);
      bodies.push(body);
      return jsonResponse(compositeResponse(liveComposite(), body));
    },
    ...overrides,
  };
  for (const id of ['soc_hdi', 'dis_multihazard_index', 'soc_poverty_rate', 'hlt_stunting_prevalence']) {
    handlers[`/api/v1/indicators/${id}/values`] ??= () =>
      jsonResponse(valuesResponse(id, liveCatalog(), liveComposite(), poverty));
  }
  return { fetchImpl: createFixtureFetch(handlers), bodies };
}

/** Regions with all four captured components: the complete-case population of the default criteria. */
const completeRegions = () =>
  liveComposite().data.regions.filter((region) =>
    ['soc_hdi', 'dis_multihazard_index', 'soc_poverty_rate', 'hlt_stunting_prevalence'].every(
      (id) => typeof region.component_scores[id] === 'number',
    ),
  ).length;

describe('PriorityLab in LIVE (guide v2 contract, simulated from captured LIVE data)', () => {
  it('lists every indicator, disables those without LIVE data and says why, with source, year and unit', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: liveLabFetch().fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Hasil siap dan sudah diperiksa');

    expect(screen.getByText(/4 dari 33 indikator punya data/)).toBeInTheDocument();
    openPicker();
    const empty = screen.getByRole('checkbox', {
      name: 'Persentase Ruang Kelas Rusak Sedang/Berat (SD & SMP)',
    });
    expect(empty).toBeDisabled();
    expect(empty).toHaveAccessibleDescription(/Belum ada data resmi untuk indikator ini pada snapshot LIVE/);
    const poverty = screen.getByRole('checkbox', { name: 'Persentase Penduduk Miskin (P0)' });
    expect(poverty).toBeChecked();
    expect(poverty).toHaveAccessibleDescription(
      /BPS .*percent.*Nilai rendah = kondisi lebih baik.*dari 514 wilayah/,
    );
  });

  it('ranks the regions with complete data, discloses the rest, and checks direction against the source', async () => {
    const { fetchImpl, bodies } = liveLabFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    const complete = completeRegions();
    expect(await screen.findByText('Hasil siap dan sudah diperiksa')).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`^${String(complete)} wilayah dihitung dari data resmi LIVE`)),
    ).toHaveTextContent(`${String(514 - complete)} wilayah belum lengkap datanya dan tidak ikut`);
    expect(bodies[0]?.weights).toEqual({
      soc_hdi: 3000,
      dis_multihazard_index: 3000,
      soc_poverty_rate: 2000,
      hlt_stunting_prevalence: 2000,
    });
    // The technical facts are kept, behind "Sumber, metodologi & pemeriksaan".
    expect(screen.getByText(`${String(514 - complete)} wilayah tidak ikut dihitung`)).toBeInTheDocument();
    expect(screen.getByText(/Wilayah ini tidak diberi skor, bukan diberi skor nol/)).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(
          `Arah skor Persentase Penduduk Miskin \\(P0\\): sesuai data sumber \\(${String(complete)} wilayah\\)`,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/belum disimpan dan belum punya ID permanen/)).toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  });

  it('charts the ranking and explains the selected region as the sum of its weighted criteria', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: liveLabFetch().fetchImpl, dataMode: 'LIVE' });
    const ranking = await screen.findByRole('region', { name: 'Daftar peringkat' });
    const list = within(ranking).getByRole('list');
    const rows = within(list).getAllByRole('button', { pressed: false });
    expect(within(list).getByRole('button', { pressed: true })).toHaveTextContent(
      'Kota Administrasi Jakarta Selatan',
    );

    const table = screen.getByRole('table', {
      name: /Sumbangan setiap kriteria ke skor Kota Administrasi Jakarta Selatan/,
    });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 4 + 1); // header, four criteria, total
    expect(within(table).getByText('Skor gabungan')).toBeInTheDocument();

    const second = rows.find((row) => row.textContent.includes('Kota Tangerang Selatan'));
    if (!second) throw new Error('no second row');
    fireEvent.click(second);
    expect(
      screen.getByRole('table', { name: /Sumbangan setiap kriteria ke skor Kota Tangerang Selatan/ }),
    ).toBeInTheDocument();

    fireEvent.click(within(ranking).getByRole('button', { name: 'Kondisi paling berat dulu' }));
    expect(within(list).getByRole('button', { pressed: true })).not.toHaveTextContent(
      'Kota Administrasi Jakarta Selatan',
    );
  });

  it('applies a Data Hub preset with an indicator without data, and explains where its weight went', async () => {
    const { fetchImpl, bodies } = liveLabFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Hasil siap dan sudah diperiksa');

    fireEvent.click(screen.getByRole('button', { name: 'Risiko bencana & sekolah' }));
    expect(screen.getByRole('button', { name: 'Risiko bencana & sekolah' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Belum ada data — bobotnya akan dialihkan.')).toBeInTheDocument();
    await waitFor(() => {
      expect(bodies.at(-1)?.weights['edu_damaged_classrooms_pct']).toBe(2000);
    });

    // The weight chart shows both bars and says where the weight went.
    expect(
      await screen.findByText(/belum punya data, jadi bobotnya dibagi ke kriteria lain/),
    ).toBeInTheDocument();
    expect(screen.getByText('20% → tidak dipakai')).toBeInTheDocument();
    expect(screen.getByText('35% → 43,75%')).toBeInTheDocument();
    const table = screen.getByRole('table', {
      name: /Bobot pilihan Anda dan bobot yang benar-benar dipakai/,
    });
    expect(within(table).getByText('Tidak dipakai (tanpa data)')).toBeInTheDocument();
    // 35/25/20 % of the rest becomes 43,75/31,25/25 %.
    expect(within(table).getByText('43,75%')).toBeInTheDocument();
    expect(within(table).getByText('31,25%')).toBeInTheDocument();
  });

  it('drops a preset whose weights are not exactly 100%, and says how many', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: liveLabFetch().fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Hasil siap dan sudah diperiksa');
    expect(screen.queryByRole('button', { name: 'Preset tidak lengkap' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 skenario dari Data Hub tidak ditampilkan/)).toBeInTheDocument();
    expect(screen.getByText(/bukan rekomendasi resmi/)).toBeInTheDocument();
  });

  it('limits the ranking to one province and checks every region belongs to it', async () => {
    const { fetchImpl, bodies } = liveLabFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Hasil siap dan sudah diperiksa');

    fireEvent.change(screen.getByLabelText('Cakupan wilayah'), { target: { value: '33' } });
    await waitFor(() => {
      expect(bodies.at(-1)?.filter_province_id).toBe('33');
    });
    expect(await screen.findByText(/wilayah di Provinsi 33 dihitung/)).toBeInTheDocument();
    expect(screen.queryByText('Peringkat belum dapat ditampilkan')).not.toBeInTheDocument();
  });

  it('withholds the deployed v1 composite: empty values scored as 0 (counterexample Kota Surakarta)', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse(liveComposite()),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByText('Peringkat belum dapat ditampilkan')).toBeInTheDocument();
    expect(screen.getByText(/Sebagian data wilayah belum lengkap. Hasil ditahan/)).toBeInTheDocument();
    // The facts stay one click away: the zero-filled scores, with a named counterexample.
    expect(screen.getByText('Lihat alasan dan detail teknis')).toBeInTheDocument();
    expect(screen.getAllByText(/dihitung sebagai 0, padahal data kosong bukan nol/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/Kota Surakarta \(3372\)/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Daftar peringkat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Sumbangan setiap kriteria/ })).not.toBeInTheDocument();
    // The chosen weights stay visible.
    expect(screen.getByText('Pembagian bobot')).toBeInTheDocument();
  });

  it('withholds a ranking whose component runs against the indicator direction', async () => {
    const catalog = structuredClone(liveCatalog()) as unknown as {
      data: Record<string, { indicator_id: string; polarity: string }[]>;
    };
    for (const item of catalog.data['socioeconomic'] ?? []) {
      if (item.indicator_id === 'soc_poverty_rate') item.polarity = 'positive';
    }
    const { fetchImpl } = liveLabFetch({ '/api/v1/indicators': () => jsonResponse(catalog) });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByText('Peringkat belum dapat ditampilkan')).toBeInTheDocument();
    expect(screen.getByText(/Arah skor tidak cocok dengan data sumber/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Daftar peringkat' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when the calculation fails, and never falls back to DEMO', async () => {
    const { fetchImpl } = liveLabFetch({
      '/api/v1/indicators/composite-query': () => jsonResponse({ detail: 'boom' }, 500),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByRole('button', { name: /Coba lagi/ })).toBeInTheDocument();
    expect(screen.getByText('Perhitungan belum berhasil')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Daftar peringkat' })).not.toBeInTheDocument();
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
