import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureJson,
  jsonResponse,
  present,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { RegionComparison, type ComparisonView } from './RegionComparison';

interface WireIndicator {
  indicator_id: string;
  indicator_name: string;
  category: string;
  raw_value: number | null;
  unit: string;
  reference_year: number | null;
  quality_flag: string;
  provenance?: Record<string, unknown>;
}

interface WireDetail {
  meta: { snapshot_id: string };
  data: { region: { region_id: string; name: string; short_name: string }; indicators: WireIndicator[] };
}

type Mutation = (detail: WireDetail) => void;

function indicatorOf(detail: WireDetail, id: string): WireIndicator {
  return present(
    detail.data.indicators.find((indicator) => indicator.indicator_id === id),
    id,
  );
}

/** The captured LIVE profile of 1101 (Aceh Selatan), kept as region A. */
function profileA(mutate?: Mutation): WireDetail {
  const detail = structuredClone(fixtureJson('live/region_detail_1101')) as WireDetail;
  mutate?.(detail);
  return detail;
}

/** Region B: the same captured profile under another region, with the cases a comparison must handle. */
function profileB(mutate?: Mutation): WireDetail {
  const detail = profileA();
  detail.data.region = { ...detail.data.region, region_id: '1102', name: 'Kabupaten Uji', short_name: 'Uji' };
  indicatorOf(detail, 'soc_hdi').reference_year = 2021;
  indicatorOf(detail, 'hlt_stunting_prevalence').raw_value = null;
  indicatorOf(detail, 'soc_poverty_rate').raw_value = 19.78;
  mutate?.(detail);
  return detail;
}

/** Region B identical to A apart from its identity, so every difference in a test is deliberate. */
function plainProfileB(mutate?: Mutation): WireDetail {
  const detail = profileA();
  detail.data.region = { ...detail.data.region, region_id: '1102', name: 'Kabupaten Uji', short_name: 'Uji' };
  mutate?.(detail);
  return detail;
}

interface FetchOptions {
  readonly mutateA?: Mutation;
  readonly mutateB?: Mutation;
  /** Use region B with no built-in differences from A. */
  readonly plainB?: boolean;
  readonly catalogStatus?: number;
  readonly statusA?: number;
  /** Most checks read sources and reasons, which only the detail page shows. */
  readonly view?: ComparisonView;
}

function comparisonFetch({
  mutateA,
  mutateB,
  plainB = false,
  catalogStatus = 200,
  statusA = 200,
}: FetchOptions = {}) {
  return createFixtureFetch({
    '/api/v1/regions/1101': () =>
      statusA === 200 ? jsonResponse(profileA(mutateA)) : jsonResponse({ status: 'error' }, statusA),
    '/api/v1/regions/1102': () => jsonResponse(plainB ? plainProfileB(mutateB) : profileB(mutateB)),
    '/api/v1/indicators': () =>
      catalogStatus === 200
        ? jsonResponse(fixtureJson('live/indicators'))
        : jsonResponse({ status: 'error' }, catalogStatus),
  });
}

