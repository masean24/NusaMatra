import { render, screen, within } from '@testing-library/react';
import { DEMO_PASSPORT_PREVIEW } from '@/data/fixtures/landingDemo';
import { SourcesSection } from './SourcesSection';

describe('SourcesSection', () => {
  it('marks BNPB and BPS as connected through the LIVE Data Hub and DJPK as planned', () => {
    render(<SourcesSection />);
    const card = (name: string) =>
      within(screen.getByRole('heading', { name }).closest('article') as HTMLElement);

    expect(card('BNPB · InaRISK').getByText('Terhubung lewat Data Hub (mode LIVE)')).toBeInTheDocument();
    expect(
      card('Badan Pusat Statistik').getByText('Terhubung lewat Data Hub (mode LIVE)'),
    ).toBeInTheDocument();
    expect(card('DJPK Kemenkeu').getByText('Direncanakan · belum terhubung')).toBeInTheDocument();
    expect(screen.queryByText(/belum terhubung di prototipe/)).not.toBeInTheDocument();
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
