import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFixtureFetch, jsonResponse, renderWithDataHub } from '@/test/dataHubFixtures';
import { RegionSearchForm } from './RegionSearchForm';

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

const semarang = {
  region_id: '3374',
  parent_region_id: '33',
  province_name: 'Jawa Tengah',
  level: 'kota',
  name: 'Kota Semarang',
  short_name: 'Semarang',
  codes: { kemendagri: '33.74', bps: '3374', kemendikdasmen: null },
  island_group: 'Jawa',
  area_km2: 0,
  anchor_point: null,
  bbox: null,
};

function renderForm(fetchImpl: typeof fetch | null = null) {
  return renderWithDataHub(
    <RegionSearchForm placeholder="Ketik nama kabupaten/kota Anda" landmarkLabel="Cari wilayah" />,
    {
      fetchImpl,
      dataMode: 'LIVE',
    },
  );
}

function regionsFetch() {
  return createFixtureFetch({ '/api/v1/regions': () => jsonResponse(liveEnvelope([semarang])) });
}

const location = (router: ReturnType<typeof renderForm>['router']) =>
  router.state.location.pathname + router.state.location.search;

describe('RegionSearchForm', () => {
  it('has a real label, not only a placeholder', () => {
    renderForm();
    expect(screen.getByRole('combobox', { name: 'Cari kabupaten/kota' })).toBeInTheDocument();
  });

  it('explains an empty search instead of navigating', async () => {
    renderForm();
    await userEvent.type(screen.getByRole('combobox'), '{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Ketik minimal 2 huruf nama kabupaten/kota.');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('hands a valid query to Jelajahi through the URL', async () => {
    const { router } = renderForm();
    await userEvent.type(screen.getByRole('combobox'), '  Kota   Semarang {Enter}');
    await waitFor(() => {
      expect(location(router)).toBe('/jelajahi?cari=Kota+Semarang');
    });
  });

  it('suggests matching regions from the Data Hub and opens the one picked', async () => {
    const { router } = renderForm(regionsFetch());
    await userEvent.type(screen.getByRole('combobox'), 'sema');

    const option = await screen.findByRole('option', { name: /Kota Semarang/ });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(option);

    await waitFor(() => {
      expect(location(router)).toBe('/jelajahi?kode=3374');
    });
  });

  it('lets the keyboard pick a suggestion and Escape close the list', async () => {
    const { router } = renderForm(regionsFetch());
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'sema');
    await screen.findByRole('option', { name: /Kota Semarang/ });

    await userEvent.keyboard('{Escape}');
    expect(field).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: /Kota Semarang/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(location(router)).toBe('/jelajahi?kode=3374');
    });
  });

  it('suggests nothing for a single letter', async () => {
    const fetchImpl = regionsFetch();
    renderForm(fetchImpl);
    await userEvent.type(screen.getByRole('combobox'), 's');
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