/** Renders 1101 against 1102 and waits until the table (and, in the summary, both pickers) settled. */
async function renderComparison({ view = 'detail', ...options }: FetchOptions = {}) {
  const utils = renderWithDataHub(<RegionComparison view={view} />, {
    fetchImpl: comparisonFetch(options),
    dataMode: 'LIVE',
    path: `${view === 'detail' ? '/bandingkan/rincian' : '/bandingkan'}?a=1101&b=1102`,
  });
  await screen.findByText(/Dari \d+ indikator wilayah/);
  if (view === 'summary') {
    await screen.findByText(/kode 1101/);
    await screen.findByText(/kode 1102/);
  }
  return utils;
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

const POVERTY = 'Persentase Penduduk Miskin (P0)';

/**
 * The region whose bar a row colours as the better condition (green), read from its value cell's
 * label; the cell also says it in words for screen readers.
 */
function betterSide(row: HTMLElement): string | null {
  const bar = row.querySelector('[data-outcome="better"]');
  const cell = bar?.closest('td');
  if (cell && !within(cell).queryByText(/kondisi lebih baik/)) return 'no words';
  return cell?.getAttribute('data-label') ?? null;
}

describe('RegionComparison on captured LIVE profiles', () => {
  it('compares matching indicators and states which region is higher, with year and source', async () => {
    await renderComparison();

    const row = within(rowOf(POVERTY));
    expect(row.getByText(/Uji 2,0× lebih tinggi|Uji 2× lebih tinggi/)).toBeInTheDocument();
    expect(row.getByText(/^2025 · BPS · Dataset bps_susenas_sakernas_2025 ·/)).toBeInTheDocument();
    expect(row.getByText('9,89')).toBeInTheDocument();
    expect(row.getByText('19,78')).toBeInTheDocument();
  });

  it('shows dataset and a source link, and the snapshot of the profiles', async () => {
    await renderComparison();

    const row = within(rowOf(POVERTY));
    expect(row.getByText(/Dataset bps_susenas_sakernas_2025/)).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'Sumber resmi' })).toHaveAttribute('href');
    expect(screen.getByText('2026.10.0-official-live')).toBeInTheDocument();
  });

  it('explains a lower-is-better gap in words and names the better side, from the catalog polarity', async () => {
    await renderComparison();

    const row = within(rowOf(POVERTY));
    expect(betterSide(rowOf(POVERTY))).toBe('Aceh Selatan');
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

  it('withholds the difference and the better/worse reading when years differ, but shows both values and years', async () => {
    await renderComparison();

    const row = within(rowOf('Indeks Pembangunan Manusia (IPM / HDI)'));
    expect(row.getByText('Untuk sementara hasil belum dapat ditentukan')).toBeInTheDocument();
    expect(row.getByText(/Tahun data berbeda \(2024 dan 2021\)/)).toBeInTheDocument();
    expect(row.getByText(/^A 2024 · B 2021 · BPS · Dataset /)).toBeInTheDocument();
    expect(row.getAllByText('69,1')).toHaveLength(2);
    expect(row.queryByText(/kondisi (lebih|kurang) baik/)).not.toBeInTheDocument();
    expect(row.queryByText(/lebih tinggi/)).not.toBeInTheDocument();
  });

  it('blocks an unknown year as well', async () => {
    await renderComparison({
      plainB: true,
      mutateB: (detail) => {
        indicatorOf(detail, 'soc_hdi').reference_year = null;
      },
    });

    const row = within(rowOf('Indeks Pembangunan Manusia (IPM / HDI)'));
    expect(row.getByText(/Tahun data salah satu wilayah tidak diketahui/)).toBeInTheDocument();
    expect(row.queryByText(/kondisi (lebih|kurang) baik/)).not.toBeInTheDocument();
  });

  it('blocks a missing value instead of reading it as 0', async () => {
    await renderComparison();

    const row = within(rowOf('Prevalensi Balita Stunting'));
    expect(row.getByText('Untuk sementara hasil belum dapat ditentukan')).toBeInTheDocument();
    expect(row.getByText('Data belum tersedia')).toBeInTheDocument();
    expect(row.getByText('Salah satu wilayah tidak memiliki data untuk indikator ini.')).toBeInTheDocument();
    expect(row.queryByText('0')).not.toBeInTheDocument();
  });

  it('treats a measured 0 as a value: 0 and 0 are the same, 0 against 5 gives a gap and no invalid ratio', async () => {
    await renderComparison({
      plainB: true,
      mutateA: (detail) => {
        indicatorOf(detail, 'soc_poverty_rate').raw_value = 0;
        indicatorOf(detail, 'soc_unemployment_rate').raw_value = 0;
      },
      mutateB: (detail) => {
        indicatorOf(detail, 'soc_poverty_rate').raw_value = 0;
        indicatorOf(detail, 'soc_unemployment_rate').raw_value = 5;
      },
    });

    const same = within(rowOf(POVERTY));
    expect(same.getAllByText('0')).toHaveLength(2);
    expect(same.getAllByText('Sama').length).toBeGreaterThan(0);

    const gap = within(rowOf('Tingkat Pengangguran Terbuka (TPT)'));
    expect(gap.getAllByText(/Uji lebih tinggi 5 %/).length).toBeGreaterThan(0);
    expect(gap.queryByText(/Infinity|NaN|×/)).not.toBeInTheDocument();
  });

  it('blocks values imputed from the province and labels the cell so it is not read as a kab/kota measurement', async () => {
    await renderComparison();

    const row = within(rowOf('Persentase Rumah Tangga Pengguna Listrik (PLN & Non-PLN)'));
    expect(row.getByText('Untuk sementara hasil belum dapat ditentukan')).toBeInTheDocument();
    expect(row.getByText(/diimputasi dari nilai provinsi/)).toBeInTheDocument();
    expect(row.getAllByText('Imputasi provinsi, bukan observasi kab/kota')).toHaveLength(2);
  });

  it('blocks incompatible units', async () => {
    await renderComparison({
      plainB: true,
      mutateB: (detail) => {
        indicatorOf(detail, 'soc_poverty_rate').unit = 'index';
      },
    });

    const row = within(rowOf(POVERTY));
    expect(row.getByText(/Satuan berbeda \(percent \(%\) dan index\)/)).toBeInTheDocument();
    expect(row.queryByText(/lebih tinggi|kondisi (lebih|kurang) baik/)).not.toBeInTheDocument();
  });

  it('blocks incompatible datasets', async () => {
    await renderComparison({
      plainB: true,
      mutateB: (detail) => {
        indicatorOf(detail, 'soc_poverty_rate').provenance = {
          dataset_id: 'another_dataset',
          agency_code: 'BPS',
        };
      },
    });

    const row = within(rowOf(POVERTY));
    expect(row.getByText(/dataset dengan definisi yang bisa berbeda/)).toBeInTheDocument();
  });

  it('blocks when neither region says where the figure comes from', async () => {
    const withoutProvenance: Mutation = (detail) => {
      indicatorOf(detail, 'soc_poverty_rate').provenance = {};
    };
    await renderComparison({ plainB: true, mutateA: withoutProvenance, mutateB: withoutProvenance });

    const row = within(rowOf(POVERTY));
    expect(row.getByText('Untuk sementara hasil belum dapat ditentukan')).toBeInTheDocument();
    expect(row.getByText(/Sumber dataset salah satu angka tidak diketahui/)).toBeInTheDocument();
    expect(
      row.getByText(/^2025 · sumber tidak diketahui · Dataset sumber tidak diketahui[.]$/),
    ).toBeInTheDocument();
  });

  it('gives one clear reason when an indicator exists for only one region', async () => {
    await renderComparison({
      plainB: true,
      mutateB: (detail) => {
        detail.data.indicators = detail.data.indicators.filter(
          (indicator) => indicator.indicator_id !== 'soc_poverty_rate',
        );
      },
    });

    const row = within(rowOf(POVERTY));
    expect(row.getAllByRole('listitem')).toHaveLength(1);
    expect(row.getByText('Data belum tersedia')).toBeInTheDocument();
  });

  it('keeps data-quality metrics in their own section without a difference or a verdict', async () => {
    const addMetric: Mutation = (detail) => {
      detail.data.indicators.push({
        indicator_id: 'meta_indicator_completeness',
        indicator_name: 'Kelengkapan Indikator',
        category: 'data_reliability',
        raw_value: 76.6667,
        unit: 'percent (%)',
        reference_year: 2026,
        quality_flag: 'DERIVED',
        provenance: { dataset_id: 'nusa_matra_internal_audit', agency_code: 'NUSAMATRA' },
      });
    };
    await renderComparison({ plainB: true, mutateA: addMetric, mutateB: addMetric });

    expect(screen.getByText('Metrik kualitas data')).toBeInTheDocument();
    const row = within(rowOf('Kelengkapan Indikator'));
    expect(row.getByText(/bukan kondisi wilayah/)).toBeInTheDocument();
    expect(row.getByText(/^2026 · NUSAMATRA · Dataset nusa_matra_internal_audit ·/)).toBeInTheDocument();
    expect(row.queryByText(/kondisi (lebih|kurang) baik|Sama|lebih tinggi/)).not.toBeInTheDocument();
    expect(row.getAllByText('Turunan (dihitung, bukan pengukuran langsung)')).toHaveLength(2);
    expect(screen.getByText(/Dari 16 indikator wilayah/)).toBeInTheDocument();
  });

  it('counts what could and could not be compared', async () => {
    await renderComparison();

    expect(
      screen.getByText(/Dari 16 indikator wilayah, 12 dapat dibandingkan dan 4 tidak dibandingkan/),
    ).toBeInTheDocument();
  });

  it('labels every value cell for the stacked mobile layout', async () => {
    await renderComparison();

    const cells = rowOf(POVERTY).querySelectorAll('td');
    expect([...cells].map((cell) => cell.getAttribute('data-label'))).toEqual([
      'Aceh Selatan',
      'Uji',
      'Hasil',
    ]);
  });

  it('swaps the two regions in the URL and flips the columns', async () => {
    const { router } = await renderComparison({ view: 'summary' });

    await userEvent.click(screen.getByRole('button', { name: 'Tukar wilayah' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?a=1102&b=1101');
    });
    await waitFor(() => {
      const headers = [...document.querySelectorAll('thead th')].map((header) => header.textContent);
      expect(headers).toEqual(['Indikator', 'Uji', 'Aceh Selatan', 'Hasil']);
    });
    const row = within(rowOf(POVERTY));
    expect(betterSide(rowOf(POVERTY))).toBe('Aceh Selatan');
    expect(row.getByText(/Uji 2,0× lebih tinggi|Uji 2× lebih tinggi/)).toBeInTheDocument();
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
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says which region failed, keeps the other one, and recovers on retry', async () => {
    let failing = true;
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/1101': () =>
        failing ? jsonResponse({ status: 'error' }, 500) : jsonResponse(profileA()),
      '/api/v1/regions/1102': () => jsonResponse(profileB()),
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
    });
    renderWithDataHub(<RegionComparison />, {
      fetchImpl,
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1102',
    });

    expect(await screen.findByText(/Wilayah B: Kabupaten Uji sudah dimuat/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    failing = false;
    const slotA = await screen.findByRole('group', { name: 'Status Wilayah A' });
    await userEvent.click(within(slotA).getByRole('button', { name: /coba lagi/i }));
    await screen.findByText(/Dari 16 indikator wilayah/);
  });

  it('holds back the better/worse reading and says so when the indicator catalog fails', async () => {
    await renderComparison({ catalogStatus: 500 });

    expect(await screen.findByText(/Katalog indikator tidak dapat dimuat/)).toBeInTheDocument();
    const row = within(rowOf(POVERTY));
    expect(row.getByText(/Uji 2,0× lebih tinggi|Uji 2× lebih tinggi/)).toBeInTheDocument();
    expect(row.queryByText(/kondisi (lebih|kurang) baik/)).not.toBeInTheDocument();
  });

  it('warns when the two profiles come from different snapshots', async () => {
    await renderComparison({
      mutateB: (detail) => {
        detail.meta.snapshot_id = '2026.11.0-official-live';
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/snapshot atau mode berbeda/);
  });

  it('says plainly when neither region has indicators', async () => {
    const empty: Mutation = (detail) => {
      detail.data.indicators = [];
    };
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: comparisonFetch({ plainB: true, mutateA: empty, mutateB: empty }),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1102',
    });

    expect(await screen.findByText('Belum ada data indikator untuk dibandingkan')).toBeInTheDocument();
  });

  it('renders the slot a follow-up action can use', async () => {
    renderWithDataHub(<RegionComparison footerSlot={<p>Slot tindak lanjut</p>} />, {
      fetchImpl: comparisonFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1102',
    });

    expect(await screen.findByText('Slot tindak lanjut')).toBeInTheDocument();
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

describe('RegionPicker inside the comparison', () => {
  function regionRow(id: string, name: string, level: 'provinsi' | 'kabupaten' | 'kota') {
    return {
      region_id: id,
      parent_region_id: null,
      province_name: 'Provinsi Uji',
      level,
      name,
      short_name: name,
      codes: { bps: id },
    };
  }

  function searchFetch() {
    return createFixtureFetch({
      '/api/v1/regions': () =>
        jsonResponse({
          status: 'success',
          meta: {
            snapshot_id: '2026.10.0-official-live',
            mode: 'LIVE',
            boundary_version: null,
            total_count: 3,
          },
          data: [
            regionRow('32', 'Provinsi Jawa Barat', 'provinsi'),
            regionRow('1101', 'Kabupaten Aceh Selatan', 'kabupaten'),
            regionRow('3374', 'Kota Semarang', 'kota'),
          ],
        }),
      '/api/v1/regions/1102': () => jsonResponse(profileB()),
      '/api/v1/regions/3374': () =>
        jsonResponse({
          ...profileA(),
          data: {
            ...profileA().data,
            region: { ...profileA().data.region, region_id: '3374', name: 'Kota Semarang' },
          },
        }),
    });
  }

  it('offers only kabupaten/kota and not the region already chosen in the other slot', async () => {
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: searchFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan?b=1101',
    });

    await userEvent.type(screen.getByLabelText('Cari Wilayah A'), 'a');
    expect(await screen.findByRole('button', { name: /Kota Semarang/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Provinsi Jawa Barat/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aceh Selatan/ })).not.toBeInTheDocument();
  });

  it('selects a suggestion with the keyboard alone', async () => {
    const { router } = renderWithDataHub(<RegionComparison />, {
      fetchImpl: searchFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan',
    });

    await userEvent.type(screen.getByLabelText('Cari Wilayah A'), 'sem');
    await screen.findByRole('button', { name: /Kota Semarang/ });
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Aceh Selatan/ })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Kota Semarang/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?a=3374');
    });
  });

  it('says so when nothing matches', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions': () =>
        jsonResponse({
          status: 'success',
          meta: {
            snapshot_id: '2026.10.0-official-live',
            mode: 'LIVE',
            boundary_version: null,
            total_count: 0,
          },
          data: [],
        }),
    });
    renderWithDataHub(<RegionComparison />, { fetchImpl, dataMode: 'LIVE', path: '/bandingkan' });

    await userEvent.type(screen.getByLabelText('Cari Wilayah B'), 'zzz');
    expect(await screen.findByText(/Tidak ada kabupaten\/kota yang cocok dengan “zzz”/)).toBeInTheDocument();
  });
});

