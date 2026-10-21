import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureJson,
  jsonResponse,
  present,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { RegionComparison } from './RegionComparison';

interface WireIndicator {
  indicator_id: string;
  indicator_name: string;
  raw_value: number | null;
  reference_year: number | null;
  quality_flag: string;
}

interface WireDetail {
  data: { region: { region_id: string; name: string; short_name: string }; indicators: WireIndicator[] };
}

/** The captured LIVE profile of 1101 (Aceh Selatan), kept as region A. */
function profileA(): WireDetail {
  return structuredClone(fixtureJson('live/region_detail_1101')) as WireDetail;
}

/** Region B: the same captured profile under another region, with the cases a comparison must handle. */
function profileB(): WireDetail {
  const detail = profileA();
  detail.data.region = { ...detail.data.region, region_id: '1102', name: 'Kabupaten Uji', short_name: 'Uji' };
  const find = (id: string) =>
    present(
      detail.data.indicators.find((indicator) => indicator.indicator_id === id),
      id,
    );
  find('soc_hdi').reference_year = 2021;
  find('hlt_stunting_prevalence').raw_value = null;
  find('soc_poverty_rate').raw_value = 19.78;
  return detail;
}

function comparisonFetch() {
  return createFixtureFetch({
    '/api/v1/regions/1101': () => jsonResponse(profileA()),
    '/api/v1/regions/1102': () => jsonResponse(profileB()),
    '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
  });
}

/** Renders 1101 against 1102 and waits until both pickers and the table have settled. */
async function renderComparison() {
  const utils = renderWithDataHub(<RegionComparison />, {
    fetchImpl: comparisonFetch(),
    dataMode: 'LIVE',
    path: '/bandingkan?a=1101&b=1102',
  });
  await screen.findByText(/Dari 16 indikator/);
  await screen.findByText(/kode 1101/);
  await screen.findByText(/kode 1102/);
  return utils;
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe('RegionComparison on captured LIVE profiles', () => {
  it('compares matching indicators and states which region is higher, with year and source', async () => {
    await renderComparison();

    const row = within(rowOf('Persentase Penduduk Miskin (P0)'));
    expect(row.getByText(/Uji 2,0× lebih tinggi|Uji 2× lebih tinggi/)).toBeInTheDocument();
    expect(row.getByText('2025 · BPS')).toBeInTheDocument();
    expect(row.getByText('9,89')).toBeInTheDocument();
    expect(row.getByText('19,78')).toBeInTheDocument();
  });

  it('explains a lower-is-better gap in words and names the better side, from the catalog polarity', async () => {
    await renderComparison();

    const row = within(rowOf('Persentase Penduduk Miskin (P0)'));
    expect(row.getByText('Lebih baik: Aceh Selatan')).toBeInTheDocument();
    expect(
      row.getByText(/Persentase Penduduk Miskin \(P0\) Uji sekitar 2× lebih tinggi dibanding Aceh Selatan\./),
    ).toBeInTheDocument();
    expect(
      row.getByText(/Nilai yang lebih rendah menunjukkan kondisi yang lebih baik pada indikator ini\./),
    ).toBeInTheDocument();
  });

  it('flags the hazard unit the data contradicts instead of printing it', async () => {
    await renderComparison();

    const row = within(rowOf('Indeks Bahaya Banjir (Rata-rata Wilayah)'));
    expect(row.getByText(/Sumber menyebut skala 0–1, tetapi nilainya mencapai/)).toBeInTheDocument();
    expect(row.queryByText(/0\.0-1\.0/)).not.toBeInTheDocument();
  });

  it('keeps comparing across different years but says so', async () => {
    await renderComparison();

    const row = within(rowOf('Indeks Pembangunan Manusia (IPM / HDI)'));
    expect(row.getByText('Tahun data berbeda (2024 dan 2021).')).toBeInTheDocument();
    expect(row.queryByText('Tidak dibandingkan')).not.toBeInTheDocument();
  });

  it('blocks a missing value instead of reading it as 0', async () => {
    await renderComparison();

    const row = within(rowOf('Prevalensi Balita Stunting'));
    expect(row.getByText('Tidak dibandingkan')).toBeInTheDocument();
    expect(row.getByText('Data belum tersedia')).toBeInTheDocument();
    expect(row.getByText('Salah satu wilayah tidak memiliki data untuk indikator ini.')).toBeInTheDocument();
  });

  it('blocks values imputed from the province', async () => {
    await renderComparison();

    const row = within(rowOf('Persentase Rumah Tangga Pengguna Listrik (PLN & Non-PLN)'));
    expect(row.getByText('Tidak dibandingkan')).toBeInTheDocument();
    expect(row.getByText(/diimputasi dari nilai provinsi/)).toBeInTheDocument();
  });

  it('counts what could and could not be compared', async () => {
    await renderComparison();

    expect(
      screen.getByText(/Dari 16 indikator, 13 dapat dibandingkan dan 3 tidak dibandingkan/),
    ).toBeInTheDocument();
  });

  it('swaps the two regions in the URL', async () => {
    const { router } = await renderComparison();

    await userEvent.click(screen.getByRole('button', { name: 'Tukar wilayah' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?a=1102&b=1101');
    });
  });

  it('asks for two regions when none are chosen and fetches no profile', () => {
    const fetchImpl = comparisonFetch();
    renderWithDataHub(<RegionComparison />, { fetchImpl, dataMode: 'LIVE', path: '/bandingkan' });

    expect(screen.getByText('Pilih dua wilayah')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses to compare a region with itself', async () => {
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: comparisonFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1101',
    });

    expect(screen.getByText('Pilih dua wilayah yang berbeda')).toBeInTheDocument();
    await screen.findAllByText(/kode 1101/);
  });

  it('searches the region list and puts the chosen region in the URL', async () => {
    const searches: string[] = [];
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions': (url) => {
        searches.push(url.searchParams.get('q') ?? '');
        return jsonResponse({
          status: 'success',
          meta: {
            snapshot_id: '2026.10.0-official-live',
            mode: 'LIVE',
            boundary_version: null,
            total_count: 1,
          },
          data: [
            {
              region_id: '3171',
              parent_region_id: '31',
              province_name: 'Provinsi DKI Jakarta',
              level: 'kota',
              name: 'Kota Administrasi Jakarta Pusat',
              short_name: 'Jakarta Pusat',
              codes: { bps: '3171' },
            },
          ],
        });
      },
      '/api/v1/regions/3171': () =>
        jsonResponse({
          ...profileA(),
          data: {
            ...profileA().data,
            region: { ...profileA().data.region, region_id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
          },
        }),
    });
    const { router } = renderWithDataHub(<RegionComparison />, {
      fetchImpl,
      dataMode: 'LIVE',
      path: '/bandingkan',
    });

    await userEvent.type(screen.getByLabelText('Cari Wilayah A'), 'jakarta');
    await userEvent.click(await screen.findByRole('button', { name: /Kota Administrasi Jakarta Pusat/ }));

    expect(searches).toContain('jakarta');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?a=3171');
    });
    await screen.findByText(/kode 3171/);
  });
});
