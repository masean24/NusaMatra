import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { DisplayModeProvider } from '@/features/theme';
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
});
