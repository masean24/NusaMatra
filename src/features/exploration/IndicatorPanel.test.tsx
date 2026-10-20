import { screen } from '@testing-library/react';
import { createFixtureFetch, fixtureResponse, renderWithDataHub } from '@/test/dataHubFixtures';
import { BoundaryNotice } from './BoundaryNotice';
import { IndicatorPanel } from './IndicatorPanel';

function indicatorFetch() {
  return createFixtureFetch({
    '/api/v1/indicators': () => fixtureResponse('indicators'),
    '/api/v1/indicators/soc_poverty_rate/values': () => fixtureResponse('indicator_values'),
  });
}

describe('IndicatorPanel', () => {
  it('opens the poverty indicator with its definition, direction and source', async () => {
    renderWithDataHub(<IndicatorPanel regionId={null} />, { fetchImpl: indicatorFetch() });

    expect(await screen.findByLabelText('Pilih indikator')).toHaveValue('soc_poverty_rate');
    expect(screen.getByRole('heading', { name: 'Persentase Penduduk Miskin (P0)' })).toBeInTheDocument();
    expect(screen.getByText(/Semakin tinggi, semakin buruk/)).toBeInTheDocument();
    expect(screen.getByText(/Sumber: BPS/)).toBeInTheDocument();
    expect(screen.getByText('Pilih wilayah pada daftar untuk melihat nilainya.')).toBeInTheDocument();
  });

  it("reads the chosen region's value, rank and DEMO_EXAMPLE flag from the 514-region response", async () => {
    renderWithDataHub(<IndicatorPanel regionId="3201" />, { fetchImpl: indicatorFetch() });

    expect(await screen.findByText(/Peringkat 227/)).toBeInTheDocument();
    expect(screen.getByText(/22,97/)).toBeInTheDocument();
    expect(screen.getByText('DEMO_EXAMPLE')).toBeInTheDocument();
  });

  it('says so when the region is not in the indicator response, instead of showing a number', async () => {
    renderWithDataHub(<IndicatorPanel regionId="9999" />, { fetchImpl: indicatorFetch() });
    expect(
      await screen.findByText('Wilayah kode 9999 tidak ada dalam respons indikator ini.'),
    ).toBeInTheDocument();
  });
});

describe('BoundaryNotice', () => {
  it('labels the map as illustrative and reports Point-only boundaries as not polygons', async () => {
    const fetchImpl = createFixtureFetch({
      '/api/v1/boundaries/kabupaten': () => fixtureResponse('boundaries_kabupaten'),
    });
    renderWithDataHub(<BoundaryNotice />, { fetchImpl });

    expect(
      screen.getByText('Geometri Ilustratif DEMO (Batas Poligon Resmi Belum Tersedia)'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/hanya mengirim geometri Point/)).toBeInTheDocument();
    expect(screen.getByText(/bukan poligon batas administrasi/)).toBeInTheDocument();
  });
});
