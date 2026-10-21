import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  createFixtureFetch,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { PriorityLab } from './PriorityLab';

interface CompositeRequest {
  readonly weights: Record<string, number>;
  readonly filter_province_id: string | null;
}

function labFetch(catalog: () => Response = () => fixtureResponse('indicators')) {
  const bodies: CompositeRequest[] = [];
  const fetchImpl = createFixtureFetch({
    '/api/v1/indicators': catalog,
    '/api/v1/regions': () => fixtureResponse('regions_nonempty'),
    '/api/v1/indicators/composite-query': (_url, init) => {
      bodies.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as CompositeRequest);
      return fixtureResponse('composite_valid');
    },
  });
  return { fetchImpl, bodies };
}

const sumOf = (weights: Record<string, number>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);

/** The 514 real LIVE region ids, as minimal registry rows (name and codes are not what is checked here). */
function liveRegistryResponse(): Response {
  const { region_ids: ids } = fixtureJson('live/registry_ids') as { region_ids: string[] };
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
      province_name: 'Provinsi Uji',
      level: 'kabupaten',
      name: `Wilayah ${id}`,
      short_name: id,
      codes: { bps: id },
    })),
  });
}

describe('PriorityLab on the deployed LIVE composite (captured)', () => {
  function liveFetch() {
    return createFixtureFetch({
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
      '/api/v1/regions': liveRegistryResponse,
      '/api/v1/indicators/composite-query': () => jsonResponse(fixtureJson('live/composite')),
    });
  }

  it('withholds the ranking and says why: 27 regions uncovered and empty components scored as 0', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: liveFetch(), dataMode: 'LIVE' });

    expect(await screen.findByText('Peringkat ditahan: hasil komposit tidak konsisten')).toBeInTheDocument();
    expect(screen.getByText(/487 wilayah, sedangkan daftar wilayah snapshot ini 514/)).toBeInTheDocument();
    expect(screen.getByText(/dihitung sebagai 0, padahal data kosong bukan nol/)).toBeInTheDocument();
    expect(screen.queryByText(/Kota Administrasi Jakarta Selatan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  });

  it('starts from criteria the LIVE snapshot has data for, not the DEMO set with an empty criterion', async () => {
    const bodies: CompositeRequest[] = [];
    const fetchImpl = createFixtureFetch({
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
      '/api/v1/regions': liveRegistryResponse,
      '/api/v1/indicators/composite-query': (_url, init) => {
        bodies.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as CompositeRequest);
        return jsonResponse(fixtureJson('live/composite'));
      },
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Peringkat ditahan: hasil komposit tidak konsisten');

    expect(bodies[0]?.weights).toEqual({
      soc_hdi: 3000,
      dis_multihazard_index: 3000,
      soc_poverty_rate: 2000,
      hlt_stunting_prevalence: 2000,
    });
  });

  it('explains that a high score means better relative conditions, not higher intervention priority', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: liveFetch(), dataMode: 'LIVE' });
    await screen.findByText('Peringkat ditahan: hasil komposit tidak konsisten');

    expect(screen.getByText(/bukan wilayah dengan prioritas intervensi tertinggi/)).toBeInTheDocument();
  });
});

