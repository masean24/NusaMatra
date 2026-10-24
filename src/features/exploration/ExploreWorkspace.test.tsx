import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFixtureFetch, fixtureJson, jsonResponse, renderWithDataHub } from '@/test/dataHubFixtures';
import { ExploreWorkspace } from './ExploreWorkspace';

// The WebGL map is not under test here; this stand-in only reports a pick and how many points it got.
vi.mock('./ExplorationMapPanel', async () => {
  const { useRegionBrowserParams } = await import('./regionCode');
  return {
    ExplorationMapPanel: ({
      onLiveSelect,
      overlay,
    }: {
      onLiveSelect?: (code: string, name: string) => void;
      overlay?: { points: readonly unknown[] };
    }) => {
      // Like the real map panel: a pick goes into the URL and is reported to the page.
      const { selectCode } = useRegionBrowserParams();
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              selectCode('1101');
              onLiveSelect?.('1101', 'Kabupaten Aceh Selatan');
            }}
          >
            Pilih di peta
          </button>
          <span data-testid="overlay-count">{overlay?.points.length ?? 0}</span>
        </div>
      );
    },
  };
});
vi.mock('./BoundaryNotice', () => ({ BoundaryNotice: () => null }));

const liveEnvelope = (data: unknown[]) => ({
  status: 'success',
  meta: {
    snapshot_id: '2026.10.0-official-live',
    mode: 'LIVE',
    boundary_version: 'BIG-Kepmendagri-300.2.2-2430-2025',
    total_count: data.length,
    coverage: null,
    data_origin: null,
    last_success_at: null,
    is_stale: null,
  },
  data,
});

const aceh = {
  region_id: '1101',
  parent_region_id: '11',
  province_name: 'Aceh',
  level: 'kabupaten',
  name: 'Kabupaten Aceh Selatan',
  short_name: 'Aceh Selatan',
  codes: { kemendagri: '11.01', bps: '1101', kemendikdasmen: null },
  island_group: 'Aceh',
  area_km2: 0,
  anchor_point: null,
  bbox: null,
};

const liveHeaders = {
  'Content-Type': 'application/json',
  'X-NusaMatra-Mode': 'LIVE',
  'X-Data-Fallback': 'NONE',
};

function liveFetch(options: { readonly quakeOrigin?: string } = {}) {
  const quakes = structuredClone(fixtureJson('live/earthquakes_geojson')) as {
    metadata: Record<string, unknown>;
  };
  Object.assign(quakes.metadata, {
    data_origin: options.quakeOrigin ?? 'bmkg_live',
    last_success_at: new Date().toISOString(),
    is_stale: false,
    cache_ttl_seconds: 60,
  });
  return createFixtureFetch({
    '/api/v1/regions': () => jsonResponse(liveEnvelope([aceh])),
    '/api/v1/regions/1101': () => jsonResponse(fixtureJson('live/region_detail_1101')),
    '/api/v1/indicators': () => jsonResponse(fixtureJson('live/indicators')),
    '/api/v1/earthquakes/geojson': () =>
      new Response(JSON.stringify(quakes), { status: 200, headers: liveHeaders }),
  });
}

describe('ExploreWorkspace (LIVE, map stubbed)', () => {
  it('shows the region profile after a map pick even while an earthquake detail is open', async () => {
    renderWithDataHub(<ExploreWorkspace />, { fetchImpl: liveFetch(), dataMode: 'LIVE' });

    await userEvent.click(screen.getByRole('switch', { name: 'Gempa BMKG' }));
    await userEvent.click(await screen.findByText(/Daftar gempa \(/));
    const firstQuake = (await screen.findAllByRole('button', { name: /^Magnitudo/ }))[0];
    if (!firstQuake) throw new Error('No earthquake listed');
    await userEvent.click(firstQuake);
    expect(await screen.findByRole('button', { name: 'Tutup detail gempa' })).toBeInTheDocument();
    // Named in the layer control and again in the detail itself.
    expect(screen.getAllByText('Asal: langsung dari BMKG')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Pilih di peta' }));

    expect(await screen.findByRole('heading', { name: 'Kabupaten Aceh Selatan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tutup detail gempa' })).not.toBeInTheDocument();
  });

  it('keeps an undeclared-origin feed off the map', async () => {
    renderWithDataHub(<ExploreWorkspace />, {
      fetchImpl: liveFetch({ quakeOrigin: 'unknown' }),
      dataMode: 'LIVE',
    });
    await userEvent.click(screen.getByRole('switch', { name: 'Gempa BMKG' }));
    expect(await screen.findByText('Gempa ditahan: asal data belum jelas')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-count')).toHaveTextContent('0');
  });

  it('hands focus to the profile after a list pick and back to the search after closing it', async () => {
    renderWithDataHub(<ExploreWorkspace />, { fetchImpl: liveFetch(), dataMode: 'LIVE' });

    await userEvent.click(await screen.findByRole('button', { name: /^Kabupaten Aceh Selatan/ }));
    const heading = await screen.findByRole('heading', { name: 'Kabupaten Aceh Selatan' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Tutup profil' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Cari kabupaten/kota')).toHaveFocus();
    });
  });

  it('does not take focus when the page opens with a region already in the link', async () => {
    renderWithDataHub(<ExploreWorkspace />, {
      fetchImpl: liveFetch(),
      dataMode: 'LIVE',
      path: '/jelajahi?kode=1101',
    });
    const heading = await screen.findByRole('heading', { name: /Aceh Selatan|Wilayah kode 1101/ });
    expect(heading).not.toHaveFocus();
  });
});
