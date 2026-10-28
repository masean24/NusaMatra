import { render, screen, within } from '@testing-library/react';
import { DEMO_PASSPORT_PREVIEW } from '@/data/fixtures/landingDemo';
import { SourcesSection } from './SourcesSection';

describe('SourcesSection', () => {
  it('lists only the sources in use, BNPB and BPS, both through the Data Hub', () => {
    render(<SourcesSection />);
    const card = (name: string) =>
      within(screen.getByRole('heading', { name }).closest('article') as HTMLElement);

    expect(card('BNPB · InaRISK').getByText('Terhubung lewat Data Hub')).toBeInTheDocument();
    expect(card('Badan Pusat Statistik').getByText('Terhubung lewat Data Hub')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText(/DJPK/)).not.toBeInTheDocument();
  });

  it('does not imply every indicator has data', () => {
    render(<SourcesSection />);
    expect(screen.getByText(/Belum semua indikator punya data/)).toBeInTheDocument();
  });
});

describe('landing Paspor Bukti preview', () => {
  it('labels its illustrative identifier CONTOH', () => {
    expect(DEMO_PASSPORT_PREVIEW.id).toMatch(/^CONTOH-/);
    expect(DEMO_PASSPORT_PREVIEW.rows.map((row) => row.value).join(' ')).not.toMatch(/direncanakan/);
  });
});
