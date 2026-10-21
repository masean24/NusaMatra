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
    '/api/v1/indicators/composite-query': (_url, init) => {
      bodies.push(JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as CompositeRequest);
      return fixtureResponse('composite_valid');
    },
  });
  return { fetchImpl, bodies };
}

const sumOf = (weights: Record<string, number>) =>
  Object.values(weights).reduce((sum, value) => sum + value, 0);

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