describe('PriorityLab (exploratory DEMO composite query)', () => {
  it('starts from the Data Hub preview weights and labels the ranking as a DEMO preview without a run id', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(await screen.findByText('Menampilkan 10 dari 514 wilayah', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Pratinjau Simulasi DEMO (Tanpa Run ID Imutabel)')).toBeInTheDocument();
    expect(screen.getByText('Simulasi — bukan data atau rekomendasi resmi.')).toBeInTheDocument();
    expect(bodies[0]).toEqual({
      weights: {
        dis_multihazard_index: 3500,
        soc_poverty_rate: 2500,
        edu_damaged_classrooms_pct: 2000,
        hlt_stunting_prevalence: 2000,
      },
      filter_province_id: null,
    });

    const first = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent.includes('Kabupaten Demo Lampung 11'));
    expect(first).toHaveTextContent('1');
    expect(first).toHaveTextContent('91,1');
  });

  it('flags a composite whose scores do not reproduce from its components, and neither hides nor repairs it', async () => {
    const tampered = fixtureJson('composite_valid') as {
      data: { regions: { composite_score: number }[] };
    };
    const [first] = tampered.data.regions;
    if (!first) throw new Error('fixture has no rows');
    first.composite_score = 12.34;
    const fetchImpl = createFixtureFetch({
      '/api/v1/indicators': () => fixtureResponse('indicators'),
      '/api/v1/regions': () => fixtureResponse('regions_nonempty'),
      '/api/v1/indicators/composite-query': () => jsonResponse(tampered),
    });
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(await screen.findByText('Hasil komposit tidak konsisten')).toBeInTheDocument();
    expect(screen.getByText(/tidak sama dengan jumlah berbobot skor komponennya/)).toBeInTheDocument();
    // DEMO still shows its (simulated) rows, exactly as the backend sent them.
    expect(screen.getAllByText('12,34').length).toBeGreaterThan(0);
  });

  it('does not present component scores as weighted contributions and keeps the explanation gated', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: labFetch().fetchImpl });
    await screen.findByText('Menampilkan 10 dari 514 wilayah', { exact: false });

    expect(screen.getAllByText('Skor komponen (ternormalisasi)').length).toBeGreaterThan(0);
    expect(screen.getByText(/Rincian kontribusi berbobot.*belum tersedia/)).toBeInTheDocument();
    expect(screen.queryByText(/kontribusi: /i)).not.toBeInTheDocument();
  });

  it('moves one slider, rebalances the others to exactly 100%, and queries again with the new weights', async () => {
    const { fetchImpl, bodies } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('Menampilkan 10 dari 514 wilayah', { exact: false });

    fireEvent.change(screen.getByLabelText('Persentase Penduduk Miskin (P0)'), { target: { value: '60' } });

    expect(screen.getByText(/^Total: 100%/)).toBeInTheDocument();
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    const next = bodies[1]?.weights ?? {};
    expect(next['soc_poverty_rate']).toBe(6000);
    expect(sumOf(next)).toBe(10000);
    expect(Object.values(next).every(Number.isInteger)).toBe(true);
  });

  it('resets to the starting weights', async () => {
    const { fetchImpl } = labFetch();
    renderWithDataHub(<PriorityLab />, { fetchImpl });
    await screen.findByText('Menampilkan 10 dari 514 wilayah', { exact: false });
    const slider = screen.getByLabelText('Persentase Penduduk Miskin (P0)');

    fireEvent.change(slider, { target: { value: '60' } });
    expect(slider).toHaveValue('60');
    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang bobot' }));

    expect(slider).toHaveValue('25');
  });

  it('refuses to substitute criteria when one is missing from the catalog, and sends no query', async () => {
    const catalog = structuredClone(fixtureJson('indicators')) as {
      data: Record<string, { indicator_id: string }[]>;
    };
    catalog.data['disaster_risk'] = (catalog.data['disaster_risk'] ?? []).filter(
      (item) => item.indicator_id !== 'dis_multihazard_index',
    );
    const { fetchImpl, bodies } = labFetch(() => jsonResponse(catalog));
    renderWithDataHub(<PriorityLab />, { fetchImpl });

    expect(await screen.findByText('Kriteria awal tidak ada di katalog Data Hub')).toBeInTheDocument();
    expect(screen.getByText(/dis_multihazard_index/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('is blocked in LIVE: a quiet note, no ranking, no query, and no DEMO numbers', async () => {
    const { fetchImpl, bodies } = labFetch(() => fixtureResponse('regions_live', 503));
    renderWithDataHub(<PriorityLab />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByText('Tidak ada data LIVE untuk ditampilkan di sini.')).toBeInTheDocument();
    expect(screen.queryByText('Pratinjau peringkat')).not.toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('keeps showing more rows on request', async () => {
    renderWithDataHub(<PriorityLab />, { fetchImpl: labFetch().fetchImpl });
    await screen.findByText('Menampilkan 10 dari 514 wilayah', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan 10 lagi' }));
    expect(screen.getByText('Menampilkan 20 dari 514 wilayah', { exact: false })).toBeInTheDocument();
  });
});
