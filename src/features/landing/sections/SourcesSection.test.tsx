import { render, screen, within } from '@testing-library/react';
import { DEMO_PASSPORT_PREVIEW } from '@/data/fixtures/landingDemo';
import { SourcesSection } from './SourcesSection';

describe('SourcesSection', () => {
  it('lists the six agencies the Data Hub ingests, each with its mark, through the Data Hub', () => {
    render(<SourcesSection />);
    const card = (name: string) =>
      within(screen.getByRole('heading', { name }).closest('article') as HTMLElement);

    for (const name of [
      'Badan Pusat Statistik',
      'Badan Nasional Penanggulangan Bencana',
      'Kementerian Kesehatan',
      'Kementerian Pendidikan Dasar dan Menengah',
      'Badan Informasi Geospasial',
      'Badan Meteorologi, Klimatologi, dan Geofisika',
    ]) {
      expect(card(name).getByText('Terhubung lewat Data Hub')).toBeInTheDocument();
      // The logo identifies; the name says it, so the image is not announced twice.
      expect(card(name).getByRole('presentation', { hidden: true })).toHaveAttribute('alt', '');
    }
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.queryByText(/DJPK/)).not.toBeInTheDocument();
  });

  it('does not imply every indicator has data', () => {
    render(<SourcesSection />);
    expect(screen.getByText(/Belum semua indikator punya data/)).toBeInTheDocument();
  });
});

describe('landing Paspor Bukti preview', () => {
  it('labels its illustrative identifier CONTOH', () => {
    expect(DEMO_PASSPORT_PREVIEW().id).toMatch(/^CONTOH-/);
    expect(
      DEMO_PASSPORT_PREVIEW()
        .rows.map((row) => row.value)
        .join(' '),
    ).not.toMatch(/direncanakan/);
  });
});
