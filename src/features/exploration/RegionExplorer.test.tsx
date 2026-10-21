import { screen } from '@testing-library/react';
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

  // The page's one primary LIVE message belongs to DataHubBanner (see dataHubPages.test.tsx); a panel
  // whose own request failed for that reason shows a quiet note, not another unavailable card.
  it('shows a quiet note and no region at all, and never asks for DEMO data by itself', async () => {
    const fetchMock = liveFetch();
    const { container } = renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });

    expect(await screen.findByText('Tidak ada data LIVE untuk ditampilkan di sini.')).toBeInTheDocument();
    expect(container.querySelector('[data-kind="unavailable"], [data-kind="error"]')).toBeNull();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/dari 514 wilayah/)).not.toBeInTheDocument();
    expect(requestedUrls(fetchMock).every((url) => url.searchParams.get('mode') === 'live')).toBe(true);
  });

  it('shows the same quiet note when the browser cannot read the 503 (no CORS headers)', async () => {
    const fetchMock = createFixtureFetch({
      '/api/v1/regions': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const { container } = renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });

    expect(await screen.findByText('Tidak ada data LIVE untuk ditampilkan di sini.')).toBeInTheDocument();
    expect(container.querySelector('[data-kind="unavailable"], [data-kind="error"]')).toBeNull();
    expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  });

  it('still reports an ordinary failure in LIVE as an error with a retry, not as a LIVE block', async () => {
    const fetchMock = createFixtureFetch({
      '/api/v1/regions': () => new Response('{"detail":"boom"}', { status: 500 }),
    });
    renderWithDataHub(<RegionExplorer />, { fetchImpl: fetchMock, dataMode: 'LIVE' });

    expect(await screen.findByText('Data belum dapat dimuat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
