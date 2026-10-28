import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  present,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { RegionDetailPanel } from './RegionDetailPanel';

interface WireIndicator {
  indicator_id: string;
  indicator_name: string;
  raw_value: number | null;
  national_percentile: number | null;
  quality_flag: string;
  provenance: { official_url?: string };
}

interface WireDetail {
  data: { region: { area_km2: number }; indicators: WireIndicator[] };
}

function liveFetch(edit?: (detail: WireDetail) => void) {
  const detail = structuredClone(fixtureJson('live/region_detail_1101')) as WireDetail;
  edit?.(detail);
  return createFixtureFetch({
    '/api/v1/regions/1101': () => jsonResponse(detail),
    '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
  });
}

const renderLive = (fetchImpl: ReturnType<typeof liveFetch>, props = {}) =>
  renderWithDataHub(<RegionDetailPanel regionId="1101" {...props} />, { fetchImpl, dataMode: 'LIVE' });

/** The collapsed row of one indicator, opened. */
async function openIndicator(name: string): Promise<HTMLElement> {
  const summary = (await screen.findByText(name)).closest('summary');
  if (!summary) throw new Error(`No row for ${name}`);
  const details = summary.closest('details');
  if (!details) throw new Error(`No details for ${name}`);
  await userEvent.click(summary);
  return details;
}