describe('RegionComparison in DEMO mode', () => {
  it('marks the result as simulation, never as official observations', async () => {
    const demo = (id: string) => {
      const detail = structuredClone(fixtureJson('region_detail')) as WireDetail;
      detail.data.region = { ...detail.data.region, region_id: id };
      return detail;
    };
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/3201': () => jsonResponse(demo('3201')),
      '/api/v1/regions/3202': () => jsonResponse(demo('3202')),
      '/api/v1/indicators': () => jsonResponse(fixtureJson('indicators')),
    });
    const { unmount } = renderWithDataHub(<RegionComparison />, {
      fetchImpl,
      dataMode: 'DEMO',
      path: '/bandingkan?a=3201&b=3202',
    });

    // The summary marks the whole result; each value carries its own label on the detail page.
    expect(await screen.findByText(/DEMO · simulasi, bukan observasi resmi/)).toBeInTheDocument();
    expect(screen.getByText('2026.10.0-wia-demo')).toBeInTheDocument();
    unmount();

    renderWithDataHub(<RegionComparison view="detail" />, {
      fetchImpl,
      dataMode: 'DEMO',
      path: '/bandingkan/rincian?a=3201&b=3202',
    });
    expect(await screen.findByText(/DEMO · simulasi, bukan observasi resmi/)).toBeInTheDocument();
    expect(screen.getAllByText('Contoh DEMO, bukan observasi resmi').length).toBeGreaterThan(0);
  });
});

