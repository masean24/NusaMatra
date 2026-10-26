import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { DisplayModeProvider } from '@/features/theme';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { HowItWorksSection } from './HowItWorksSection';

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderSection() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HowItWorksSection /> },
      { path: '*', element: <CurrentPath /> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <DisplayModeProvider>
      <RouterProvider router={router} />
    </DisplayModeProvider>,
  );
}

describe('HowItWorksSection', () => {
  // Accessible names read "Langkah 1:Jelajahi…": the hidden prefix and the title are adjacent nodes.
  const stepLink = (step: number, title: string) =>
    screen.getByRole('link', { name: new RegExp(`^Langkah ${String(step)}:\\s*${title}`) });

  it.each([
    [1, 'Jelajahi', '/jelajahi'],
    [2, 'Bandingkan', '/bandingkan'],
    [3, 'Putuskan', '/lab-prioritas'],
    [4, 'Uji', '/uji-rekomendasi'],
    [5, 'Verifikasi', '/paspor-bukti'],
  ])('step %i "%s" opens %s', async (step, title, path) => {
    renderSection();
    await userEvent.click(stepLink(step, title));
    expect(await screen.findByTestId('path')).toHaveTextContent(path);
  });

  it('keeps real links, so a new tab or a keyboard user still works', () => {
    renderSection();
    expect(stepLink(1, 'Jelajahi')).toHaveAttribute('href', '/jelajahi');
  });

  it('keeps every explanation in the document, so screen readers read the whole card', () => {
    renderSection();
    expect(screen.getByText('Atur bobot kriteria dan lihat urutan bergeser.')).toBeInTheDocument();
    expect(stepLink(3, 'Putuskan')).toHaveAccessibleDescription('');
  });

  it('names the three layers of the object, bottom to top', () => {
    renderSection();
    const layers = screen.getAllByRole('listitem').filter((item) => item.hasAttribute('data-layer'));
    expect(layers.map((item) => item.textContent)).toEqual([
      'Data & Sumber',
      'Analisis & Simulasi',
      'Keputusan & Bukti',
    ]);
  });

  describe('on a touch screen (no hover)', () => {
    beforeEach(() => {
      setMediaQueryMatches('(hover: none)', true);
    });

    it('opens a card on the first tap and only follows the link on the second', async () => {
      renderSection();
      const card = stepLink(1, 'Jelajahi');
      expect(card).not.toHaveAttribute('data-open');

      await userEvent.click(card);
      expect(card).toHaveAttribute('data-open', 'true');
      expect(screen.queryByTestId('path')).toBeNull();

      await userEvent.click(card);
      expect(await screen.findByTestId('path')).toHaveTextContent('/jelajahi');
    });

    it('keeps one card open: opening another closes the previous', async () => {
      renderSection();
      await userEvent.click(stepLink(1, 'Jelajahi'));
      await userEvent.click(stepLink(2, 'Bandingkan'));
      expect(stepLink(2, 'Bandingkan')).toHaveAttribute('data-open', 'true');
      expect(stepLink(1, 'Jelajahi')).not.toHaveAttribute('data-open');
    });
  });
});
