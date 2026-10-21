import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFixtureFetch,
  fixtureResponse,
  renderWithDataHub,
  requestedUrls,
} from '@/test/dataHubFixtures';
import { findFeatureShell } from '@/features/feature-shell';
import { ExplorePage } from './ExplorePage';
import { PriorityLabPage } from './PriorityLabPage';

// The illustrative 3D map is not under test; its slots would load the WebGL engine.
vi.mock('@/features/exploration/ExplorationMapPanel', () => ({ ExplorationMapPanel: () => null }));

const PRIMARY_TITLES = ['LIVE Belum Tersedia', 'LIVE Tidak Dapat Dimuat'];

type LiveBehaviour = 'http-503' | 'unreadable' | 'cached-demo';

/**
 * A Data Hub whose DEMO answers are the captured responses and whose LIVE answers misbehave in one of
 * the ways seen or feared: the real 503, a response the browser cannot read, or a DEMO payload served
 * for the LIVE URL (a shared cache).
 */
function dataHub(live: LiveBehaviour) {
  const demo = (name: string) => fixtureResponse(name);
  const answer = (name: string) => (url: URL) => {
    if (url.searchParams.get('mode') !== 'live') return demo(name);
    if (live === 'http-503') return fixtureResponse('regions_live', 503);
    if (live === 'unreadable') return Promise.reject(new TypeError('Failed to fetch'));
    return demo(name);
  };
  return createFixtureFetch({
    '/api/v1/snapshots': answer('snapshots'),
    '/api/v1/regions': answer('regions_nonempty'),
    '/api/v1/regions/3201': answer('region_detail'),
    '/api/v1/indicators': answer('indicators'),
    '/api/v1/indicators/soc_poverty_rate/values': answer('indicator_values'),
    '/api/v1/boundaries/kabupaten': answer('boundaries_kabupaten'),
    '/api/v1/indicators/composite-query': answer('composite_valid'),
  });
}

function explorePage() {
  return <ExplorePage shell={shellOf('/jelajahi')} />;
}

function labPage() {
  return <PriorityLabPage shell={shellOf('/lab-prioritas')} />;
}

function shellOf(path: string) {
  const shell = findFeatureShell(path);
  if (!shell) throw new Error(`No shell for ${path}`);
  return shell;
}

function primaryMessages(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-kind="unavailable"], [data-kind="error"]')];
}

const assertNoDemoData = () => {
  expect(screen.queryByText(/Kabupaten Demo/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Kota Demo/)).not.toBeInTheDocument();
  expect(screen.queryByText('DEMO_EXAMPLE')).not.toBeInTheDocument();
  expect(screen.queryByText(/^Snapshot/)).not.toBeInTheDocument();
  expect(screen.queryByText('Pratinjau peringkat')).not.toBeInTheDocument();
};

describe.each<[LiveBehaviour, string]>([
  ['http-503', 'the captured HTTP 503'],
  ['unreadable', 'an unreadable response (the real API sends its 503 without CORS headers)'],
  ['cached-demo', 'a DEMO payload served for the LIVE request'],
])('LIVE unavailable through %s: %s', (live) => {
  it('Jelajahi shows one primary message, however many requests failed, and no data', async () => {
    const fetchMock = dataHub(live);
    // Select a region first so the detail panel is one more failing request.
    const { container } = renderWithDataHub(explorePage(), {
      fetchImpl: fetchMock,
      dataMode: 'LIVE',
      path: '/jelajahi?kode=3201',
    });

    await waitFor(() => {
      expect(screen.getAllByText((text) => PRIMARY_TITLES.includes(text))).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        screen.getAllByText('Tidak ada data LIVE untuk ditampilkan di sini.').length,
      ).toBeGreaterThanOrEqual(4);
    });

    expect(primaryMessages(container)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Beralih ke data DEMO' })).toHaveLength(1);
    assertNoDemoData();
    // Five panels asked; every request was for LIVE, none for DEMO.
    expect(requestedUrls(fetchMock).length).toBeGreaterThanOrEqual(5);
    expect(requestedUrls(fetchMock).every((url) => url.searchParams.get('mode') === 'live')).toBe(true);
  });

  it('Lab Prioritas shows one primary message and no ranking', async () => {
    const { container } = renderWithDataHub(labPage(), { fetchImpl: dataHub(live), dataMode: 'LIVE' });

    await waitFor(() => {
      expect(screen.getAllByText((text) => PRIMARY_TITLES.includes(text))).toHaveLength(1);
    });
    await screen.findByText('Tidak ada data LIVE untuk ditampilkan di sini.');

    expect(primaryMessages(container)).toHaveLength(1);
    assertNoDemoData();
  });

  it('returns to DEMO on request: the message goes away and the DEMO data loads again', async () => {
    const fetchMock = dataHub(live);
    const { container } = renderWithDataHub(explorePage(), { fetchImpl: fetchMock, dataMode: 'LIVE' });
    await userEvent.click(await screen.findByRole('button', { name: 'Beralih ke data DEMO' }));

    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
    expect(await screen.findByText('2026.10.0-wia-demo')).toBeInTheDocument();
    expect(primaryMessages(container)).toHaveLength(0);
    expect(screen.queryByText('Tidak ada data LIVE untuk ditampilkan di sini.')).not.toBeInTheDocument();
    expect(screen.queryByText(PRIMARY_TITLES[0] ?? '')).not.toBeInTheDocument();
    expect(requestedUrls(fetchMock).some((url) => url.searchParams.get('mode') === 'demo')).toBe(true);
  });
});

describe('switching from DEMO to LIVE', () => {
  it('drops the DEMO data already on screen at once and never shows it under LIVE', async () => {
    const { container } = renderWithDataHub(explorePage(), { fetchImpl: dataHub('http-503') });
    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
    expect(await screen.findByText('2026.10.0-wia-demo')).toBeInTheDocument();

    await userEvent.click(screen.getByText('LIVE', { selector: 'label' }));

    // Straight away, before any LIVE answer: nothing from DEMO is left.
    assertNoDemoData();
    expect(screen.queryByText(/dari 514 wilayah/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText((text) => PRIMARY_TITLES.includes(text))).toHaveLength(1);
    });
    expect(primaryMessages(container)).toHaveLength(1);
    assertNoDemoData();

    // And back: DEMO again, with the one message gone.
    await userEvent.click(screen.getByRole('button', { name: 'Beralih ke data DEMO' }));
    expect(await screen.findByText('Menampilkan 30 dari 514 wilayah')).toBeInTheDocument();
    expect(primaryMessages(container)).toHaveLength(0);
  });
});
