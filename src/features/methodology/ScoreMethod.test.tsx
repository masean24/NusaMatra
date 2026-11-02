import { screen, within } from '@testing-library/react';
import { createFixtureFetch, fixtureResponse, renderWithDataHub } from '@/test/dataHubFixtures';
import { ScoreMethod } from './ScoreMethod';

function methodFetch() {
  return createFixtureFetch({
    '/api/v1/indicators': () => fixtureResponse('indicators'),
    '/api/v1/indicators/soc_poverty_rate/values': () => fixtureResponse('indicator_values'),
    '/api/v1/regions/3201': () => fixtureResponse('region_detail'),
  });
}

describe('Cara skor dihitung', () => {
  it('explains both directions of the need scale and the composite formula', () => {
    renderWithDataHub(<ScoreMethod />, { fetchImpl: methodFetch(), path: '/metodologi' });
    expect(screen.getByText('skor = (nilai − terendah) ÷ (tertinggi − terendah) × 100')).toBeInTheDocument();
    expect(screen.getByText('skor = (tertinggi − nilai) ÷ (tertinggi − terendah) × 100')).toBeInTheDocument();
    expect(screen.getByText('skor gabungan = Σ (skor kebutuhan × bobot) ÷ 10.000')).toBeInTheDocument();
    expect(screen.getByText(/kurang dari 70%/)).toBeInTheDocument();
  });

  it('lists every section in "Di halaman ini", each pointing at a section on the page', () => {
    renderWithDataHub(<ScoreMethod />, { fetchImpl: methodFetch(), path: '/metodologi' });
    const toc = screen.getByRole('navigation', { name: 'Di halaman ini' });
    const links = within(toc).getAllByRole('link');
    expect(links).toHaveLength(7);
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('works the linked indicator and region through with the fetched numbers', async () => {
    renderWithDataHub(<ScoreMethod />, {
      fetchImpl: methodFetch(),
      path: '/metodologi?indikator=soc_poverty_rate&wilayah=3201',
    });

    expect(await screen.findByRole('heading', { name: 'Rumus diisi' })).toBeInTheDocument();
    // Fixture: raw 22,9656 between 3,6699 and 36,8228, higher is worse.
    expect(screen.getByText(/\(22,97 − 3,67\) ÷ \(36,82 − 3,67\) × 100/)).toBeInTheDocument();
    // The DEMO fixture's score (55,8) does not follow from its range: the page says so and uses the Data Hub's.
    expect(
      screen.getByText(/Data Hub melaporkan 55,8; angka Data Hub itulah yang dipakai/),
    ).toBeInTheDocument();
    // Rank 227 of the fixture, shown as the Data Hub sent it.
    expect(screen.getByText('227')).toBeInTheDocument();
  });

  it('never scores a region without a value as zero', async () => {
    renderWithDataHub(<ScoreMethod />, {
      fetchImpl: methodFetch(),
      path: '/metodologi?indikator=soc_poverty_rate&wilayah=9999',
    });
    // The worked example says so instead of showing a score of zero.
    expect(await screen.findByText(/Data yang kosong tidak diisi nol/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rumus diisi' })).not.toBeInTheDocument();
  });
});
