import { render, screen } from '@testing-library/react';
import { PrintRunningHeader } from './PrintRunningHeader';
import { BROWSER_ASSEMBLED_LABEL } from './notices';
import { capturedLiveBodies, hubFetch } from './evidenceTestKit';
import { EvidencePassport } from './EvidencePassport';
import { renderWithDataHub } from '@/test/dataHubFixtures';

const pageRule = (container: HTMLElement) => container.querySelector('style')?.textContent ?? '';

describe('PrintRunningHeader', () => {
  it('names the mode, the snapshot and what the passport is, in the document and in the page margin box', () => {
    const { container } = render(
      <PrintRunningHeader source={{ dataMode: 'LIVE', snapshotId: '2026.10.0-official-live' }} />,
    );
    const text = `Nusa Matra · Paspor Bukti · Mode LIVE · Snapshot 2026.10.0-official-live · ${BROWSER_ASSEMBLED_LABEL}`;
    expect(screen.getByText(text)).toBeInTheDocument();
    const rule = pageRule(container);
    expect(rule).toContain('@page');
    expect(rule).toContain('@top-left');
    expect(rule).toContain(`content: "${text}"`);
    expect(rule).toContain('counter(page)');
  });

  it('shows DEMO when the record is DEMO', () => {
    const { container } = render(
      <PrintRunningHeader source={{ dataMode: 'DEMO', snapshotId: '2026.10.0-wia-demo' }} />,
    );
    expect(pageRule(container)).toContain('Mode DEMO · Snapshot 2026.10.0-wia-demo');
  });

  it('never lets a snapshot id end the CSS string it is written into', () => {
    const hostile = '1"; } body { display: none } /*';
    const { container } = render(<PrintRunningHeader source={{ dataMode: 'LIVE', snapshotId: hostile }} />);
    const rule = pageRule(container);
    expect(rule).not.toContain('display: none');
    expect(rule).not.toContain(hostile);
    expect(rule).toContain('Snapshot tidak dapat ditampilkan');
    expect(screen.getByText(/Snapshot tidak dapat ditampilkan/)).toBeInTheDocument();
  });

  it('is the first thing in a printed passport and appears once', async () => {
    renderWithDataHub(<EvidencePassport />, {
      fetchImpl: hubFetch(capturedLiveBodies()),
      path: '/paspor-bukti?jenis=wilayah&mode=live&kode=1101',
      dataMode: 'DEMO',
    });
    const article = await screen.findByRole('article', { name: /^Bukti indikator/ });
    const styles = article.querySelectorAll('style');
    expect(styles).toHaveLength(1);
    const first = [...article.children].find((child) => child.tagName !== 'STYLE');
    expect(first?.className).toMatch(/printHeader/);
  });
});
