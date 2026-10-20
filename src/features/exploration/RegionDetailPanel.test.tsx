import { screen, within } from '@testing-library/react';
import {
  createFixtureFetch,
  fixtureJson,
  fixtureResponse,
  jsonResponse,
  present,
  renderWithDataHub,
} from '@/test/dataHubFixtures';
import { RegionDetailPanel } from './RegionDetailPanel';

interface CapturedIndicator {
  indicator_name: string;
  raw_value: number | null;
  provenance: { official_url?: string };
}

interface CapturedDetail {
  data: { indicators: CapturedIndicator[] };
}

/** The 3201 capture with its first two indicators edited: no capture contains a measured 0 or a missing value. */
function editedDetail(edit: (first: CapturedIndicator, second: CapturedIndicator) => void): {
  body: CapturedDetail;
  first: CapturedIndicator;
  second: CapturedIndicator;
} {
  const body = structuredClone(fixtureJson('region_detail')) as CapturedDetail;
  const first = present(body.data.indicators[0], 'the first captured indicator');
  const second = present(body.data.indicators[1], 'the second captured indicator');
  edit(first, second);
  return { body, first, second };
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe('RegionDetailPanel', () => {
  it('shows region 3201 under its synthetic name, with every indicator marked DEMO_EXAMPLE', async () => {
    const fetchImpl = createFixtureFetch({ '/api/v1/regions/3201': () => fixtureResponse('region_detail') });
    renderWithDataHub(<RegionDetailPanel regionId="3201" />, { fetchImpl });

    expect(await screen.findByRole('heading', { name: 'Kabupaten Demo Jabar 1' })).toBeInTheDocument();
    expect(screen.getByText('Nama sintetis (DEMO), bukan nama resmi')).toBeInTheDocument();
    expect(screen.getByText('Skor komposit simulasi (0–100)')).toBeInTheDocument();
    expect(screen.getByText('Indikator (31)')).toBeInTheDocument();
    expect(screen.getAllByText('DEMO_EXAMPLE')).toHaveLength(31);
  });

  it('shows a measured 0 as 0 and a missing value as "Data belum tersedia", never 0', async () => {
    const { body, first, second } = editedDetail((a, b) => {
      a.raw_value = 0;
      b.raw_value = null;
    });
    const fetchImpl = createFixtureFetch({ '/api/v1/regions/3201': () => jsonResponse(body) });
    renderWithDataHub(<RegionDetailPanel regionId="3201" />, { fetchImpl });
    await screen.findByRole('heading', { name: 'Kabupaten Demo Jabar 1' });

    expect(within(rowOf(first.indicator_name)).getByText('0')).toBeInTheDocument();
    expect(within(rowOf(second.indicator_name)).getByText('Data belum tersedia')).toBeInTheDocument();
    expect(within(rowOf(second.indicator_name)).queryByText('0')).not.toBeInTheDocument();
  });

  it('links only real web sources and leaves anything else as plain text', async () => {
    const { body, first } = editedDetail((a) => {
      a.provenance.official_url = 'internal://nusamatra-data-hub';
    });
    const fetchImpl = createFixtureFetch({ '/api/v1/regions/3201': () => jsonResponse(body) });
    renderWithDataHub(<RegionDetailPanel regionId="3201" />, { fetchImpl });
    await screen.findByRole('heading', { name: 'Kabupaten Demo Jabar 1' });

    expect(within(rowOf(first.indicator_name)).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').every((link) => link.getAttribute('href')?.startsWith('http'))).toBe(
      true,
    );
  });

  it('asks for a selection instead of fetching when no region is chosen', () => {
    const fetchImpl = createFixtureFetch({});
    renderWithDataHub(<RegionDetailPanel regionId={null} />, { fetchImpl });
    expect(screen.getByText(/Pilih wilayah pada daftar/)).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('words a missing region as an error with a way to retry', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/regions/9999': () => jsonResponse({ detail: 'Not Found' }, 404),
    });
    renderWithDataHub(<RegionDetailPanel regionId="9999" />, { fetchImpl });

    expect(await screen.findByText('Data belum dapat dimuat')).toBeInTheDocument();
    expect(screen.getByText('Data untuk wilayah dan periode ini belum tersedia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
