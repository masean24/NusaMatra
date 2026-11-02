import { screen } from '@testing-library/react';
import { createFixtureFetch, renderWithDataHub } from '@/test/dataHubFixtures';
import { EvidencePassport } from './EvidencePassport';

describe('Paspor Bukti opened from the navbar (no link)', () => {
  it('shows a crossed-out passport, explains where a passport is made and links to the three features', () => {
    const fetchImpl = createFixtureFetch({});
    renderWithDataHub(<EvidencePassport />, { fetchImpl, path: '/paspor-bukti', dataMode: 'LIVE' });

    expect(
      screen.getByRole('heading', { name: 'Belum ada Paspor Bukti untuk ditampilkan' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Halaman ini dibuka langsung dari menu/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Jelajahi' })).toHaveAttribute('href', '/jelajahi');
    expect(screen.getByRole('link', { name: 'Buka Bandingkan' })).toHaveAttribute('href', '/bandingkan');
    expect(screen.getByRole('link', { name: 'Buka Lab Prioritas' })).toHaveAttribute(
      'href',
      '/lab-prioritas',
    );
    // Nothing to assemble: no request is made and no "invalid link" error is shown.
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByText('Paspor Bukti tidak dapat dibuat dari tautan ini')).not.toBeInTheDocument();
  });
});