describe('RegionDetailPanel on a captured LIVE profile', () => {
  it('shows the name at once, then identity, LIVE status and the plain-language summary', async () => {
    renderLive(liveFetch(), { fallbackName: 'Kabupaten Aceh Selatan' });
    // The name is there before the profile arrives.
    expect(screen.getByRole('heading', { name: 'Kabupaten Aceh Selatan' })).toBeInTheDocument();
    // No evidence link while the profile is still loading.
    expect(screen.queryByRole('link', { name: /^Paspor Bukti wilayah ini/ })).not.toBeInTheDocument();

    expect(await screen.findByText('Data resmi')).toBeInTheDocument();
    expect(screen.getByText(/Provinsi Aceh/)).toBeInTheDocument();
    expect(screen.getByText(/luas wilayah dari sumber tidak valid \(0 km²\)/)).toBeInTheDocument();
    const summary = within(screen.getByRole('region', { name: 'Ringkasan' }));
    expect(summary.getAllByRole('listitem')).toHaveLength(4);
    expect(summary.getByText('Indeks Pembangunan Manusia (IPM / HDI)')).toBeInTheDocument();
  });

  it('draws no "better than X %" verdict from the undocumented national percentile', async () => {
    renderLive(
      liveFetch((detail) => {
        const set = (id: string, percentile: number | null) => {
          present(
            detail.data.indicators.find((indicator) => indicator.indicator_id === id),
            id,
          ).national_percentile = percentile;
        };
        set('hlt_stunting_prevalence', 90);
        set('dis_multihazard_index', 10);
        set('soc_hdi', 50);
        set('soc_poverty_rate', null);
      }),
    );
    await screen.findByText('Data resmi');

    const summary = within(screen.getByRole('region', { name: 'Ringkasan' }));
    const card = (label: string) => within(summary.getByText(label).closest('li') as HTMLElement);
    for (const label of [
      'Prevalensi Balita Stunting',
      'Indeks Risiko Bencana Indonesia (IRBI) Multi-Bencana',
      'Indeks Pembangunan Manusia (IPM / HDI)',
    ]) {
      expect(card(label).getByText('Tidak dinilai')).toBeInTheDocument();
      expect(card(label).getByText(/belum menjelaskan arah persentil/)).toBeInTheDocument();
    }
    expect(
      card('Persentase Penduduk Miskin (P0)').getByText(/tidak menyertakan pembanding nasional/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Relatif lebih baik|Relatif kurang baik|Di sekitar tengah/),
    ).not.toBeInTheDocument();
  });

  it('keeps indicators grouped by theme and the precise values one tap away, raw apart from normalized', async () => {
    renderLive(liveFetch());
    await screen.findByText('Data resmi');

    await userEvent.click(screen.getByText('Risiko bencana'));
    const item = within(await openIndicator('Indeks Bahaya Banjir (Rata-rata Wilayah)'));
    expect(item.getByText('Nilai asli (dari sumber)')).toBeInTheDocument();
    expect(
      item.getByText(/Skor ternormalisasi \(0–100; makin tinggi, makin membutuhkan\)/),
    ).toBeInTheDocument();
    expect(
      item.getByText('Nilai yang lebih rendah menunjukkan kondisi yang lebih baik pada indikator ini.'),
    ).toBeInTheDocument();
    expect(item.getByText('2024')).toBeInTheDocument();
    expect(item.getByRole('link', { name: 'BNPB' })).toBeInTheDocument();
  });

  it('corrects no value but flags the 0.0–1.0 hazard unit that the data contradicts', async () => {
    renderLive(liveFetch());
    await screen.findByText('Data resmi');
    await userEvent.click(screen.getByText('Risiko bencana'));

    const item = within(await openIndicator('Indeks Bahaya Gempabumi (Rata-rata Wilayah)'));
    expect(item.getAllByText(/21,6/).length).toBeGreaterThan(0);
    expect(item.getByText('Satuan dari sumber tidak konsisten')).toBeInTheDocument();
    expect(item.getByText(/Sumber menyebut skala 0–1, tetapi nilainya mencapai/)).toBeInTheDocument();
    expect(screen.queryByText(/index \(0\.0-1\.0\)/)).not.toBeInTheDocument();
  });

  it('does not judge a value imputed from the province and says so', async () => {
    renderLive(liveFetch());
    await screen.findByText('Data resmi');
    await userEvent.click(screen.getByText('Infrastruktur'));

    const item = within(await openIndicator('Persentase Rumah Tangga Pengguna Listrik (PLN & Non-PLN)'));
    expect(item.getByText('Tidak dinilai')).toBeInTheDocument();
    expect(item.getAllByText(/Diimputasi dari nilai tingkat provinsi/).length).toBeGreaterThan(0);
  });

  it('shows a measured 0 as 0 and a missing value as "Data belum tersedia", never 0', async () => {
    renderLive(
      liveFetch((detail) => {
        const [first, second] = detail.data.indicators;
        present(first, 'first').raw_value = 0;
        present(second, 'second').raw_value = null;
      }),
    );
    await screen.findByText('Data resmi');
    await userEvent.click(screen.getByText('Risiko bencana'));

    const row = (name: string) => within(screen.getByText(name).closest('summary') as HTMLElement);
    expect(row('Indeks Bahaya Gempabumi (Rata-rata Wilayah)').getByText('0')).toBeInTheDocument();
    expect(
      row('Indeks Bahaya Banjir (Rata-rata Wilayah)').getAllByText('Data belum tersedia').length,
    ).toBeGreaterThan(0);
    expect(row('Indeks Bahaya Banjir (Rata-rata Wilayah)').queryByText('0')).not.toBeInTheDocument();
  });

  it('opens with the Paspor Bukti card, which links the passport of exactly this profile', async () => {
    renderLive(liveFetch());
    await screen.findByText('Data resmi');

    // The sources live in the passport now; the panel has no separate evidence section.
    expect(screen.queryByRole('region', { name: 'Bukti dan sumber' })).toBeNull();
    const link = await screen.findByRole('link', { name: /^Paspor Bukti wilayah ini/ });
    const href = new URL(link.getAttribute('href') ?? '', 'https://x.test');
    expect(href.pathname).toBe('/paspor-bukti');
    expect(href.searchParams.get('jenis')).toBe('wilayah');
    expect(href.searchParams.get('kode')).toBe('1101');
    expect(href.searchParams.get('mode')).toBe('live');
    expect(href.searchParams.get('snap')).toBe('2026.10.0-official-live');
  });

  it('links only real web sources and leaves anything else as plain text', async () => {
    renderLive(
      liveFetch((detail) => {
        present(detail.data.indicators[0], 'first').provenance.official_url = 'internal://nusamatra-data-hub';
      }),
    );
    await screen.findByText('Data resmi');
    await userEvent.click(screen.getByText('Risiko bencana'));
    await openIndicator('Indeks Bahaya Gempabumi (Rata-rata Wilayah)');

    expect(
      screen
        .getAllByRole('link')
        .every(
          (link) =>
            link.getAttribute('href')?.startsWith('/') || link.getAttribute('href')?.startsWith('http'),
        ),
    ).toBe(true);
  });

  it('offers to close the profile', async () => {
    const onClose = vi.fn();
    renderLive(liveFetch(), { onClose });
    await userEvent.click(await screen.findByRole('button', { name: 'Tutup profil' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says plainly when a region has no data yet', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/1101': () =>
        jsonResponse({
          ...(fixtureJson('live/region_detail_1101') as object),
          data: { ...(fixtureJson('live/region_detail_1101') as { data: object }).data, indicators: [] },
        }),
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
    });
    renderLive(fetchImpl);
    expect(await screen.findByText(/Belum ada data indikator untuk wilayah ini/)).toBeInTheDocument();
  });
});

describe('RegionDetailPanel on the captured LIVE v2.2 profile of Lanny Jaya (9507)', () => {
  it('never calls the worst-off values "better", and keeps the raw values and their sources', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/9507': () => jsonResponse(fixtureJson('live-v2.2/region_9507')),
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live-v2.2/catalog')),
    });
    renderWithDataHub(<RegionDetailPanel regionId="9507" />, { fetchImpl, dataMode: 'LIVE' });
    await screen.findByText('Data resmi');

    const summary = within(screen.getByRole('region', { name: 'Ringkasan' }));
    const card = (label: string) => within(summary.getByText(label).closest('li') as HTMLElement);
    // IPM 51,59 (higher is better) and poverty 31,59 % (higher is worse): the raw value stays, no verdict.
    expect(card('Indeks Pembangunan Manusia (IPM / HDI)').getByText('51,59')).toBeInTheDocument();
    expect(card('Indeks Pembangunan Manusia (IPM / HDI)').getByText('Tidak dinilai')).toBeInTheDocument();
    expect(card('Persentase Penduduk Miskin (P0)').getByText('31,59')).toBeInTheDocument();
    expect(card('Persentase Penduduk Miskin (P0)').getByText('Tidak dinilai')).toBeInTheDocument();
    expect(
      screen.queryByText(/Relatif lebih baik|Di sekitar tengah|Relatif kurang baik/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Lebih baik daripada sekitar/)).not.toBeInTheDocument();
  });
});

