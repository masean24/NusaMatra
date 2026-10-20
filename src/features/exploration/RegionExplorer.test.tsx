import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureResponse,
  renderWithDataHub,
  requestedUrls,
} from '@/test/dataHubFixtures';
import { RegionExplorer } from './RegionExplorer';

function dataHubFetch() {
  return createFixtureFetch({
    '/api/v1/regions': (url) =>
      fixtureResponse(url.searchParams.get('q') === 'bogor' ? 'regions_search' : 'regions_nonempty'),
  });
}

describe('RegionExplorer against the captured Data Hub responses', () => {
  it('lists the 514 DEMO regions a page at a time and labels the names as synthetic', async () => {
    renderWithDataHub(<RegionExplorer />, { fetchImpl: dataHubFetch() });

    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Kabupaten Demo Aceh 1(?![0-9])/ })).toBeInTheDocument();
    expect(screen.getByText('Nama sintetis (DEMO), bukan nama resmi')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan 30 lagi' }));
    expect(screen.getByText('Menampilkan 60 dari 514 wilayah')).toBeInTheDocument();
  });

  it('keeps kabupaten and kota apart and counts the filtered list as received', async () => {
    renderWithDataHub(<RegionExplorer />, { fetchImpl: dataHubFetch() });
    await screen.findByText('Menampilkan 30 dari 514 wilayah');

    await userEvent.click(screen.getByRole('button', { name: 'Kota' }));
    expect(await screen.findByText('Menampilkan 30 dari 99 wilayah')).toBeInTheDocument();
    expect(screen.getAllByText(/^Kota ·/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Kabupaten ·/)).not.toBeInTheDocument();
  });

  it('answers q=bogor with an honest empty state and never invents Kabupaten Bogor', async () => {
    renderWithDataHub(<RegionExplorer />, { fetchImpl: dataHubFetch(), path: '/jelajahi?cari=bogor' });

    expect(
      await screen.findByText('Tidak ada wilayah yang cocok pada dataset DEMO saat ini'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Bogor/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cari kabupaten/kota')).toHaveValue('bogor');

    await userEvent.click(screen.getByRole('button', { name: 'Hapus pencarian' }));
    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
  });

  it('selects a region into the URL, from where the detail panel reads it', async () => {
    const { router } = renderWithDataHub(<RegionExplorer />, { fetchImpl: dataHubFetch() });
    const row = await screen.findByRole('button', { name: /^Kabupaten Demo Aceh 1(?![0-9])/ });

    await userEvent.click(row);

    expect(router.state.location.search).toBe('?kode=1101');
    expect(screen.getByRole('button', { name: /^Kabupaten Demo Aceh 1(?![0-9])/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('sends the chosen mode with every request, in the header and in the URL', async () => {
    const fetchMock = dataHubFetch();
    renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock });
    await screen.findByText('Menampilkan 30 dari 514 wilayah');

    const [url] = requestedUrls(fetchMock);
    expect(url?.searchParams.get('mode')).toBe('demo');
    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['X-Data-Mode']).toBe('DEMO');
  });

  it('says so when no Data Hub address is configured', () => {
    renderWithDataHub(<RegionExplorer />, { fetchImpl: null });
    expect(screen.getByText('Data Hub belum dihubungkan')).toBeInTheDocument();
  });
});

describe('RegionExplorer in LIVE mode (HTTP 503, no fallback)', () => {
  function liveFetch() {
    return createFixtureFetch({
      '/api/v1/regions': (url) =>
        url.searchParams.get('mode') === 'live'
          ? fixtureResponse('regions_live', 503)
          : fixtureResponse('regions_nonempty'),
    });
  }

  it('shows the blocked state, no region at all, and never asks for DEMO data by itself', async () => {
    const fetchMock = liveFetch();
    renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });

    expect(await screen.findByText('LIVE Belum Tersedia')).toBeInTheDocument();
    expect(screen.getByText(/Tidak ada fallback otomatis ke data DEMO/)).toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dari 514 wilayah/)).not.toBeInTheDocument();
    expect(requestedUrls(fetchMock).every((url) => url.searchParams.get('mode') === 'live')).toBe(true);
  });

  it('returns to DEMO only when the user asks for it', async () => {
    const fetchMock = liveFetch();
    renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });
    await userEvent.click(await screen.findByRole('button', { name: 'Beralih ke data DEMO' }));

    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
    await waitFor(() => {
      expect(requestedUrls(fetchMock).some((url) => url.searchParams.get('mode') === 'demo')).toBe(true);
    });
  });

  it('treats a response the browser cannot read (the real API sends its 503 without CORS headers) as blocked too', async () => {
    const fetchMock = createFixtureFetch({
      '/api/v1/regions': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });

    expect(await screen.findByText('LIVE Tidak Dapat Dimuat')).toBeInTheDocument();
    expect(screen.getByText(/Tidak ada fallback otomatis ke data DEMO/)).toBeInTheDocument();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  });
});