describe('Summary view (Bandingkan) and its "Selengkapnya" page', () => {
  it('keeps each row to the indicator, both values, the difference and the better side', async () => {
    await renderComparison({ view: 'summary' });

    const row = within(rowOf(POVERTY));
    expect(row.getByText('9,89')).toBeInTheDocument();
    expect(row.getByText('19,78')).toBeInTheDocument();
    expect(row.getByText(/Uji 2,0× lebih tinggi|Uji 2× lebih tinggi/)).toBeInTheDocument();
    expect(betterSide(rowOf(POVERTY))).toBe('Aceh Selatan');
    // The other side is red, said in words too; the colours are explained above the table.
    const worse = rowOf(POVERTY).querySelector('[data-outcome="worse"]')?.closest('td');
    expect(worse?.getAttribute('data-label')).toBe('Uji');
    expect(within(worse as HTMLElement).getByText(/kondisi kurang baik/)).toBeInTheDocument();
    expect(screen.getByText('Hijau: kondisi lebih baik')).toBeInTheDocument();
    expect(screen.queryByText(/Lebih baik:/)).not.toBeInTheDocument();
    // Years, sources, explanations and quality labels live on the detail page.
    expect(row.queryByText(/Dataset /)).not.toBeInTheDocument();
    expect(row.queryByRole('link', { name: 'Sumber resmi' })).not.toBeInTheDocument();
    expect(row.queryByText(/Nilai yang lebih rendah menunjukkan/)).not.toBeInTheDocument();
  });

  it('says only that a blocked row is not compared, leaving the reasons to the detail page', async () => {
    await renderComparison({ view: 'summary' });

    const row = within(rowOf('Prevalensi Balita Stunting'));
    expect(row.getByText('Untuk sementara hasil belum dapat ditentukan')).toBeInTheDocument();
    expect(row.queryByRole('listitem')).not.toBeInTheDocument();
    expect(
      within(rowOf('Persentase Rumah Tangga Pengguna Listrik (PLN & Non-PLN)')).queryByText(
        'Imputasi provinsi, bukan observasi kab/kota',
      ),
    ).not.toBeInTheDocument();
  });

  it('puts "Selengkapnya" for this pair and the passport above the table', async () => {
    await renderComparison({ view: 'summary' });

    const more = screen.getByRole('link', { name: 'Selengkapnya' });
    expect(more).toHaveAttribute('href', '/bandingkan/rincian?a=1101&b=1102');
    const passport = screen.getByRole('link', { name: 'Buat Paspor Bukti' });
    const table = screen.getByRole('table');
    for (const action of [more, passport]) {
      expect(action.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('leads from the detail page back to the summary of the same pair, without the pickers', async () => {
    await renderComparison({ view: 'detail' });

    expect(screen.getByRole('link', { name: 'Kembali ke ringkasan' })).toHaveAttribute(
      'href',
      '/bandingkan?a=1101&b=1102',
    );
    expect(screen.queryByRole('button', { name: 'Tukar wilayah' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat Paspor Bukti' })).toBeInTheDocument();
  });

  it('sends a detail page without a pair back to Bandingkan', () => {
    renderWithDataHub(<RegionComparison view="detail" />, {
      fetchImpl: comparisonFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan/rincian',
    });

    expect(screen.getByRole('link', { name: 'Pilih di Bandingkan' })).toHaveAttribute('href', '/bandingkan');
  });
});

describe('Paspor Bukti link', () => {
  const NAME = 'Buat Paspor Bukti';

  it('links to the passport of exactly this pair, with mode and snapshot from the fetched profiles', async () => {
    await renderComparison();

    expect(screen.getByRole('link', { name: NAME })).toHaveAttribute(
      'href',
      '/paspor-bukti?jenis=bandingkan&mode=live&snap=2026.10.0-official-live&a=1101&b=1102',
    );
  });

  it('is reachable with the keyboard', async () => {
    await renderComparison();

    const link = screen.getByRole('link', { name: NAME });
    link.focus();
    expect(link).toHaveFocus();
  });

  it('is absent while loading', () => {
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: createFixtureFetch({
        '/api/v1/regions/1101': () => new Promise<Response>(() => undefined),
        '/api/v1/regions/1102': () => new Promise<Response>(() => undefined),
        '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
      }),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1102',
    });

    expect(screen.queryByRole('link', { name: NAME })).not.toBeInTheDocument();
  });

  it('is absent when a region failed to load', async () => {
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: comparisonFetch({ statusA: 500 }),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1102',
    });

    await screen.findByText(/Wilayah B: Kabupaten Uji sudah dimuat/);
    expect(screen.queryByRole('link', { name: NAME })).not.toBeInTheDocument();
  });

  it('is absent when both slots hold the same region', async () => {
    renderWithDataHub(<RegionComparison />, {
      fetchImpl: comparisonFetch(),
      dataMode: 'LIVE',
      path: '/bandingkan?a=1101&b=1101',
    });

    await screen.findByText('Pilih dua wilayah yang berbeda');
    expect(screen.queryByRole('link', { name: NAME })).not.toBeInTheDocument();
  });

  it('is replaced by a reason when the two profiles come from different snapshots', async () => {
    await renderComparison({
      mutateB: (detail) => {
        detail.meta.snapshot_id = '2026.11.0-official-live';
      },
    });

    expect(screen.queryByRole('link', { name: NAME })).not.toBeInTheDocument();
    expect(screen.getByText(/Paspor Bukti belum bisa dibuat/)).toBeInTheDocument();
  });
});