describe('RegionDetailPanel in DEMO', () => {
  it('labels the data as simulated and every indicator DEMO_EXAMPLE', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/3201': () => fixtureResponse('region_detail'),
      '/api/v1/indicators': () => fixtureResponse('indicators'),
    });
    renderWithDataHub(<RegionDetailPanel regionId="3201" />, { fetchImpl });

    expect(await screen.findByText('Data simulasi (DEMO)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kabupaten Demo Jabar 1' })).toBeInTheDocument();
    expect(screen.getByText('Nama sintetis (DEMO), bukan nama resmi')).toBeInTheDocument();
    expect(screen.getByText('Semua indikator (31)')).toBeInTheDocument();
    expect(screen.queryByText('Data resmi LIVE')).not.toBeInTheDocument();
  });

  it('asks for a selection instead of fetching when no region is chosen', () => {
    const fetchImpl = createFixtureFetch({});
    renderWithDataHub(<RegionDetailPanel regionId={null} />, { fetchImpl });
    expect(screen.getByText(/Pilih wilayah di peta atau dari daftar/)).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('words an unknown code as "not found" with a way back, not as a failure to retry', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/9999': () => jsonResponse({ detail: "Region '9999' not found." }, 404),
      '/api/v1/indicators': () => fixtureResponse('indicators'),
    });
    const onClose = vi.fn();
    renderWithDataHub(<RegionDetailPanel regionId="9999" onClose={onClose} />, {
      fetchImpl,
      dataMode: 'LIVE',
    });

    expect(await screen.findByText('Wilayah tidak ditemukan')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Paspor Bukti wilayah ini/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Kode 9999 tidak ada pada versi data ini/)).toBeInTheDocument();
    expect(screen.queryByText(/memuat provinsi dan indikator/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pilih wilayah lain' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still words other failures as an error with a way to retry', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/9999': () => jsonResponse({ detail: 'boom' }, 500),
      '/api/v1/indicators': () => fixtureResponse('indicators'),
    });
    renderWithDataHub(<RegionDetailPanel regionId="9999" fallbackName="Wilayah uji" />, { fetchImpl });

    expect(screen.getByRole('heading', { name: 'Wilayah uji' })).toBeInTheDocument();
    expect(await screen.findByText('Data belum dapat dimuat')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Paspor Bukti wilayah ini/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  it('refuses to show another region’s numbers under the requested code', async () => {
    const detail = structuredClone(fixtureJson('live/region_detail_1101')) as {
      data: { region: { region_id: string } };
    };
    detail.data.region.region_id = '1102';
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/1101': () => jsonResponse(detail),
      '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
    });
    renderWithDataHub(<RegionDetailPanel regionId="1101" />, { fetchImpl, dataMode: 'LIVE' });

    expect(await screen.findByText('Data wilayah tidak cocok')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Paspor Bukti wilayah ini/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Semua indikator/)).not.toBeInTheDocument();
  });
});
